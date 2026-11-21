"""Rehearse Swift Git writes, duplicate runs, and recovery without GitHub."""

from pathlib import Path
import runpy
import subprocess
import tempfile
import unittest
from unittest.mock import patch


def git(directory, *args):
    return subprocess.check_output(["git", "-C", directory, *args], text=True).strip()


class SwiftPublicationTest(unittest.TestCase):
    def test_first_release_and_retry(self):
        script = runpy.run_path("scripts/publish-swift.py")
        publish = script["publish"]
        tag = "refs/tags/0.1.0"
        created_releases = []

        def run(*command, **options):
            if command[:3] == ("gh", "release", "create"):
                self.assertIn("--verify-tag", command)
                repo = command[command.index("--repo") + 1]
                if repo == script["UI_REPOSITORY"]:
                    self.assertIn("--latest=false", command)
                created_releases.append((repo, command[3]))
            else:
                script["run"](*command, **options)

        def needs_release(repository, version, env):
            return (repository, version) not in created_releases

        with tempfile.TemporaryDirectory(prefix="swift-publication-") as temporary:
            directory = Path(temporary)
            ui = directory / "ui.git"
            parser = directory / "links-notation-swift.git"
            git(".", "clone", "--quiet", "--bare", "--shared", "--no-tags", ".", ui)
            git(directory, "init", "--quiet", "--bare", "--initial-branch=main", parser)
            source = git(".", "rev-parse", "HEAD")

            with (
                patch.dict("os.environ", {"PARSER_RELEASE_TOKEN": "local-test"}),
                patch.dict(publish.__globals__, {
                    "UI_URL": ui.as_uri(),
                    "PARSER_URL": parser.as_uri(),
                    "run": run,
                    "needs_release": needs_release,
                }),
            ):
                publish("0.1.0", "0.1.0")
                parser_commit = git(parser, "rev-parse", tag)
                self.assertEqual(git(ui, "rev-parse", tag), source)
                self.assertEqual(git(parser, "rev-parse", "main"), parser_commit)
                self.assertEqual(git(parser, "show", f"{tag}:VERSION"), "0.1.0")
                self.assertIn("Package.swift", git(parser, "ls-tree", "--name-only", tag).splitlines())
                self.assertCountEqual(created_releases, [
                    (script["UI_REPOSITORY"], "0.1.0"), (script["PARSER_REPOSITORY"], "0.1.0"),
                ])

                # A retry after tagging and one successful release recreates only the missing release.
                created_releases.remove((script["UI_REPOSITORY"], "0.1.0"))
                publish("0.1.0", "0.1.0")
                publish("0.1.0", "0.1.0")
                self.assertEqual(git(parser, "rev-parse", tag), parser_commit)
                self.assertEqual(len(created_releases), 2)

                different_commit = git(
                    ui, "-c", "user.name=Swift Publication Test",
                    "-c", "user.email=swift@example.invalid",
                    "commit-tree", "HEAD^{tree}", "-m", "Conflicting tag",
                )
                git(ui, "update-ref", tag, different_commit)
                with self.assertRaisesRegex(ValueError, "Rerun the original release or bump VERSION"):
                    publish("0.1.0", "0.1.0")
                self.assertEqual(git(ui, "rev-parse", tag), different_commit)
                self.assertEqual(git(parser, "rev-parse", tag), parser_commit)


if __name__ == "__main__":
    unittest.main()
