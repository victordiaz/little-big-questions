# BFL Challenge: Train a Style, Tell a Story

## Submission

**The film:** `film.mp4` (61 seconds, 1280x704) — "Why are Ukraine and Russia fighting?" explained for kids, in the Balthazar cartoon style, part of the Little Big Questions news show.

**The LoRA:** https://huggingface.co/jurecerkez/baltazar-style-lora

**6 training images:** in `training_images/` — img01, img06, img11, img16, img21, img25

**Base vs. LoRA pair:** `base_vs_lora.jpg` — same prompt and seed, Klein Base on the left, with LoRA on the right

## Three lines

**Style:** flat 1960s Zagreb Film hand-drawn cartoon, the Professor Balthazar look (thick black outlines, flat muted colours, simple round faces).

**Data:** 23 frames extracted and cleaned from three Zagreb Film cartoon episodes on YouTube, captioned with Nebius Token Factory vision model.

**Checkpoint:** final 2,000-step checkpoint (`baltazar-style-lora.safetensors`), rank-32 LoRA on FLUX 3 Image Klein Base, trigger `bltzr style`.

## What we built

The LoRA gives Klein a hand-drawn 2D cartoon style it cannot produce out of the box. The film uses that style to answer a real question a kid might ask: "Why are Ukraine and Russia fighting?" In four illustrated steps, the story explains the background honestly, shows that different people see the situation differently, points to people who are helping, and ends with a question back to the viewer. The style holds across all four scenes — thick outlines, flat colours, simple faces.

This style is part of **Little Big Questions**, a news show for kids that lives in a cozy 90s bedroom (Blender + React + three.js). On the CRT, Olive the owl presents real news rewritten for kids — Tavily finds it, Nemotron rewrites it, FLUX draws and animates it, Chatterbox narrates it.
