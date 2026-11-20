"""Probe GHCR writes and verify release images with an anonymous pull token."""

import argparse
import base64
from http.client import HTTPSConnection
import re
import json
import os
import time
from urllib.parse import urlencode, urljoin, urlsplit

HOST = "ghcr.io"
INDEX_TYPES = ", ".join((
    "application/vnd.oci.image.index.v1+json",
    "application/vnd.docker.distribution.manifest.list.v2+json",
    "application/vnd.oci.image.manifest.v1+json",
    "application/vnd.docker.distribution.manifest.v2+json",
))
REQUIRED_PLATFORMS = {"linux/amd64", "linux/arm64"}


class RegistryError(ValueError):
    def __init__(self, operation, status):
        self.status = status
        reason = "denied" if status in (401, 403) else "unknown"
        super().__init__(f"GHCR {operation}: {reason} (HTTP {status}).")


def request(method, path, **headers):
    connection = HTTPSConnection(HOST, timeout=20)
    try:
        connection.request(method, path, headers=headers)
        response = connection.getresponse()
        return response.status, response.getheader("Location"), response.read()
    finally:
        connection.close()


def token(image, push=False):
    headers = {}
    actions = "pull"
    if push:
        actions = "pull,push"
        credentials = f'{os.environ["GITHUB_ACTOR"]}:{os.environ["GH_TOKEN"]}'
        headers["Authorization"] = f"Basic {base64.b64encode(credentials.encode()).decode()}"
    query = urlencode({"service": HOST, "scope": f"repository:{image}:{actions}"})
    status, _, body = request("GET", f"/token?{query}", **headers)
    if status != 200:
        raise RegistryError("token", status)
    return json.loads(body)["token"]


def probe(image):
    headers = {"Authorization": f"Bearer {token(image, push=True)}"}
    status, location, _ = request("POST", f"/v2/{image}/blobs/uploads/", **headers)
    if status != 202 or not location:
        raise RegistryError("upload authorization", status)
    url = urlsplit(urljoin(f"https://{HOST}", location))
    if url.scheme != "https" or url.netloc != HOST or not url.path.startswith(f"/v2/{image}/blobs/uploads/"):
        raise ValueError("GHCR returned an unexpected upload location.")
    status, _, _ = request("DELETE", f"{url.path}?{url.query}" if url.query else url.path, **headers)
    if status != 204:
        raise RegistryError("upload cleanup", status)
    print("GHCR accepted and cancelled an empty upload session.")


def platforms(image, version, authenticated=False):
    status, _, body = request("GET", f"/v2/{image}/manifests/{version}",
                              Authorization=f"Bearer {token(image, push=authenticated)}", Accept=INDEX_TYPES)
    if status == 404:
        return None
    if status != 200:
        raise RegistryError("manifest read", status)
    entries = json.loads(body).get("manifests", [])
    return {f'{p.get("os")}/{p.get("architecture")}' for entry in entries if (p := entry.get("platform"))}


def prepare(image, version):
    try:
        public = platforms(image, version)
    except RegistryError as error:
        if error.status not in (401, 403):
            raise
        public = None
    if public is not None:
        if not REQUIRED_PLATFORMS <= public:
            raise ValueError(f"{version} already exists with incomplete platforms: {sorted(public)}.")
        print("::notice::The public image already serves both architectures.")
        return
    if platforms(image, version, authenticated=True) is not None:
        raise ValueError(f"{version} already exists. Make the GHCR package public to verify the image anonymously.")
    probe(image)
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as stream:
        print(f"version={version}", file=stream)


def verify(image, version):
    for delay in (0, 2, 5, 15, 30):
        time.sleep(delay)
        try:
            actual = platforms(image, version)
            if actual is not None and REQUIRED_PLATFORMS <= actual:
                print(f"Anonymous manifest for {image}:{version} includes linux/amd64 and linux/arm64.")
                return
            cause = f"Architectures found: {sorted(actual or [])}"
        except (OSError, ValueError, KeyError) as error:
            cause = str(error)
        print(cause, flush=True)
    raise ValueError("The image could not be verified anonymously. On first publication, make the GHCR package public.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["prepare", "verify"])
    parser.add_argument("version")
    options = parser.parse_args()
    image = os.environ["GITHUB_REPOSITORY"].lower()
    if not re.fullmatch(r"v[0-9]+\.[0-9]+\.[0-9]+", options.version):
        parser.error("Expected a stable SwiftPM version tag, such as v1.0.0.")
    try:
        if options.operation == "prepare":
            prepare(image, options.version)
        else:
            verify(image, options.version)
    except (OSError, ValueError, KeyError) as error:
        parser.exit(1, f"::error::{error}\n")


if __name__ == "__main__":
    main()
