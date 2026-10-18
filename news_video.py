# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "openai"]  # openai: news_agent is imported for its helpers
# ///
"""Animates the steps of the news_agent.py stories with FLUX 3 Video.

Each step becomes one clip that starts on the step's image and ends on the next step's
image, so the clips flow into each other. The clip lasts as long as the step's voice from
news_voice.py (run it first), or about as long as its narration would take to read. Then
ffmpeg joins the clips into one video per story, with the narration on top when every step
is voiced. BFL_API_KEY comes from the environment or the .env file next to this script:

    uv run news_video.py                       # latest news/<date>/stories.json
    uv run news_video.py news/2026-10-18/stories.json --only climate --force
    uv run news_video.py --audio --resolution fhd

Writes news/<date>/<story-id>/clip-<n>.mp4 and <story-id>.mp4, and records the paths in
stories.json. Clips that already exist are kept, unless --force.
"""
import argparse
import json
import math
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

from flux_image import encode_image, run_task
from news_agent import ROOT, load_env, require

VIDEO_URL = "https://api.bfl.ai/v1/flux-3-video"
STYLE = ("Friendly 2D cartoon animation for a children's news show, smooth and calm motion, "
         "soft rounded shapes, warm and hopeful, not scary, no text")
WORDS_PER_SECOND = 2.3  # a calm narrator reading to kids


def clip_seconds(step):
    # FLUX 3 Video takes 5 to 20 seconds; leave a beat after the last word. A longer
    # voice holds the clip's last frame (see add_voice).
    spoken = step.get("voice_seconds") or len(step["narration"].split()) / WORDS_PER_SECOND
    return max(5, min(20, math.ceil(spoken) + 1))


def clip_prompt(step, next_step):
    motion = step.get("motion") or "Gentle, calm movement in the scene and a slow camera push-in"
    prompt = f"{motion}. Scene: {step['image_prompt']}."
    if next_step:
        prompt += f" The scene then flows smoothly into: {next_step['image_prompt']}."
    return f"{prompt} {STYLE}"


def find_url(result):
    # The result payload isn't documented for video; take the known keys, then any URL.
    if isinstance(result, str):
        return result
    for key in ("sample", "video", "url"):
        if isinstance(result.get(key), str):
            return result[key]
    for value in result.values():
        if isinstance(value, str) and value.startswith("http"):
            return value
    raise SystemExit(f"No video URL in result: {str(result)[:300]}")


def make_clip(api_key, step, next_step, path, args):
    keyframes = [encode_image(str(ROOT / step["image"]))]
    if next_step and next_step.get("image"):
        keyframes.append(encode_image(str(ROOT / next_step["image"])))
    body = {
        "mode": "i2v",
        "prompt": clip_prompt(step, next_step),
        "keyframes": keyframes,
        "duration": clip_seconds(step),
        "aspect_ratio": "16:9",
        "resolution": args.resolution,
        "generate_audio": args.audio,
    }
    # flux_image stops with SystemExit on API errors; keep the other clips going.
    try:
        result = run_task(VIDEO_URL, body, api_key, timeout=1800)
        response = requests.get(find_url(result), timeout=300)
        response.raise_for_status()
    except (SystemExit, requests.RequestException) as error:
        print(f"  FAIL {path.relative_to(ROOT)}: {error}")
        return None
    path.write_bytes(response.content)
    print(f"  ok   {path.relative_to(ROOT)} ({body['duration']}s)")
    return str(path.relative_to(ROOT))


def media_seconds(path):
    probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                            "-of", "csv=p=0", str(path)], capture_output=True, text=True)
    return float(probe.stdout.strip() or 0)


def add_voice(clip, voice, path):
    # The voice replaces the clip's own sound. When the voice runs longer, the last frame
    # holds; when it's shorter, silence fills the rest of the clip.
    seconds = max(media_seconds(ROOT / clip), media_seconds(ROOT / voice) + 0.5)
    command = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(ROOT / clip), "-i", str(ROOT / voice),
               "-filter_complex", "[0:v]tpad=stop_mode=clone:stop_duration=30[v];[1:a]apad[a]",
               "-map", "[v]", "-map", "[a]", "-t", f"{seconds:.2f}",
               "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000",
               str(path)]
    return subprocess.run(command).returncode == 0


def join_clips(clips, path):
    # Re-encode instead of stream copy so clips with slightly different encodings still join.
    listing = path.with_suffix(".txt")
    listing.write_text("".join(f"file '{ROOT / clip}'\n" for clip in clips))
    command = ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
               "-i", str(listing), "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p",
               "-c:a", "aac", str(path)]
    ok = subprocess.run(command).returncode == 0
    listing.unlink()
    return ok


def latest_stories():
    found = sorted((ROOT / "news").glob("*/stories.json"))
    if not found:
        raise SystemExit("No news/<date>/stories.json yet; run news_agent.py first")
    return found[-1]


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("stories", nargs="?", type=Path, help="stories.json (default: latest)")
    parser.add_argument("--only", default="", help="only stories whose id contains this")
    parser.add_argument("--resolution", default="hd", choices=["hd", "fhd", "qhd", "uhd"])
    parser.add_argument("--audio", action="store_true",
                        help="let FLUX add sound (off by default: the narrator goes on top)")
    parser.add_argument("--force", action="store_true", help="remake clips that exist")
    args = parser.parse_args()

    load_env()
    stories_file = (args.stories or latest_stories()).resolve()
    out_dir = stories_file.parent
    entries = [e for e in json.loads(stories_file.read_text()) if args.only in e["id"]]

    todo = []
    for entry in entries:
        (out_dir / entry["id"]).mkdir(parents=True, exist_ok=True)
        steps = entry["steps"]
        for n, step in enumerate(steps, 1):
            path = out_dir / entry["id"] / f"clip-{n}.mp4"
            if not step.get("image"):
                print(f"  skip {path.relative_to(ROOT)}: step {n} has no image")
                continue
            if path.exists() and not args.force:
                step["video"] = str(path.relative_to(ROOT))
                continue
            todo.append((step, steps[n] if n < len(steps) else None, path))

    if todo:
        # The key only matters when there's something to animate: adding the narration
        # to clips that exist needs no FLUX.
        api_key = require("BFL_API_KEY")
        print(f"Animating {len(todo)} clips with FLUX 3 Video...")
        with ThreadPoolExecutor(max_workers=4) as pool:
            jobs = [(step, pool.submit(make_clip, api_key, step, nxt, path, args))
                    for step, nxt, path in todo]
            for step, job in jobs:
                step["video"] = job.result()

    # Write back into the full file, keeping the stories --only left out.
    everything = json.loads(stories_file.read_text())
    by_id = {e["id"]: e for e in entries}
    everything = [by_id.get(e["id"], e) for e in everything]

    for entry in entries:
        clips = [s["video"] for s in entry["steps"] if s.get("video")]
        if len(clips) < len(entry["steps"]):
            print(f"{entry['id']}: {len(clips)}/{len(entry['steps'])} clips, not joining yet")
            continue
        folder = out_dir / entry["id"]
        if all(s.get("voice") for s in entry["steps"]):
            voiced = [folder / f"clip-{n}-voiced.mp4" for n in range(1, len(clips) + 1)]
            if not all(add_voice(c, s["voice"], v) for c, s, v in zip(clips, entry["steps"], voiced)):
                print(f"{entry['id']}: couldn't add the narration")
                continue
            clips = [str(v.relative_to(ROOT)) for v in voiced]
        else:
            print(f"{entry['id']}: no narration yet (run news_voice.py), joining silent clips")
        path = folder / f"{entry['id']}.mp4"
        if join_clips(clips, path):
            entry["video"] = str(path.relative_to(ROOT))
            print(f"Saved: {entry['video']}")

    stories_file.write_text(json.dumps(everything, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
