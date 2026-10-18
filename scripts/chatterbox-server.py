# /// script
# requires-python = ">=3.11,<3.12"
# dependencies = [
#   "chatterbox-tts @ git+https://github.com/resemble-ai/chatterbox@5de7a54aa4e5e2baadb0182dde554908b48b85c2",
#   "soundfile",
#   "setuptools<81",
# ]
# ///
"""Chatterbox on this computer, the narrator's voice for the news stories.

    uv run scripts/chatterbox-server.py

Serves on localhost:8004 for news_voice.py and labs_prompts/presenter_voice.py. It clones
the voice of a reference clip: a Fish Audio voice's sample (a URL), or a clip in .voices/
(wav or mp3, about 10 seconds of one person talking). Each model downloads on its first
use (a few GB), with HF_TOKEN from .env when it's there.

    GET  /voices   the clips in .voices/
    POST /tts      {text, language, reference, model, exaggeration, cfg_weight,
                    temperature} → wav, with the seconds it took in X-Seconds

    reference: "clip:<path in .voices/>" or an http(s) URL, downloaded once

Models: turbo (English, faster) and multilingual (23 languages). A line that isn't
English goes to multilingual.
"""

import hashlib
import inspect
import io
import json
import os
import re
import threading
import time
import traceback
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

import soundfile as sf
import torch

ROOT = Path(__file__).resolve().parent.parent

# Hugging Face's token, for faster model downloads, before anything reads it
_env = ROOT / ".env"
if "HF_TOKEN" not in os.environ and _env.exists():
    _token = re.search(r"^HF_TOKEN=(.+)$", _env.read_text(), re.M)
    if _token:
        os.environ["HF_TOKEN"] = _token[1].strip().strip("\"'")
VOICES = ROOT / ".voices"
DOWNLOADS = VOICES / ".downloads"
PORT = 8004
AUDIO = {".wav", ".mp3", ".m4a", ".flac", ".ogg"}

# A Mac's processor beats its GPU here (on an M2, 18 s against 41 s for a
# 3 second line), so the GPU only when it's CUDA, unless CHATTERBOX_DEVICE says
DEVICE = os.environ.get("CHATTERBOX_DEVICE") or (
    "cuda" if torch.cuda.is_available() else "cpu"
)

# The models were saved on CUDA, so load them onto whatever this computer has
_torch_load = torch.load
torch.load = lambda *args, **kwargs: _torch_load(
    *args, **{"map_location": torch.device(DEVICE), **kwargs}
)

models: dict = {}
# One generation at a time: the model isn't safe to share between threads
lock = threading.Lock()


def model(name: str):
    if name not in models:
        print(f"Loading Chatterbox {name} on {DEVICE}…")
        if name == "turbo":
            from chatterbox.tts_turbo import ChatterboxTurboTTS

            models[name] = ChatterboxTurboTTS.from_pretrained(device=DEVICE)
        else:
            from chatterbox.mtl_tts import ChatterboxMultilingualTTS

            models[name] = ChatterboxMultilingualTTS.from_pretrained(
                device=DEVICE, t3_model="v3"
            )
    return models[name]


def clips() -> list[str]:
    if not VOICES.exists():
        return []
    return sorted(
        str(p.relative_to(VOICES))
        for p in VOICES.rglob("*")
        if p.suffix.lower() in AUDIO and DOWNLOADS not in p.parents
    )


def clip(name: str) -> Path:
    path = (VOICES / name).resolve()
    if VOICES.resolve() not in path.parents or not path.is_file():
        raise ValueError(f"No clip {name} in .voices/")
    return path


def reference(ref: str | None) -> str | None:
    """A local path for a reference: a clip in .voices/, or a downloaded URL"""
    if not ref:
        return None
    if ref.startswith("clip:"):
        return str(clip(ref[5:]))
    if urlparse(ref).scheme not in ("http", "https"):
        raise ValueError(f"Not a clip or a URL: {ref}")
    suffix = Path(urlparse(ref).path).suffix or ".mp3"
    path = DOWNLOADS / f"{hashlib.sha1(ref.encode()).hexdigest()}{suffix}"
    if not path.exists():
        DOWNLOADS.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(ref, timeout=30) as response:
            path.write_bytes(response.read())
    return str(path)


def say(body: dict) -> bytes:
    language = body.get("language", "en").split("-")[0]
    # Turbo speaks English only: other languages go to multilingual
    name = body.get("model")
    if (name, language) != ("turbo", "en"):
        name = "multilingual"
    tts = model(name)
    options = {
        "audio_prompt_path": reference(body.get("reference")),
        "language_id": language,
        "exaggeration": body.get("exaggeration"),
        "cfg_weight": body.get("cfg_weight"),
        "temperature": body.get("temperature"),
    }
    # Only what this model's generate() takes, leaving out what wasn't given
    accepted = inspect.signature(tts.generate).parameters
    options = {k: v for k, v in options.items() if k in accepted and v is not None}
    with lock:
        wav = tts.generate(body["text"], **options)
    buffer = io.BytesIO()
    sf.write(buffer, wav.squeeze(0).cpu().numpy(), tts.sr, format="WAV")
    return buffer.getvalue()


class Handler(BaseHTTPRequestHandler):
    def send(self, status: int, body: bytes, kind: str, headers: dict | None = None):
        self.send_response(status)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(body)))
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def fail(self, error: Exception):
        traceback.print_exc()
        self.send(500, str(error).encode(), "text/plain; charset=utf-8")

    def do_GET(self):
        path = unquote(urlparse(self.path).path)
        try:
            if path == "/voices":
                return self.send(200, json.dumps(clips()).encode(), "application/json")
            self.send(404, b"Not found", "text/plain")
        except Exception as error:
            self.fail(error)

    def do_POST(self):
        if urlparse(self.path).path != "/tts":
            return self.send(404, b"Not found", "text/plain")
        try:
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            start = time.time()
            audio = say(body)
            seconds = time.time() - start
            print(f"{seconds:5.1f}s  {body['text']}")
            self.send(200, audio, "audio/wav", {"X-Seconds": f"{seconds:.2f}"})
        except Exception as error:
            self.fail(error)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    VOICES.mkdir(exist_ok=True)
    print(f"Chatterbox on http://localhost:{PORT} ({DEVICE}), clips in {VOICES}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
