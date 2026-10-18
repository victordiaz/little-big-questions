# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "openai"]  # openai: news_agent is imported for its helpers
# ///
"""Voices the narration of the news_agent.py stories with Chatterbox.

Chatterbox clones the voice of a Fish Audio voice's sample clip, Dash (PBS KIDS) by
default. Start the server first, then:

    uv run scripts/chatterbox-server.py
    uv run news_voice.py                       # latest news/<date>/stories.json
    uv run news_voice.py news/2026-10-18/stories.json --only climate --force
    uv run news_voice.py --model multilingual --exaggeration 0.7

Writes news/<date>/<story-id>/voice-<n>.wav and records each step's audio and its length
in stories.json, which news_video.py uses to time the clips. A step is skipped when its
wav exists and its narration hasn't changed, unless --force.
"""
import argparse
import json
import re
import time
from pathlib import Path

import requests

from news_agent import ROOT
from news_video import latest_stories

VOICES = ROOT / ".voices"
# "Dash (PBS KIDS)" on Fish Audio: https://fish.audio/m/0ace0d3ff3cd403e88e751d4d9485020/
DEFAULT_VOICE = "0ace0d3ff3cd403e88e751d4d9485020"


def voice_clip(voice):
    """Downloads the Fish Audio voice's sample into .voices/ once; its link expires."""
    for path in VOICES.glob(f"{voice}.*"):
        return path
    response = requests.get(f"https://api.fish.audio/model/{voice}", timeout=30)
    response.raise_for_status()
    model = response.json()
    url = next((s["audio"] for s in model.get("samples") or [] if s.get("audio")), None)
    if not url:
        raise SystemExit(f"Fish Audio voice {voice} has no sample to clone")
    print(f"Voice: {model.get('title')} ({', '.join(model.get('languages') or [])})")
    audio = requests.get(url, timeout=60)
    audio.raise_for_status()
    path = VOICES / f"{voice}{Path(url.split('?')[0]).suffix or '.mp3'}"
    VOICES.mkdir(exist_ok=True)
    path.write_bytes(audio.content)
    return path


def wav_seconds(data):
    # 44-byte PCM header: byte rate at 28, data size at 40
    byte_rate = int.from_bytes(data[28:32], "little")
    return round((len(data) - 44) / byte_rate, 2) if byte_rate else None


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("stories", nargs="?", type=Path, help="stories.json (default: latest)")
    parser.add_argument("--only", default="", help="only stories whose id contains this")
    parser.add_argument("--server", default="http://localhost:8004")
    parser.add_argument("--voice", default=DEFAULT_VOICE, help="Fish Audio voice id or fish.audio/m/… link")
    parser.add_argument("--model", default="turbo", choices=["turbo", "multilingual"])
    parser.add_argument("--exaggeration", type=float, help="emotion, 0.25-2 (multilingual)")
    parser.add_argument("--cfg-weight", type=float, help="pacing, lower is slower (multilingual)")
    parser.add_argument("--temperature", type=float)
    parser.add_argument("--force", action="store_true", help="redo steps that are already voiced")
    args = parser.parse_args()

    voice = re.search(r"[0-9a-f]{32}", args.voice)[0]
    stories_file = (args.stories or latest_stories()).resolve()
    entries = json.loads(stories_file.read_text())

    todo = []
    for entry in entries:
        if args.only not in entry["id"]:
            continue
        for n, step in enumerate(entry["steps"], 1):
            path = stories_file.parent / entry["id"] / f"voice-{n}.wav"
            done = path.exists() and step.get("voice_text") == step["narration"]
            if args.force or not done:
                todo.append((step, path))
    if not todo:
        print("Every step is voiced already (use --force to redo).")
        return

    reference = f"clip:{voice_clip(voice).relative_to(VOICES)}"
    for i, (step, path) in enumerate(todo, 1):
        print(f"[{i}/{len(todo)}] {path.relative_to(ROOT)}: {step['narration'][:60]}…", flush=True)
        body = {
            "text": step["narration"],
            "language": "en",
            "reference": reference,
            "model": args.model,
            "exaggeration": args.exaggeration,
            "cfg_weight": args.cfg_weight,
            "temperature": args.temperature,
        }
        started = time.time()
        try:
            response = requests.post(f"{args.server}/tts", timeout=900,
                                     json={k: v for k, v in body.items() if v is not None})
        except requests.ConnectionError:
            raise SystemExit(f"No Chatterbox at {args.server}: uv run scripts/chatterbox-server.py")
        if not response.ok:
            print(f"  failed: {response.status_code} {response.text[:300]}")
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(response.content)
        step.update(voice=str(path.relative_to(ROOT)), voice_text=step["narration"],
                    voice_seconds=wav_seconds(response.content))
        # Saved after every step, so stopping halfway keeps what's done
        stories_file.write_text(json.dumps(entries, indent=2, ensure_ascii=False))
        print(f"  {step['voice_seconds']} s of audio in {time.time() - started:.0f} s")


if __name__ == "__main__":
    main()
