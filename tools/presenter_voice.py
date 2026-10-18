# /// script
# requires-python = ">=3.10"
# dependencies = ["requests"]
# ///
"""Voices Olive's lines (room-viewer/src/labs/stories.json and news.json) with Chatterbox.

Chatterbox clones the voice of a Fish Audio voice's sample clip. Start the server first
(uv run tools/chatterbox_server.py), then:

    uv run tools/presenter_voice.py
    uv run tools/presenter_voice.py --only war-intro --force
    uv run tools/presenter_voice.py --model multilingual --exaggeration 0.7

Writes room-viewer/public/voices/olive/<story>-<intro|outro>.wav and records each line's
text and length in room-viewer/src/labs/olive-voice.json, which the show reads. A line is
skipped when its wav exists and its text hasn't changed, unless --force.
"""
import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
# The evergreen stories, and today's news from news_publish.py
STORIES = [ROOT / "room-viewer/src/labs/stories.json", ROOT / "room-viewer/src/labs/news.json"]
OUT = ROOT / "room-viewer/public/voices/olive"
MANIFEST = ROOT / "room-viewer/src/labs/olive-voice.json"
# "kids" on Fish Audio: https://fish.audio/m/7c9a5cb2f8914bd1963d4237e540c036/
DEFAULT_VOICE = "7c9a5cb2f8914bd1963d4237e540c036"
SEGMENTS = ("intro", "outro")


def fish_headers():
    # Public voices don't need a key; send one when it's there.
    key = os.environ.get("FISH_API_KEY")
    env = ROOT / ".env.local"
    if not key and env.exists():
        match = re.search(r"^FISH_API_KEY=(.+)$", env.read_text(), re.M)
        key = match and match[1].strip().strip("\"'")
    return {"Authorization": f"Bearer {key}"} if key else {}


def sample_url(voice):
    # The sample's link is signed for an hour, so it's fetched fresh on every run.
    response = requests.get(
        f"https://api.fish.audio/model/{voice}",
        headers=fish_headers(),
        timeout=30,
    )
    response.raise_for_status()
    model = response.json()
    url = next((s["audio"] for s in model.get("samples") or [] if s.get("audio")), None)
    if not url:
        sys.exit(f"Fish Audio voice {voice} has no sample to clone")
    print(f"Voice: {model.get('title')} ({', '.join(model.get('languages') or [])})")
    return url


def wav_seconds(data):
    # 44-byte PCM header: byte rate at 28, data size at 40
    byte_rate = int.from_bytes(data[28:32], "little")
    return round((len(data) - 44) / byte_rate, 2) if byte_rate else None


def main():
    parser = argparse.ArgumentParser(description="Voice Olive's lines with Chatterbox")
    parser.add_argument("--server", default="http://localhost:8004")
    parser.add_argument("--voice", default=DEFAULT_VOICE, help="Fish Audio voice id or fish.audio/m/… link")
    parser.add_argument("--model", default="turbo", choices=["turbo", "multilingual"])
    parser.add_argument("--exaggeration", type=float, help="emotion, 0.25-2 (multilingual)")
    parser.add_argument("--cfg-weight", type=float, help="pacing, lower is slower (multilingual)")
    parser.add_argument("--temperature", type=float)
    parser.add_argument("--only", help="one line, e.g. war-intro")
    parser.add_argument("--force", action="store_true", help="redo lines that are already voiced")
    args = parser.parse_args()

    voice = re.search(r"[0-9a-f]{32}", args.voice)[0]
    stories = [s for path in STORIES if path.exists() for s in json.loads(path.read_text())]
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}

    lines = [
        (f"{s['id']}-{seg}", s[seg])
        for s in stories
        for seg in SEGMENTS
        if not args.only or f"{s['id']}-{seg}" == args.only
    ]
    todo = [
        (key, text)
        for key, text in lines
        if args.force or manifest.get(key, {}).get("text") != text or not (OUT / f"{key}.wav").exists()
    ]
    if not todo:
        print("Every line is voiced already (use --force to redo).")
        return

    reference = sample_url(voice)
    OUT.mkdir(parents=True, exist_ok=True)
    for i, (key, text) in enumerate(todo, 1):
        print(f"[{i}/{len(todo)}] {key}: {text[:60]}…", flush=True)
        body = {
            "text": text,
            "language": "en",
            "reference": reference,
            "model": args.model,
            "exaggeration": args.exaggeration,
            "cfg_weight": args.cfg_weight,
            "temperature": args.temperature,
        }
        started = time.time()
        response = requests.post(f"{args.server}/tts", json={k: v for k, v in body.items() if v is not None}, timeout=900)
        if not response.ok:
            print(f"  failed: {response.status_code} {response.text[:300]}")
            continue
        (OUT / f"{key}.wav").write_bytes(response.content)
        manifest[key] = {"text": text, "seconds": wav_seconds(response.content), "voice": voice, "model": args.model}
        # Saved after every line, so stopping halfway keeps what's done
        MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
        print(f"  {manifest[key]['seconds']} s of audio in {time.time() - started:.0f} s")


if __name__ == "__main__":
    main()
