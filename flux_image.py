# /// script
# requires-python = ">=3.10"
# dependencies = ["requests"]
# ///
"""Generate an image from a text prompt with FLUX 3 Image (BFL API).

Usage:
    export BFL_API_KEY=...
    uv run flux_image.py "a red fox in fresh snow" --aspect-ratio 16:9 --out images
    uv run flux_image.py "Turn <ref_image_0> into pixel art" --image photo.png --out images
"""
import argparse
import base64
import os
import re
import time
from pathlib import Path

import requests

API_URL = "https://api.bfl.ai/v1/flux-3-image"
IN_PROGRESS = {"Pending", "Reasoning", "Generating"}


def as_json(response):
    # An error page (HTML 502, proxy timeout) is not JSON. Report it instead of
    # raising a bare JSONDecodeError.
    try:
        return response.json()
    except ValueError:
        raise SystemExit(f"Stopped: {response.status_code} {response.text[:200]}")


def encode_image(ref):
    # The API takes http(s) URLs as-is; local files go as base64.
    if ref.startswith(("http://", "https://")):
        return ref
    return base64.b64encode(Path(ref).read_bytes()).decode()


def generate(prompt, api_key, aspect_ratio=None, resolution=None, images=None, timeout=600):
    body = {"prompt": prompt}
    if images:
        body["images"] = [encode_image(i) for i in images]
    if aspect_ratio:
        body["aspect_ratio"] = aspect_ratio
    if resolution:
        body["resolution"] = resolution

    # Submit generation request
    response = as_json(requests.post(
        API_URL,
        headers={
            "accept": "application/json",
            "x-key": api_key,
            "Content-Type": "application/json",
        },
        json=body,
    ))

    polling_url = response.get("polling_url")
    if not polling_url:
        # Validation errors echo the request back, which includes any base64 images.
        raise SystemExit(f"Submit failed: {str(response)[:500]}")
    print(f"Submitted {response.get('id')} (cost: {response.get('cost')})")

    # Poll for result
    deadline = time.time() + timeout
    while time.time() < deadline:
        result = as_json(requests.get(
            polling_url,
            headers={"accept": "application/json", "x-key": api_key},
        ))
        status = result.get("status")
        if status == "Ready":
            return result["result"]
        if status not in IN_PROGRESS:
            raise SystemExit(f"Stopped: {status} {result}")
        time.sleep(2)

    raise SystemExit(f"Timed out after {timeout}s")


def download(url, out_dir, prompt):
    # The signed URL expires after an hour; don't send the x-key header to it.
    response = requests.get(url, timeout=120)
    response.raise_for_status()
    ext = ".png" if "png" in response.headers.get("Content-Type", "") else ".jpg"
    slug = re.sub(r"[^a-z0-9]+", "-", prompt.lower()).strip("-")[:50] or "image"
    path = Path(out_dir) / f"{time.strftime('%Y%m%d-%H%M%S')}-{slug}{ext}"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(response.content)
    return path


def main():
    parser = argparse.ArgumentParser(description="Text to image with FLUX 3 Image")
    parser.add_argument("prompt")
    parser.add_argument("--aspect-ratio", help='e.g. "16:9", "1:1"')
    parser.add_argument("--resolution", help='e.g. "4k"')
    parser.add_argument("--out", default="images", help="output directory")
    parser.add_argument("--image", action="append", help="reference image path or URL "
                        "(repeatable, up to 10; refer to them as <ref_image_0>, ... in the prompt)")
    args = parser.parse_args()

    api_key = os.environ.get("BFL_API_KEY")
    if not api_key:
        raise SystemExit("Set BFL_API_KEY first")

    result = generate(args.prompt, api_key, args.aspect_ratio, args.resolution, args.image)
    print(f"Image URL: {result['sample']}")
    path = download(result["sample"], args.out, args.prompt)
    print(f"Saved: {path}")


if __name__ == "__main__":
    main()
