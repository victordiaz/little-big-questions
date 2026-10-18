# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "openai"]  # openai: Olive's lines come from news_agent
# ///
"""Puts the news stories in the show on the bedroom TV (room-viewer).

Each story plays in the show like the others: Olive's intro at the desk, the story video
with its narration, then Olive's wrap-up. Run after news_video.py:

    uv run tools/news_publish.py                     # latest news/<date>/stories.json
    uv run tools/presenter_voice.py     # then voice Olive's new lines

Copies each story's video to room-viewer/public/news/<id>.mp4 and writes
room-viewer/src/labs/news.json, which the show plays before the evergreen stories in
stories.json. Stories made before Olive's lines were part of news_agent.py get them
written here (NEBIUS_API_KEY), and saved back into stories.json.
"""
import argparse
import json
import shutil
from pathlib import Path

from openai import OpenAI

from news_agent import MODEL, NEBIUS_URL, ROOT, load_env, require, write_anchor_lines
from news_video import latest_stories, media_seconds

APP = ROOT / "room-viewer"
VIDEOS = APP / "public/news"
NEWS = APP / "src/labs/news.json"
OLIVE = ("topic", "mood", "accent", "intro", "outro")


def chapters(entry):
    # When each step's narration starts in the story video, for the captions. The story
    # video is the voiced clips one after another (see news_video.py).
    starts, at = [], 0.0
    for n, step in enumerate(entry["steps"], 1):
        folder = ROOT / Path(entry["video"]).parent
        clip = folder / f"clip-{n}-voiced.mp4"
        starts.append({"start": round(at, 2), "text": step["narration"]})
        at += media_seconds(clip if clip.exists() else folder / f"clip-{n}.mp4")
    return starts


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("stories", nargs="?", type=Path, help="stories.json (default: latest)")
    args = parser.parse_args()

    load_env()
    stories_file = (args.stories or latest_stories()).resolve()
    entries = json.loads(stories_file.read_text())

    missing = [e for e in entries if not all(e.get(k) for k in OLIVE)]
    if missing:
        client = OpenAI(base_url=NEBIUS_URL, api_key=require("NEBIUS_API_KEY"))
        for entry in missing:
            print(f"Writing Olive's lines with {MODEL} for: {entry['title']}")
            entry.update(write_anchor_lines(client, entry))
        stories_file.write_text(json.dumps(entries, indent=2, ensure_ascii=False))

    news = []
    VIDEOS.mkdir(parents=True, exist_ok=True)
    for entry in entries:
        if not entry.get("video"):
            print(f"skip {entry['id']}: no story video yet (run tools/news_video.py)")
            continue
        shutil.copyfile(ROOT / entry["video"], VIDEOS / f"{entry['id']}.mp4")
        news.append({
            "id": entry["id"],
            **{k: entry[k] for k in OLIVE},
            "question": entry["question"],
            "date": stories_file.parent.name,
            "video": f"/news/{entry['id']}.mp4",
            "narrated": all(step.get("voice") for step in entry["steps"]),
            "chapters": chapters(entry),
            "sources": entry.get("news", {}).get("sources", []),
        })
        print(f"ok   {entry['id']}: {entry['question']}")

    NEWS.write_text(json.dumps(news, indent=2, ensure_ascii=False) + "\n")
    print(f"Saved: {NEWS.relative_to(ROOT)} ({len(news)} stories)")
    print("Next: uv run tools/presenter_voice.py, for Olive's new lines")


if __name__ == "__main__":
    main()
