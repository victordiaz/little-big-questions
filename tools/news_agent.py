# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "openai"]
# ///
"""Turns the most relevant international news stories of the day into kids' stories.

Tavily searches recent news; Nemotron 3.5 Super VL (Nebius Token Factory) picks the top 3
(--count), then writes each one as a Little Big Questions story: a title and 3-5 narration
steps, each with an image prompt that FLUX 3 Klein draws, plus Olive's intro and wrap-up.
Keys come from the environment or from the .env file at the repository root (TAVILY_API_KEY,
NEBIUS_API_KEY, BFL_API_KEY):

    uv run tools/news_agent.py
    uv run tools/news_agent.py --count 1                # one story, for testing
    uv run tools/news_agent.py --days 2 --candidates 20 --no-images

Writes news/<date>/stories.json and news/<date>/<story-id>/step-<n>.jpg.
"""
import argparse
import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests
from openai import OpenAI

from flux_image import generate

# The repository root: this script lives in tools/
ROOT = Path(__file__).resolve().parent.parent
TAVILY_URL = "https://api.tavily.com/search"
NEBIUS_URL = "https://api.tokenfactory.us-north1.nebius.com/v1/"
MODEL = "nvidia/Nemotron-3.5-Super-VL"

QUERIES = [
    "top international world news today",
    "global breaking news geopolitics economy",
]

SYSTEM_PROMPT = """You are a senior international news editor.
You receive a list of candidate news articles from the last few days. Pick the {count} most
relevant INTERNATIONAL stories: events with global or cross-border impact (geopolitics,
conflicts, diplomacy, global economy, climate, major science or health news). Skip local
news, celebrity gossip, sports results, opinion pieces and duplicates of the same story.

Answer ONLY with JSON, no prose, in this shape:
{"stories": [{"title": "...", "summary": "2-3 sentence neutral summary", "why_it_matters": "one sentence", "sources": ["url", ...]}]}
Order the stories from most to least relevant. Use only URLs from the candidates."""

# Appended to every image prompt so all the pictures share the show's look.
IMAGE_STYLE = ("flat vector illustration, friendly cartoon style for a children's news show, "
               "soft rounded shapes, bright warm colors, warm and hopeful, not scary, no text")

STORY_PROMPT = """You write for Little Big Questions, a show that helps kids aged 6 to 10 make
sense of the big, sometimes scary things happening in the world. We take real news, like
elections, wars, climate or inequality, and explain it in friendly, cartoon-style stories that
are honest without being frightening. The goal isn't to shield kids from the world, but to help
them understand that it's complicated, that people see things differently, and that their
questions matter.

Turn the news story you receive into a short narrated story of 3 to 5 steps.

Narration rules:
- Short, simple sentences a 7-year-old understands. Explain any hard word right away.
- Stay true to the facts. Don't invent details, don't take sides.
- No graphic details: no injuries, blood, bodies or numbers of deaths. Say that people are
  hurt or sad, without describing it.
- Show that different people see the issue differently, and why.
- Mention the people who are helping or working on it, but don't promise a happy ending.
- The last step wraps the story up. Olive, the show's presenter, asks the kids a question
  after the story, so don't end with one.
- Each step's narration is 2 to 4 sentences, about 15 seconds read aloud.

Image prompt rules, one per step:
- Describe one clear scene for the narration of that step, as a cartoon illustration.
- Each prompt must stand on its own: the image model doesn't see the other prompts, so describe
  recurring characters and places the same way every time (e.g. "a small round blue robot").
- Use symbols and generic cartoon people or animals, never real politicians or celebrities,
  flags drawn in detail, logos, weapons, explosions, injuries or crying close-ups.
- No words or letters in the picture.

Motion rules, one per step: the image becomes the first frame of a short animated clip that
flows into the next step's image. In one sentence, describe the gentle movement in the scene
(characters walking, waving, clouds drifting, a slow camera push-in). Calm, playful motion only.

Answer ONLY with JSON, no prose, in this shape:
{"title": "short catchy title for kids",
 "question": "the little big question this story answers, e.g. Why do countries sometimes fight?",
 "steps": [{"narration": "...", "image_prompt": "...", "motion": "..."}]}"""


# Olive, the presenter, opens and closes each story at the desk (room-viewer/src/labs/show.jsx).
ANCHOR_PROMPT = """You write the lines of Olive, the presenter of Little Big Questions, a news
show for kids aged 6 to 10 that explains real news honestly without being frightening.
Each story runs: Olive's intro at the desk, then the story video (its narration is given to
you), then Olive's wrap-up.

Write, for the story you receive:
- topic: one or two words for the on-screen tab, e.g. "Elections", "Climate", "War".
- mood: Olive's face, one of "happy", "explaining" or "gentle" (gentle for scary or sad news).
- intro: 1 to 2 short sentences, about 8 seconds aloud. Ask the story's little big question
  and set it up in a friendly way. For scary topics, reassure first ("let's go slowly").
- outro: 1 to 2 short sentences, about 8 seconds aloud. Say that people see this differently
  or that people are working on it, then ask the kids one open question. For scary or sad
  news, remind them that talking to a grown-up they trust helps.

Examples of Olive's voice:
- intro: "This one can feel scary, so let's go slowly. Sometimes countries disagree about land or safety, and talking stops working."
- outro: "People vote differently because they care about different things, and that is okay. If your class had a vote, what would you choose?"

Answer ONLY with JSON, no prose:
{"topic": "...", "mood": "...", "intro": "...", "outro": "..."}"""

# The on-screen accent for each of Olive's moods, from the show's palette.
ACCENTS = {"happy": "#ffc93c", "explaining": "#2bb3a3", "gentle": "#8fa8ff"}


def load_env():
    env = ROOT / ".env"
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        key, sep, value = line.partition("=")
        if sep and not key.strip().startswith("#"):
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def require(name):
    value = os.environ.get(name)
    if not value:
        raise SystemExit(f"Missing {name}: export it or add it to {ROOT / '.env'}")
    return value


def search_news(api_key, days, max_results):
    # One article can show up under several queries; keep the first copy by URL.
    seen = {}
    for query in QUERIES:
        response = requests.post(
            TAVILY_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "query": query,
                "topic": "news",
                "days": days,
                "max_results": max_results,
                "search_depth": "advanced",
            },
            timeout=60,
        )
        if not response.ok:
            raise SystemExit(f"Tavily stopped: {response.status_code} {response.text[:200]}")
        for result in response.json().get("results", []):
            seen.setdefault(result["url"], result)
    return list(seen.values())


def format_candidates(results):
    lines = []
    for i, r in enumerate(results, 1):
        content = (r.get("content") or "").replace("\n", " ")[:600]
        lines.append(
            f"[{i}] {r.get('title', '')}\n"
            f"URL: {r['url']}\n"
            f"Published: {r.get('published_date', 'unknown')}\n"
            f"{content}"
        )
    return "\n\n".join(lines)


def ask(client, system, text, temperature):
    response = client.chat.completions.create(
        model=MODEL,
        temperature=temperature,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": [{"type": "text", "text": text}]},
        ],
    )
    return parse_json(response.choices[0].message.content or "")


def pick_top_stories(client, results, count):
    # replace, not format: the prompt's JSON example has braces.
    system = SYSTEM_PROMPT.replace("{count}", str(count))
    return ask(client, system, "Candidates:\n\n" + format_candidates(results), 0.2)


def write_kids_story(client, story):
    news = (f"Headline: {story['title']}\n"
            f"Summary: {story['summary']}\n"
            f"Why it matters: {story['why_it_matters']}")
    kids = ask(client, STORY_PROMPT, news, 0.7)
    if not 3 <= len(kids.get("steps", [])) <= 5:
        print(f"  note: got {len(kids.get('steps', []))} steps for {story['title']!r}")
    return kids


def write_anchor_lines(client, entry):
    story = (f"Little big question: {entry['question']}\n"
             f"Title: {entry['title']}\n"
             "Narration:\n" + "\n".join(step["narration"] for step in entry["steps"]))
    lines = ask(client, ANCHOR_PROMPT, story, 0.7)
    mood = lines.get("mood") if lines.get("mood") in ACCENTS else "explaining"
    return {"topic": lines["topic"], "mood": mood, "accent": ACCENTS[mood],
            "intro": lines["intro"], "outro": lines["outro"]}


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:50] or "story"


def draw_step(api_key, prompt, path):
    # flux_image stops with SystemExit on API errors; keep the other images going.
    try:
        result = generate(f"{prompt}, {IMAGE_STYLE}", api_key, aspect_ratio="16:9", model="klein")
        response = requests.get(result["sample"], timeout=120)
        response.raise_for_status()
    except (SystemExit, requests.RequestException) as error:
        print(f"  FAIL {path.relative_to(ROOT)}: {error}")
        return None
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(response.content)
    print(f"  ok   {path.relative_to(ROOT)}")
    return str(path.relative_to(ROOT))


def draw_images(api_key, entries, out_dir):
    with ThreadPoolExecutor(max_workers=6) as pool:
        jobs = [
            (step, pool.submit(draw_step, api_key, step["image_prompt"],
                               out_dir / entry["id"] / f"step-{n}.jpg"))
            for entry in entries
            for n, step in enumerate(entry["steps"], 1)
        ]
        for step, job in jobs:
            step["image"] = job.result()


def parse_json(text):
    # Reasoning models may wrap the answer in <think> blocks or ```json fences.
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S)
    match = re.search(r"\{.*\}", text, flags=re.S)
    if not match:
        raise SystemExit(f"The model did not return JSON:\n{text[:1000]}")
    return json.loads(match.group(0))


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--days", type=int, default=2, help="how far back to search")
    parser.add_argument("--candidates", type=int, default=15, help="Tavily results per query (max 20)")
    parser.add_argument("--count", type=int, default=3, help="how many stories to make")
    parser.add_argument("--out", default="news", help="output directory")
    parser.add_argument("--no-images", action="store_true", help="skip the FLUX images")
    args = parser.parse_args()

    load_env()
    results = search_news(require("TAVILY_API_KEY"), args.days, args.candidates)
    if not results:
        raise SystemExit("Tavily returned no news")
    print(f"Found {len(results)} candidate articles, asking {MODEL}...")

    client = OpenAI(base_url=NEBIUS_URL, api_key=require("NEBIUS_API_KEY"))
    stories = pick_top_stories(client, results, args.count)["stories"][:args.count]

    entries = []
    for story in stories:
        print(f"Writing the kids' story for: {story['title']}")
        kids = write_kids_story(client, story)
        entry = {
            "id": slugify(kids["title"]),
            "title": kids["title"],
            "question": kids.get("question", ""),
            "news": story,
            "steps": kids["steps"],
        }
        entry.update(write_anchor_lines(client, entry))
        entries.append(entry)

    out_dir = ROOT / args.out / time.strftime("%Y-%m-%d")
    out_file = out_dir / "stories.json"
    out_dir.mkdir(parents=True, exist_ok=True)
    # Save before drawing so the text survives a failed image run.
    out_file.write_text(json.dumps(entries, indent=2, ensure_ascii=False))

    if not args.no_images:
        print("Drawing the steps with FLUX 3 Klein...")
        draw_images(require("BFL_API_KEY"), entries, out_dir)
        out_file.write_text(json.dumps(entries, indent=2, ensure_ascii=False))

    for i, entry in enumerate(entries, 1):
        print(f"\n{i}. {entry['title']}  ({entry['question']})")
        for n, step in enumerate(entry["steps"], 1):
            print(f"   {n}. {step['narration']}")
    print(f"\nSaved: {out_file.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
