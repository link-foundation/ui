"""Plan and publish SwiftPM Git tags and GitHub Releases from validated source."""

import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time

from metadata import CHANGELOG, CHANGESETS, INITIAL_VERSION, SEMVER, VERSION_FILE, advance, git
from metadata import next_version, notes_for_tag, read_changesets, version

REMOTE = ["git", "-c", "credential.helper=", "-c", "credential.helper=!gh auth git-credential"]


def github(*args):
    return subprocess.check_output(["gh", *args], text=True)


def repository():
    return os.environ["GITHUB_REPOSITORY"]


def available_releases():
    pages = github("api", "--paginate", "--slurp", f"repos/{repository()}/releases?per_page=100")
    return {item["tag_name"]: item for page in json.loads(pages) for item in page}


def missing_releases(current):
    if current == INITIAL_VERSION:
        return []
    versions = re.findall(r"(?m)^## \[(\d+\.\d+\.\d+)\]$", CHANGELOG.read_text(encoding="utf-8"))
    if not versions or current != versions[0] or len(versions) != len(set(versions)):
        raise ValueError("The changelog must begin with the current version and contain unique releases.")
    published = available_releases()
    missing = []
    for number in reversed(versions):
        tag = f"v{number}"
        if subprocess.call(["git", "merge-base", "--is-ancestor", tag, "HEAD"]) != 0:
            raise ValueError(f"{tag} is missing or outside the validated branch.")
        if tag not in published:
            missing.append(tag)
        elif published[tag]["draft"] or published[tag]["prerelease"]:
            raise ValueError(f"{tag} exists as a draft or prerelease. Publish it as a stable release and retry.")
    return missing


def probe_permissions():
    try:
        github("api", "--method", "POST", f"repos/{repository()}/git/blobs",
               "-f", "encoding=utf-8", "-f", "content=Swift release permissions preflight")
    except subprocess.CalledProcessError as error:
        raise ValueError("GitHub refused or could not verify a write. Check contents: write and Actions policy.") from error


def check_archive(ref):
    # SwiftPM pulls Git, and GitHub generates the source archive from this same tree.
    limit = 100 * 1024 * 1024
    with tempfile.TemporaryFile() as temporary:
        subprocess.run(["git", "archive", "--format=tar.gz", ref], stdout=temporary, check=True)
        size = temporary.tell()
    if size > limit:
        raise ValueError(f"{ref} source archive is {size} bytes. Limit: {limit} bytes.")
    print(f"{ref} source archive: {size} bytes.", flush=True)


def publish_release(tag):
    with tempfile.TemporaryDirectory() as directory:
        notes = Path(directory, "notes.md")
        notes.write_text(notes_for_tag(tag), encoding="utf-8")
        github("release", "create", tag, "--verify-tag", "--title", tag, "--notes-file", str(notes),
               "--repo", repository())
    print(f"Published GitHub Release {tag}.", flush=True)


def output(**values):
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as stream:
        for key, value in values.items():
            print(f"{key}={value}", file=stream)


def prepare(image_version):
    if image_version:
        if os.getenv("IMAGES_ENABLED") != "true":
            raise ValueError("Set ENABLE_SWIFT_IMAGES=true before requesting a GHCR repair.")
        if not image_version.startswith("v") or not SEMVER.fullmatch(image_version[1:]):
            raise ValueError("Specify a stable tag such as v0.1.0 for GHCR repair.")
        published = available_releases().get(image_version)
        if not published or published["draft"] or published["prerelease"]:
            raise ValueError(f"{image_version} must have a stable GitHub Release before repairing GHCR.")

    current = version()
    pending = read_changesets()
    missing = missing_releases(current)
    needed = bool(pending or missing)
    if needed:
        probe_permissions()
        check_archive("HEAD")
    else:
        print("::notice::No new changesets or missing GitHub Releases.")
    tag = "" if current == INITIAL_VERSION else f"v{current}"
    output(publish=str(needed).lower(), version=tag,
           commit=git("rev-parse", f"{tag}^{{commit}}") if tag else "",
           **{"image-version": image_version})


def head_has_changed(validated, tip):
    if subprocess.call(["git", "merge-base", "--is-ancestor", validated, tip]) != 0:
        return True
    # The next default-branch run validates any new source. A prior writer's
    # release-metadata-only commit can be used to recompute this run's plan.
    return bool(git("diff", "--name-only", validated, tip, "--", ".",
                    f":(exclude){VERSION_FILE}", f":(exclude){CHANGELOG}",
                    f":(exclude){CHANGESETS}/"))


def classify_push(message):
    if re.search(r"GH00[346]|GH013|protected branch|repository rules", message, re.IGNORECASE):
        return "rule"
    if re.search(r"\(non-fast-forward\)|\(fetch first\)|cannot lock ref .* is at .* but expected", message):
        return "race"
    return "unknown"


def publish(validated, branch):
    git("config", "user.name", "github-actions[bot]")
    git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")
    for attempt in range(1, 4):
        subprocess.run([*REMOTE, "fetch", "--tags", "origin", f"refs/heads/{branch}"], check=True)
        tip = git("rev-parse", "FETCH_HEAD")
        if head_has_changed(validated, tip):
            print(f"::notice::A newer tree ({tip}) needs its own CI result. Its run owns the release.")
            output(version="", commit="")
            return
        git("checkout", "--detach", tip)
        current = version()
        for tag in missing_releases(current):
            publish_release(tag)
        entries = read_changesets()
        if not entries:
            tag = "" if current == INITIAL_VERSION else f"v{current}"
            output(version=tag, commit=git("rev-parse", f"{tag}^{{commit}}") if tag else "")
            return

        target = next_version(current, entries)
        tag = f"v{target}"
        if git("tag", "--list", tag):
            raise ValueError(f"{tag} already exists. Investigate the duplicate version before retrying.")
        advance(target, entries)
        git("commit", "-m", f"chore(release): {tag}")
        check_archive("HEAD")
        push = subprocess.run([*REMOTE, "push", "--atomic", "origin", f"HEAD:refs/heads/{branch}",
                               f"HEAD:refs/tags/{tag}"], capture_output=True, text=True)
        if push.returncode == 0:
            git("tag", tag, "HEAD")
            publish_release(tag)
            output(version=tag, commit=git("rev-parse", "HEAD"))
            return
        details = push.stdout + push.stderr
        print(details, flush=True)
        rejection = classify_push(details)
        if rejection == "rule":
            raise ValueError(f"Repository rules blocked {tag}. Allow github-actions to write release metadata and tags.")
        if rejection != "race" or attempt == 3:
            raise ValueError(f"Atomic push of {tag} failed after {attempt} attempt(s).")
        print(f"::notice::The default branch moved during attempt {attempt}. Recomputing release metadata.")
        time.sleep(attempt)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["prepare", "publish"])
    parser.add_argument("--validated", default=os.getenv("GITHUB_SHA", "HEAD"))
    parser.add_argument("--branch", default="main")
    parser.add_argument("--image-version", default="")
    options = parser.parse_args()
    try:
        if options.operation == "prepare":
            prepare(options.image_version)
        else:
            publish(options.validated, options.branch)
    except (ValueError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"::error::{error}\n")


if __name__ == "__main__":
    main()
