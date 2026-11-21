"""Build, verify, and publish the two versioned SwiftPM Git packages."""

import argparse
import io
import os
from pathlib import Path
import re
import subprocess
import tempfile
import zipfile


PARSER_PATH = "native/swift/LinksNotation"
PARSER_REPOSITORY = "link-foundation/links-notation-swift"
UI_REPOSITORY = "link-foundation/ui"
SEMVER = re.compile(r"(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\n")
AUTH_GIT = ["git", "-c", "credential.helper=", "-c", "credential.helper=!gh auth git-credential"]


def read(*command, **options):
    return subprocess.check_output(command, text=True, **options).strip()


def run(*command, **options):
    subprocess.run(command, check=True, **options)


def version(path):
    value = read("git", "show", f"HEAD:{path}")
    if not SEMVER.fullmatch(value + "\n"):
        raise ValueError(f"{path} must contain a bare MAJOR.MINOR.PATCH version.")
    return value


def export_parser(directory):
    directory.mkdir()
    for arguments in (
        [f"HEAD:{PARSER_PATH}"],
        ["HEAD", "LICENSE", "docs/spec/parser-vectors.json"],
    ):
        archive = subprocess.check_output(["git", "archive", "--format=zip", *arguments])
        with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
            bundle.extractall(directory)
    run("git", "init", "--quiet", "--initial-branch=main", directory)
    run("git", "add", "--all", cwd=directory)


def parser_commit(directory, parent=None):
    tree = read("git", "write-tree", cwd=directory)
    source = read("git", "rev-parse", "HEAD")
    parents = ("-p", parent) if parent else ()
    return read(
        "git", "-c", "user.name=github-actions[bot]",
        "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com",
        "commit-tree", tree, *parents,
        "-m", f"Export {UI_REPOSITORY}@{source}:{PARSER_PATH}",
        cwd=directory,
    )


def consumer(work, name, url, tag, identity, product, source):
    directory = work / name
    directory.mkdir()
    (directory / "Package.swift").write_text(f"""// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "{name}",
    platforms: [.macOS(.v14), .iOS(.v17)],
    dependencies: [.package(url: "{url}", exact: "{tag}")],
    targets: [.executableTarget(name: "{name}", dependencies: [
        .product(name: "{product}", package: "{identity}"),
    ])]
)
""", encoding="utf-8")
    sources = directory / "Sources" / name
    sources.mkdir(parents=True)
    (sources / "main.swift").write_text(source, encoding="utf-8")
    run("swift", "run", "--package-path", directory, "--jobs", "1", name)


def verify(ui_version, parser_version):
    with tempfile.TemporaryDirectory(prefix="swiftpm-") as temporary:
        work = Path(temporary)
        parser = work / "links-notation-swift"
        export_parser(parser)
        commit = parser_commit(parser)
        run("git", "update-ref", "refs/heads/main", commit, cwd=parser)
        run("git", "tag", parser_version, cwd=parser)
        ui = work / "ui.git"
        run("git", "clone", "--quiet", "--bare", "--shared", "--no-tags", ".", ui)
        run("git", "tag", ui_version, read("git", "rev-parse", "HEAD"), cwd=ui)

        run("swift", "test", "--jobs", "1", "--scratch-path", work / "ui-build")
        run("swift", "test", "--jobs", "1", "--package-path", parser,
            "--scratch-path", work / "parser-build")
        consumer(work, "UIConsumer", ui.as_uri(), ui_version, "ui", "UiSwiftCore", """import UiSwiftCore

let document = project("greeting: text Hello")
precondition(document.diagnostics.isEmpty)
""")
        if os.sys.platform == "darwin":
            consumer(work, "SwiftUIConsumer", ui.as_uri(), ui_version, "ui", "UiSwiftUI", """import UiSwiftUI

@MainActor
func makeView() -> UiView {
    UiView(document: UiDocumentModel(lino: "greeting: text Hello"))
}
""")
        consumer(work, "ParserConsumer", parser.as_uri(), parser_version, parser.name,
                 "LinksNotation", """import LinksNotation

let links = try Parser().parse("greeting: hello")
precondition(links.first?.id == "greeting")
""")


def remote_ref(directory, url, ref, env):
    found = read(*AUTH_GIT, "ls-remote", "--refs", url, ref, cwd=directory, env=env)
    if not found:
        return None
    run(*AUTH_GIT, "fetch", "--quiet", "--no-tags", "--depth=1", url, ref,
        cwd=directory, env=env)
    return read("git", "rev-parse", "FETCH_HEAD^{commit}", cwd=directory)


def needs_release(repository, tag, env):
    release = subprocess.run(
        ["gh", "api", f"repos/{repository}/releases/tags/{tag}", "--jq", ".draft or .prerelease"],
        capture_output=True, text=True, env=env,
    )
    if release.returncode == 0:
        if release.stdout.strip() != "false":
            raise ValueError(f"{repository} {tag} already exists as a draft or prerelease.")
        return False
    if "HTTP 404" in release.stderr:
        return True
    raise ValueError(f"Could not check {repository} {tag}: {release.stderr.strip()}")


def publish(ui_version, parser_version):
    token = os.environ.get("PARSER_RELEASE_TOKEN")
    if not token:
        raise ValueError("Configure PARSER_RELEASE_TOKEN for the LinksNotation Swift repository.")
    parser_env = dict(os.environ, GH_TOKEN=token)
    ui_env = os.environ.copy()
    ui_url = f"https://github.com/{UI_REPOSITORY}.git"
    parser_url = f"https://github.com/{PARSER_REPOSITORY}.git"
    ui_tag = f"refs/tags/{ui_version}"
    parser_tag = f"refs/tags/{parser_version}"
    source = read("git", "rev-parse", "HEAD")
    existing_ui = remote_ref(".", ui_url, ui_tag, ui_env)
    if existing_ui and existing_ui != source:
        raise ValueError(f"{ui_tag} points to {existing_ui}. Rerun the original release or bump VERSION.")

    with tempfile.TemporaryDirectory(prefix="links-notation-swift-") as temporary:
        parser = Path(temporary) / "package"
        export_parser(parser)
        existing_parser = remote_ref(parser, parser_url, parser_tag, parser_env)
        if existing_parser:
            tagged_tree = read("git", "rev-parse", f"{existing_parser}^{{tree}}", cwd=parser)
            if tagged_tree != read("git", "write-tree", cwd=parser):
                raise ValueError(f"{parser_tag} already contains different parser sources. Bump {PARSER_PATH}/VERSION.")

        release_ui = needs_release(UI_REPOSITORY, ui_version, ui_env)
        release_parser = needs_release(PARSER_REPOSITORY, parser_version, parser_env)
        if not existing_parser:
            branch = "refs/heads/main"
            parent = remote_ref(parser, parser_url, branch, parser_env)
            commit = parser_commit(parser, parent)
            run(*AUTH_GIT, "push", "--atomic", parser_url, f"{commit}:{branch}",
                f"{commit}:{parser_tag}", cwd=parser, env=parser_env)
        if not existing_ui:
            run(*AUTH_GIT, "push", ui_url, f"{source}:{ui_tag}", env=ui_env)

        if release_parser:
            run("gh", "release", "create", parser_version, "--repo", PARSER_REPOSITORY,
                "--verify-tag", "--title", f"LinksNotation Swift {parser_version}",
                "--notes", f"Standalone SwiftPM parser exported from https://github.com/{UI_REPOSITORY}/commit/{source}.",
                env=parser_env)
        if release_ui:
            run("gh", "release", "create", ui_version, "--repo", UI_REPOSITORY,
                "--verify-tag", "--latest=false", "--title", f"ui Swift {ui_version}",
                "--notes", "SwiftPM release of UiSwiftCore and UiSwiftUI.", env=ui_env)


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("operation", choices=["verify", "publish"])
    args = cli.parse_args()
    try:
        versions = version("VERSION"), version(f"{PARSER_PATH}/VERSION")
        operation = verify if args.operation == "verify" else publish
        operation(*versions)
    except (ValueError, subprocess.CalledProcessError) as error:
        cli.exit(1, f"::error::{error}\n")


if __name__ == "__main__":
    main()
