# ![Little Big Questions](docs/images/logo.svg)

Little Big Questions helps kids make sense of the big, sometimes scary things happening in the world. We take real news, like elections, wars, climate, or inequality, and explain it in friendly, cartoon-style stories that are honest without being frightening. The goal isn’t to shield kids from the world, but to help them understand that it’s complicated, that people see things differently, and that their questions matter.

The show lives in a cozy 90s kid's bedroom you can explore in the browser. Switch on the old CRT and Olive the owl presents the day's news: each story answers one question a kid might ask, in four short illustrated steps. The stories are today's real news. An agent finds them, rewrites them for kids, draws and animates them, and narrates them.

**▶ See it live:** http://n403p14bd4x9mlhtimgg4yad.159.69.45.13.sslip.io/

**What we used**

- **Blender, driven by Claude Code over MCP**, to rebuild the bedroom from a single AI-generated reference image, then exported to glTF
- **React, three.js, React Three Fiber and drei**, with postprocessing for the CRT effect, built with Vite
- **FLUX 3 Image** by Black Forest Labs for the room's textures and posters
- **FLUX 3 Klein** for the story images, with **a Balthazar style LoRA** we trained with AI Toolkit on a Nebius GPU
- **FLUX 3 Video** to animate each story image
- **Tavily** to find today's news
- **NVIDIA Nemotron 3.5 Super VL** on Nebius Token Factory to rewrite the news for kids
- **MiniCPM-V** on Nebius Token Factory to caption the LoRA's training frames
- **Chatterbox** by Resemble AI, run locally, for Olive's voice and the narration

The logo, the presenter and the show each started as a small experiment under `/labs`.

<table>
  <tr>
    <th width="50%">The bedroom, in 3D</th>
    <th width="50%">▶ The film</th>
  </tr>
  <tr>
    <td><img src="docs/images/app-demo.gif" alt="The app: the camera leaves the isometric view of the bedroom, passes the posters, sits down at the TV, and Olive the owl presents the news"></td>
    <td><a href="bfl-challenge/film.mp4"><img src="docs/images/film-poster.jpg" alt="A still from the film, in the Balthazar style. Click to watch."></a></td>
  </tr>
  <tr>
    <td>The React + three.js app. Press <b>Watch TV</b>: the camera leaves the isometric view, passes the team and partner posters, sits down at the CRT, and Olive the owl presents the news.</td>
    <td><a href="bfl-challenge/film.mp4"><b>Watch "Why are Ukraine and Russia fighting?"</b></a> (61 seconds), our entry for the Black Forest Labs challenge <i>Train a Style, Tell a Story</i>, drawn in a 1960s Zagreb Film cartoon style from a LoRA we trained on FLUX 3 Klein. Details in <a href="#bfl-challenge-train-a-style-tell-a-story">BFL Challenge</a>.</td>
  </tr>
</table>

This README walks through how we got here, step by step.

## Contents

1. [The pipeline at a glance](#the-pipeline-at-a-glance)
2. [Step 1: the reference image](#step-1-the-reference-image)
3. [Step 2: building the room in Blender over MCP](#step-2-building-the-room-in-blender-over-mcp)
4. [Step 3: textures and posters with FLUX](#step-3-textures-and-posters-with-flux)
5. [Step 4: brand posters and the DGX Spark](#step-4-brand-posters-and-the-dgx-spark)
6. [Step 5: exporting to glTF](#step-5-exporting-to-gltf)
7. [Step 6: the React + three.js viewer](#step-6-the-react--threejs-viewer)
8. [Step 7: matching Blender's lighting](#step-7-matching-blenders-lighting)
9. [Step 8: the TV, camera shots and the CRT effect](#step-8-the-tv-camera-shots-and-the-crt-effect)
10. [Step 9: Little Big Questions and the labs](#step-9-little-big-questions-and-the-labs)
11. [Step 10: the logo, the intro and the outro](#step-10-the-logo-the-intro-and-the-outro)
12. [Step 11: Olive, the presenter](#step-11-olive-the-presenter)
13. [Step 12: the show on the bedroom TV](#step-12-the-show-on-the-bedroom-tv)
14. [Step 13: today's news, made for kids](#step-13-todays-news-made-for-kids)
15. [Step 14: a cartoon style of our own, a Klein LoRA](#step-14-a-cartoon-style-of-our-own-a-klein-lora)
16. [BFL Challenge: Train a Style, Tell a Story](#bfl-challenge-train-a-style-tell-a-story)
17. [Project layout](#project-layout)
18. [Running and regenerating](#running-and-regenerating)
19. [Credits](#credits)

## The pipeline at a glance

```mermaid
flowchart LR
    ref["Reference image<br/>(4 views of the room)"] --> blender
    subgraph blender["Blender 5.2 (driven over MCP)"]
        direction TB
        py["Python via bpy<br/>blender/room_helpers.py"] --> scene["blender/retro_bedroom.blend"]
        scene --> render["EEVEE render<br/>blender/renders/room_iso.png"]
    end
    flux["FLUX 3 Image API<br/>tools/flux_image.py"] -->|"posters, blanket,<br/>carpet, labels…"| blender
    web["Logos + press photos<br/>images/refs/"] -->|"--image references"| flux
    scene -->|"glTF export"| glb["retro_bedroom.glb"]
    news["News pipeline<br/>tools/news_*.py"] -->|"story videos,<br/>news.json"| app
    glb --> app["React + three.js app<br/>room-viewer/"]
```

Everything was built from code: Claude Code drove the open Blender through the [MCP for Blender](https://github.com/ahujasid/blender-mcp) add-on (running `bpy` Python inside Blender and taking screenshots to check its work), called the FLUX API for images, and wrote the web app.

## Step 1: the reference image

The starting point was one generated image showing the same bedroom from four angles: top, front, side and isometric. It set the brief: a teal wall with a window, a lavender wall full of pixel-art posters and glow-in-the-dark stars, a CRT on a wooden dresser, a bed with a zigzag quilt, a lava lamp, and a floor covered in game cartridges, toy blocks and cardboard boxes.

![Reference image](docs/images/reference.jpg)

Reading the four views together gave the floor plan:

```mermaid
flowchart TB
    subgraph back["Back wall (lavender): moon + stars, posters"]
        direction LR
        ns["Nightstand<br/>lava lamp, boombox"]
        bed["Bed<br/>headboard against wall"]
    end
    subgraph left["Left wall (teal)"]
        direction TB
        win["Window with blinds"]
        dresser["Dresser + CRT TV<br/>facing into the room"]
    end
    floor["Floor: console, controllers, cartridges,<br/>toy blocks, cardboard boxes"]
    left --- floor
    back --- floor
```

## Step 2: building the room in Blender over MCP

The room is 4 × 4 m with 2.6 m walls, modelled entirely from simple primitives in a low-poly style. A small helper module, [`blender/room_helpers.py`](blender/room_helpers.py), gives every script the same building blocks (`box`, `plane`, `cyl`, `mat`, `img_mat`), so each step is a short Python snippet sent to Blender:

```python
exec(open("blender/room_helpers.py").read())
wood = mat("Wood", (0.55, 0.3, 0.13), 0.6)
box("Dresser", 0.0, 0.55, 1.95, 3.35, 0.06, 0.85, wood, bevel=0.01)
```

The room went up in layers, checking a render after each one:

![Blender build progression](docs/images/blender-progress.jpg)

1. **Shell and light.** Floor slab, two walls (cream shell with a thin painted inner skin), a boolean cut for the window, venetian blinds, a warm low sun shining through the window and a dusky purple world.
2. **Furniture.** Dresser with drawers and knobs, CRT TV with a VCR, and the bed. The quilt is a subdivided box with jittered vertices and flat shading for the low-poly folds.
3. **Walls.** Six posters, a nightstand with a lava lamp (emissive blobs plus a point light) and a boombox, glow-in-the-dark stars and a crescent moon extruded from 2D outlines.
4. **Clutter.** A console with two controllers and Bézier cables, around 40 cartridges with pixel-art labels, toy blocks scattered by a seeded random placer that avoids the furniture, and four cardboard boxes (two open, with flaps and contents).

The final EEVEE render (AgX view transform, orthographic camera matching the reference's isometric angle):

![Blender render](docs/images/blender-render.jpg)

## Step 3: textures and posters with FLUX

All artwork came from the [FLUX 3 Image](https://docs.bfl.ai/flux_3/flux3_image_overview) API through [`tools/flux_image.py`](tools/flux_image.py). Jobs ran in parallel (the account allows 8 at a time), each into its own folder under `images/room/`.

![Generated posters](docs/images/posters.jpg)

![Generated textures](docs/images/textures.jpg)

Two requests needed a second try: one hit the 8-job concurrency limit, and the first TV screen prompt was moderated as "Protected Content" for being too close to a famous platformer, so it was rewritten as an *original* 8-bit game. When the first quilt pattern came out too blue, it was regenerated with "mostly teal" in the prompt.

## Step 4: brand posters and the DGX Spark

Next came three brand posters (NVIDIA, Nebius, Black Forest Labs) and an NVIDIA DGX Spark on the dresser. `flux_image.py` gained an `--image` option so FLUX could edit from reference images. Each prompt passed the real logo plus one of the existing posters as a style reference, referred to in the prompt as `<ref_image_0>`, `<ref_image_1>`.

```mermaid
flowchart TB
    logo["Logo from the web<br/>(PNG, transparent)"] --> prep["Flatten on white,<br/>pad to ≥ 256 × 256"]
    styleRef["Existing poster<br/>(style reference)"] --> edit
    prep --> edit{"FLUX 3 edit<br/>images: [logo, style]"}
    edit -->|"ok"| check{"Text still smooth?"}
    check -->|"yes"| pix["Pixelate the text band<br/>(Pillow)"]
    check -->|"no"| done["Poster"]
    pix --> done
    edit -->|"moderated:<br/>Protected Content"| bg["FLUX: background only,<br/>no logos"]
    bg --> comp["Pixelate the real logo<br/>and composite it on top"]
    comp --> done
```

What happened with each:

- **Nebius** worked as a straight edit, using the wordmark and symbol as references.
- **Black Forest Labs** worked, but the wordmark came back as smooth text, so the bottom band was pixelated to match the rest.
- **NVIDIA** was moderated twice. FLUX painted only the background (a glowing chip and circuit traces), and the real logo and wordmark were pixelated and composited on top.
- The API rejects reference images smaller than 256 × 256 px, so the long, thin wordmarks were padded onto a white canvas first.

Later, three more posters joined the partner corner:

- **Tavily** (the news agent's search engine) worked as a straight edit too: its arrow mark and wordmark from LobeHub Icons, flattened on white, plus the Nebius poster as the style reference. It hangs on the back wall after Black Forest Labs. Rocket and both Dragon posters moved right to make room, with the gaps evened out to 12 cm.
- **The team** replaced the "Game Heroes" poster next to Nebius: FLUX turned a photo of the three of us into waving 16-bit heroes, with "Game Heroes" as the style reference, under the title "Little Big Questions, the team". The photo itself isn't in the repository. The object is now `PosterTeam`.
- **NEMOTRON** was added under the NVIDIA wordmark, the same way the wordmark was: Pillow draws the word without antialiasing, scales it up 6× with nearest-neighbour so its blocks match the pixel size of the letters above, and composites it in NVIDIA green with a dark shadow (`images/room/poster_nvidia/nvidia_poster_nemotron.png`).

![Logo to poster](docs/images/brand-posters.jpg)

The **DGX Spark** is a beveled champagne box at 1.4× real size (150 × 150 × 50.5 mm), so it reads next to the CRT. Its front and back are a crop of the real metal-foam front from PNY's press photos. The TV also got a **power button with an LED** and **rabbit-ear antennas** (scaled down after a first version came out too big).

![DGX Spark](docs/images/dgx-spark.jpg)

## Step 5: exporting to glTF

The scene is exported to `room-viewer/public/models/retro_bedroom.glb` (about 3.3 MB, JPEG textures). A few things had to change first, because glTF only understands UV-mapped image textures:

| Blender setup | Problem in glTF | Fix |
|---|---|---|
| Cardboard: box projection in object space | not supported | real UVs computed per face from object-space position |
| Cartridge labels: `Generated` coords + Mapping into a 4 × 3 label sheet | not supported | UVs set from the box's local coords; Mapping exported as `KHR_texture_transform` |
| Controller cables: Bézier curves | curves are not meshes | converted to meshes |
| Bevel and boolean modifiers | modifiers are not exported | `export_apply=True` |
| Lights | Blender watts don't map 1:1 | not exported; re-created in the app (see step 7) |

Object names are kept, so the app can find parts by name: `TVScreenImg`, `TVPowerLED`, `TVPowerButton`, `TVBody`.

## Step 6: the React + three.js viewer

`room-viewer/` is a Vite app using [React Three Fiber](https://r3f.docs.pmnd.rs/), [drei](https://drei.docs.pmnd.rs/) and [@react-three/postprocessing](https://react-postprocessing.docs.pmnd.rs/).

```mermaid
flowchart TB
    App["App.jsx<br/>state: shot, tvOn, muted, videoSrc<br/>HUD buttons, drag-and-drop video"]
    App --> Canvas
    subgraph Canvas["&lt;Canvas&gt; (shadows, AgX)"]
        Rig["CameraRig.jsx<br/>CameraControls + SHOTS"]
        Lights["Lights<br/>ambient, sun, lava lamp"]
        Room["Room.jsx<br/>useGLTF(retro_bedroom.glb)"]
        Post["EffectComposer<br/>N8AO + AgX tone mapping"]
        Room --> TV["TVVideo<br/>video texture + CRT shader<br/>power animation, glow light"]
        TV --> CRT["crtMaterial.js"]
        TV --> Snd["crtSound.js<br/>(Web Audio)"]
    end
    App --> Info["InfoPanel.jsx<br/>renders README.md"]
    Rig -- "onTvChange" --> App
    Room -- "onToggleTV (click)" --> App
```

The Video channel plays a video of your own:

- open the app with `?video=<url>` (the server must allow cross-origin loading), or
- drag a video file onto the page.

The video is cropped to the screen's 4:3 shape instead of being stretched.

## Step 7: matching Blender's lighting

The first web version used guessed lights and looked off. Instead of tuning by eye, the Blender values were ported with unit conversions, then the result was checked by sampling pixel colours against the Blender render.

![Lighting iterations](docs/images/lighting-iterations.jpg)

| Light | Blender | three.js |
|---|---|---|
| World | colour (0.2, 0.18, 0.34), strength 0.6 | `ambientLight`, intensity 0.6·π (Blender radiance L gives albedo·L, three gives albedo·I/π) |
| Sun | 7 W/m², rotation (63°, 0°, −100°) | `directionalLight`, intensity 7, direction (0.877, −0.454, 0.155) |
| Lava lamp | 40 W point | `pointLight`, intensity 40 / 4π |
| TV glow | 25 W area light, 0.45 m | `rectAreaLight`, 25 / (0.45²·π), scaled by the screen's power |
| View transform | AgX | `ToneMapping` effect, AGX mode |

Three things closed the remaining gap:

- **Ambient occlusion.** N8AO stands in for EEVEE's raytraced AO and bounce light, darkening corners, wall joins and the area under the bed.
- **Unlit emitters.** The lava lamp, stars, moon and window pane are drawn with `MeshBasicMaterial` at their emission colour. As lit materials, the nearby point light blew them out to white.
- **Area light for the TV.** A point light 10 cm from the screen lit the bezel light grey. A forward-facing rect light behaves like Blender's area light.

Where the samples landed: ground, walls and floor are within a few RGB values of the Blender render.

## Step 8: the TV, camera shots and the CRT effect

### Camera shots

`CameraRig.jsx` uses drei's `CameraControls`. Its `setLookAt(…, true)` animates the move and returns a promise when the camera arrives, which is what lets the TV switch on at the right moment. Shots: **Overview** (fitted to the window), **Watch TV**, **Posters**, **DGX Spark** and **From bed**.

![Camera shots](docs/images/app-shots.jpg)

The **Watch TV** shot runs as a sequence:

```mermaid
sequenceDiagram
    actor User
    participant App
    participant Rig as CameraRig
    participant TV as TVVideo
    User->>App: click "Watch TV"
    App->>Rig: shot = "watchTV"
    Rig->>Rig: setLookAt(floor in front of TV, animate)
    Note over Rig: camera flies in from the overview
    Rig-->>Rig: promise resolves on arrival
    Rig->>App: onTvChange(true) after 400 ms
    App->>TV: on = true
    TV-->>TV: play video, power-on animation, thump + static
```

If another shot is chosen mid-flight, a run counter discards the stale promise so the TV doesn't switch on unexpectedly. The first version also switched the set off when the move started, which made a TV that was already on flicker off and back on; now the shot only switches it on. Since [step 12](#step-12-the-show-on-the-bedroom-tv), Watch TV also turns the sound on, lights up the posters and opens the Little Big Questions programme.

### This README, inside the app

The **i** button in the top-right corner opens this same `README.md` in a full-screen overlay above the scene, so GitHub and the app always show the same text. The text sits in a centred column, with a sticky table of contents on the side that is built from the headings and highlights the section you are reading. The README's own "Contents" list is dropped in the app, since the sidebar replaces it. `InfoPanel.jsx` imports the file with Vite's `?raw` suffix and renders it with `react-markdown` + `remark-gfm` (tables) + `rehype-slug` (heading anchors for the table of contents). Image paths like `docs/images/…` are mapped to bundled URLs with `import.meta.glob`, and `mermaid` code blocks are drawn with Mermaid (loaded only when the panel first opens), the same way GitHub draws them. Links to repo files become clickable once `REPO_URL` in `InfoPanel.jsx` is set.

### Switching on and off

Clicking the TV (or the power button in the TV panel) toggles it. The app opens with the set off. The LED turns green or red right away, while a `power` value animates between 0 and 1: 0.75 s to switch on, 0.45 s to switch off. That value drives the shader and the TV's glow on the room.

```mermaid
stateDiagram-v2
    Off --> Dot: switch on
    Dot --> Line: power 0 → 0.35<br/>dot widens
    Line --> Open: power 0.35 → 1<br/>line opens up, flash fades
    Open --> On
    On --> Collapse: switch off
    Collapse --> Off: power 1 → 0<br/>reverse, phosphor dot fades<br/>video pauses at 0
```

![CRT power sequence](docs/images/crt-sequence.jpg)

### The CRT shader

`crtMaterial.js` replaces the screen's material with a `ShaderMaterial` that layers:

- barrel distortion (the bulging tube),
- the power collapse and the burning-hot thin beam,
- slight RGB fringing (chromatic aberration),
- extra contrast and saturation so AgX doesn't wash it out,
- 240 scanlines that fade out when too dense on screen (to avoid moiré),
- an aperture-grille RGB stripe mask,
- vignette, flicker and noise,
- a faint glass reflection when off.

With sound on, `crtSound.js` synthesizes the power sounds with Web Audio: a low thump and static when switching on, a falling zap when switching off.

## Step 9: Little Big Questions and the labs

`/labs` is a page of small experiments for the show, each one an entry that leads to its own page. There are two so far, **Logo** and **Presenter**. Adding one is a page component plus a row in `EXPERIMENTS` in `src/labs/Labs.jsx`.

There is no router library: `main.jsx` looks at the path and lazy-loads either the bedroom or the labs, so the labs pages don't download three.js and the bedroom doesn't download the labs.

Every experiment starts with FLUX concepts next to things built in code. The prompts live in one file, `labs_prompts/prompts.tsv` (`<experiment>/<id>`, aspect ratio, prompt), and `labs_prompts/generate.sh` runs them through `flux_image.py`, six at a time, into `room-viewer/src/labs/assets/<experiment>/<id>/`. The pages pick the images up with `import.meta.glob`, show each with its prompt, and keep older versions when a prompt is run again. The first batch was 16 images: six logo directions, and four presenter characters, each as a character sheet and at a news desk, plus an empty studio plate and the show on a 90s CRT.

![Four presenters from FLUX: Olive the owl, Pip the TV-robot, Remy the fox, Quill the question](docs/images/presenter-cast.jpg)

## Step 10: the logo, the intro and the outro

The strongest FLUX direction was a coral question mark whose dot is a smiling Earth. It was redrawn as SVG (`src/labs/brand.jsx`) so it scales and animates: the globe's continents are a strip that slides behind a circular clip, which reads as the planet turning, and its eyes blink.

**The intro** is a five-second news-programme opener in pure CSS animation, timed with delays: the camera starts tight on the globe and pulls back, an orbit ring draws around it, the question mark draws itself, "BIG" slams in with a flash and a shake, "Questions" hops in letter by letter, and the tagline fades up. **The outro** closes the show with the same background: "That's all for today!", the stacked logo, "Keep asking little big questions", and Olive peeking up from the corner to wave. Both come in three looks (Studio, Daylight, Pixel CRT) and replay by remounting with a new React key. Both play a four-second orchestral jingle, which ends just as the intro's tagline lands.

**Lockups.** One `<Lockup>` component draws the four layouts the show needs (stacked, horizontal, one line, mark only) in four tones (colour, reversed on navy, one colour, white), all scaled from a single size. The Logo page also shows clear space, the smallest sizes (below 32 px the globe drops its face and stops turning), and the logo in use: a corner bug over video in any corner, a lower third, an end card, a thumbnail, a browser tab and avatars, and stickers.

![The outro and the lockups](docs/images/labs-logo.jpg)

## Step 11: Olive, the presenter

Of the four FLUX presenters, **Olive the owl** was the one coded: an SVG character (`src/labs/Olive.jsx`) who blinks, bobs, moves her beak while talking, glances at the story screen, and changes expression with the story. Hard topics such as war get softer brows lifted in the middle and a small head tilt, concerned and never frightened. While explaining, she raises a wing towards the screen.

She is drawn for desk framing. The first version was a full owl behind a desk, and it broke in several places: the desk only hid her bottom tenth, so her belly showed as an egg-shaped second face, one wing was hidden behind her body, and her hands hung below the desk line. The redraw ends exactly at the desk's front edge, with her wing tips resting on it. Olive and the desk now sit in one anchored box so they always move together, her speech bubble points at her beak, and the question banner moved to the right so it no longer covers the desk logo.

![The studio, and the same set at 4:3 on a CRT](docs/images/presenter-studio.jpg)

**The show** (`src/labs/show.jsx`) is a rundown of stories, each a single question: today's news from `src/labs/news.json` (written by `news_publish.py`), or the evergreen stories in `src/labs/stories.json` when there is no news. Every story runs three segments; a story without its own video skips the video:

```mermaid
flowchart LR
    intro["Intro<br/>Olive asks the question at the desk"] --> video["Story video<br/>fills the screen, Olive in a corner bubble"]
    video --> outro["Wrap-up<br/>people see it differently,<br/>a question back to the viewer"]
    outro -->|"next story"| intro
    outro -->|"after the last story"| closing["Outro"]
```

Everything inside the studio is sized in container units, so the same set works at 16:9 on the labs page and at 4:3 on the TV.

**Her voice.** `tools/presenter_voice.py` voices each intro and wrap-up line with [Chatterbox](https://github.com/resemble-ai/chatterbox) running locally, cloning the sample clip of a Fish Audio voice ("kids"). The sample's link is signed for an hour, so the script fetches a fresh one from the Fish Audio API on every run. It writes one wav per line to `public/voices/olive/` and records each line's text and length in `src/labs/olive-voice.json`. A line is redone only when its text changes, and a line edited after it was recorded stays silent until it is voiced again. On a Mac's CPU each line takes 20 to 80 seconds.

During playback the bubble text follows the audio and the beak moves while it plays. If the browser blocks audio, the line types out at speaking pace instead. One bug is worth recording: React StrictMode starts each effect twice in development, so the first attempt to play was aborted, and its fallback started a typing timer that was never stopped. That stale timer kept writing the previous line into the bubble, which flickered empty several times a second. Now nothing from a cancelled line can touch the bubble.

## Step 12: the show on the bedroom TV

The labs pages play live on the bedroom's CRT: the intro, the show and the outro are real React DOM laid onto the screen in 3D, not a video or a texture.

```mermaid
flowchart LR
    App["App.jsx<br/>channel, show state"] -->|"createPortal"| el["a plain &lt;div&gt;<br/>Intro · Newsroom · Outro"]
    el --> Feed["TVFeed (Room.jsx)<br/>CSS3DObject on the screen"]
    Feed --> R["CSS3DRenderer<br/>drawn over the WebGL canvas"]
    Feed --> Glass["screen material → dark glass<br/>TV glow light follows power"]
```

`App` renders the current programme into a plain `<div>` through a React portal. `TVFeed` measures the screen mesh, places that `<div>` on the glass as a `CSS3DObject`, and draws it with three's `CSS3DRenderer`, which re-applies a CSS 3D transform every frame so the page stays glued to the screen as the camera moves. The screen's own material becomes dark glass, so the tube shows black when the picture collapses.

Two dead ends came first. drei's `<Html transform>` mounted an empty box, because it creates a second React root inside the three.js renderer and React 19 StrictMode unmounted it mid-render. And the first `CSS3DObject` version vanished whenever the channel changed, because StrictMode's test unmount removed it from the scene and it was only ever added once.

Since the picture is HTML rather than a texture, the CRT shader can't reach it, so the CRT look is redone in CSS (`.tv-feed` in `styles.css`): scanlines, glass glare, darker curved edges, a slight flicker, the dot → line → picture power animation, and a burst of static on every channel change except the outro, which cuts in clean. The trade-off is that the page always draws on top of the 3D scene, which is fine for the current camera shots.

**The TV panel** (top right, `src/TVControls.jsx`) is the remote control. It's a debugging tool, so it only shows when the URL has `?debug`, and its keys only work then:

| Control | What it does | Key |
|---|---|---|
| Power, Sound | switch the set on or off, and mute or unmute, each labelled with its state | |
| Watch TV | fly to the TV and start the programme | |
| Video · Logo intro · News show · Outro | change channel | `1`–`4` |
| Look, Replay | pick the intro and outro look, and replay them with the jingle | `R` |
| Story, Segment | jump to any story or segment | |
| Prev, Running, Next | step through the show, or pause and resume it | `←` `→` space |
| Posters | light up the team and partner posters, without going on to the TV | |

`?channel=logo`, `?channel=show` or `?channel=outro` opens the app on that channel. Without one it opens on the logo. The Video channel plays a video passed with `?video=<url>` or dropped on the page.

**Watch TV** now opens the whole programme, starting with the posters of the people who made it:

```mermaid
sequenceDiagram
    actor User
    participant App
    participant Rig as CameraRig
    participant Room
    participant TV as TVFeed
    User->>App: click "Watch TV"
    App->>Rig: shot = "partners" (the poster corner)
    App->>Room: the team poster lights up (3 s)
    App->>Room: Nebius, NVIDIA, BFL, Tavily light up in a wave
    App->>Rig: shot = "watchTV"
    Rig->>App: on arrival, TV on
    App->>TV: logo intro + jingle (6 s)
    App->>TV: News show: today's stories<br/>(Olive's voice, narrated story videos)
    App->>TV: Outro + jingle, no static
    App->>TV: TV off after 7 s
```

The intro waits until the set is actually on, so it isn't missed during the camera move. Picking another channel or shot at any point cancels the rest of the sequence.

**The posters light up** in `Room.jsx`: each one's image doubles as its emission, so it brightens with its own colours, and its paper backing glows warm yellow and grows a little more than the poster, which draws a glowing border even around the dark ones. Each starts 250 ms after the one before and stays lit for 700 ms, so they overlap in a wave. The materials are cloned once per mesh: React StrictMode runs the setup twice in development, and a second clone left the animation driving materials that were no longer on screen. The "partners" shot frames the corner where the five posters hang and has no button of its own.

**The show ends.** After the last story's wrap-up the outro plays, Olive waves goodbye, and the set switches itself off 7 seconds later. Picking the Outro channel by hand leaves the set on.

![The programme on the bedroom TV](docs/images/tv-programme.jpg)

## Step 13: today's news, made for kids

The stories in the show come from the day's real news. Four scripts at the root of the repository take them from a search to the bedroom TV, each saving its work in `news/<date>/stories.json` so any step can be re-run on its own:

```mermaid
flowchart LR
    tavily["Tavily search<br/>news of the last day"] --> agent
    subgraph agent["news_agent.py · Nemotron 3.5 Super VL on Nebius"]
        direction TB
        pick["picks the most relevant<br/>international stories"] --> write["writes each for kids:<br/>3–5 steps of narration,<br/>image prompts, motion"]
        write --> olive["Olive's intro and wrap-up,<br/>topic, mood"]
    end
    agent --> klein["FLUX 3 Klein<br/>one image per step"]
    klein --> voice["news_voice.py<br/>Chatterbox, Dash's voice"]
    voice --> video["news_video.py<br/>FLUX 3 Video, one clip per step"]
    video --> mux["ffmpeg<br/>narration on top, clips joined"]
    mux --> publish["news_publish.py<br/>public/news/ + news.json"]
    publish --> oliveVoice["presenter_voice.py<br/>Olive's lines"]
    oliveVoice --> show["the show on the TV"]
```

**Finding the news.** `news_agent.py` runs two Tavily searches (`topic: "news"`, the last day by default) and drops duplicate URLs. Nemotron 3.5 Super VL, through Nebius Token Factory's OpenAI-compatible API, plays a senior international news editor: it picks the stories with global impact and skips local news, sports, gossip and opinion. `--count` sets how many (3 by default; 1 for testing).

**Writing for kids.** A second Nemotron call turns each story into 3 to 5 steps. The prompt carries the show's mission and its rules: short sentences a 7-year-old understands, hard words explained right away, facts without taking sides, no graphic details or death counts, different points of view, and the people who are helping. Each step has the narration, a self-contained image prompt (recurring characters described the same way every time, generic cartoon people instead of real politicians, no weapons or text) and a line about how the scene moves. A third call writes Olive's lines in her voice, picks the topic tab and her mood (gentle for scary news), and the accent colour follows the mood. Nemotron's answers are parsed as JSON, skipping any `<think>` block or code fence around them.

**Pictures.** Each image prompt, plus a shared style line, goes to FLUX 3 Klein (`flux_image.py --model klein`) at 16:9, six at a time.

**Narration.** `tools/chatterbox_server.py` runs Chatterbox locally (copied from the voice lab project and trimmed to the English models). `news_voice.py` clones the voice of a Fish Audio voice's sample, "Dash (PBS KIDS)" by default, downloaded once into `.voices/` because the sample's link expires. It records each step's length in `stories.json`. On a Mac's CPU a 15-second line takes about a minute.

**Video.** `news_video.py` makes one FLUX 3 Video clip per step in image-to-video mode, with two keyframes: the step's image as the first frame and the next step's image as the last, so the clips flow into each other instead of cutting. A clip lasts as long as its narration plus a beat, within FLUX's 5 to 20 seconds. ffmpeg then lays each step's narration over its clip, holding the last frame when the voice runs longer, and joins the clips into one video per story. Clips that exist are kept, so adding the narration later costs no FLUX credits.

**Into the show.** `news_publish.py` copies the story videos to `room-viewer/public/news/` and writes `src/labs/news.json`: Olive's lines, the video, and when each step starts, for the captions. When there is news, the show's rundown is today's news and it ends after it; the evergreen stories in `stories.json` come back only when there is none. A news story's video segment plays the narrated video with sound, shows each step's narration as a caption next to Olive's corner bubble, and moves on when the video ends. A story without its own video skips straight from the intro to the wrap-up; the Big Buck Bunny placeholder is gone. `presenter_voice.py` voices Olive's new lines in her own voice, the same way as the evergreen ones.

![A news story on the TV, with captions](docs/images/news-story.jpg)

## Step 14: a cartoon style of our own, a Klein LoRA

Out of the box, FLUX 3 Klein draws a generic cartoon. To give the stories a look of their own, a teammate taught it the flat, hand-drawn style of *Professor Balthazar*, the 1960s Zagreb Film cartoon, with a LoRA: a small adapter trained on top of the open-weights model. An AI agent did the whole job over SSH on a rented Nebius GPU, in about four hours and a few dollars of GPU time. The LoRA is on Hugging Face: [jurecerkez/baltazar-style-lora](https://huggingface.co/jurecerkez/baltazar-style-lora).

```mermaid
flowchart LR
    eps["3 Balthazar episodes<br/>yt-dlp"] --> frames["frames, 1 every 25 s<br/>deduped, cropped, no text"]
    frames --> captions["captions + trigger word<br/>MiniCPM-V on Nebius Token Factory"]
    captions --> train["AI Toolkit on Klein Base<br/>Nebius RTX PRO 6000"]
    train --> lora["baltazar-style-lora<br/>Hugging Face"]
    lora --> images["story images<br/>in the Balthazar style"]
    images --> video["news_video.py<br/>FLUX 3 Video"]
```

**The dataset.** Three episodes downloaded with yt-dlp, one frame every 25 seconds, deduplicated and cropped to 25 frames. A vision model on Nebius Token Factory (`openbmb/MiniCPM-V-4_5`) described what's in each frame, and each caption ends with the made-up trigger `bltzr style`, so the LoRA ties the look to that word rather than to the content.

**Training.** [AI Toolkit](https://github.com/ostris/ai-toolkit) by Ostris on `flux-3-image-klein-base` (the non-distilled model, a 29 GB download), on one NVIDIA RTX PRO 6000 Blackwell with 96 GB: rank 32, alpha 32, learning rate 1e-4, batch 1, 1024 px.

| Run | Images | Steps | Time | Final loss | Result |
|---|---|---|---|---|---|
| 1 | 25 | 1,000 | 18.5 min | ~0.73 | a generic flat cartoon, with fake lettering |
| 2 | 23 | 2,000 | 34.3 min | ~0.35 | the Balthazar look, no text: the one we use |

The fake lettering came from two training frames with text in them (a festival poster and a chair with a "B"). Dropping them and doubling the steps fixed both problems.

**What got in the way.** The GPU quota was 0, so a teammate created the VM by hand and the agent reached it through an SSH alias. AI Toolkit needed `torchaudio`, exact pinned versions of diffusers and transformers, and a patch to Klein's prompt encoding, which crashed on the first sample. The distilled Klein never downloaded (a Hugging Face Xet storage error), so the images are made with Klein Base plus the LoRA. Captioning moved from OpenRouter to Nebius Token Factory after a 404.

**Into the show.** The four images of "Why are Ukraine and Russia fighting?" were redrawn with the LoRA and dropped into `news/2026-10-18/why-are-ukraine-and-russia-fighting/`, replacing the Klein ones; `news_video.py` animated them again (the old clips are kept in a `backup-…` folder next to them). For the demo, the four narrated clips were also cut down to a 45-second version: the narration sped up 1.2× without changing its pitch and each clip sped up to match, with the captions in `news.json` retimed to fit.

The submission for the BFL challenge, with the finished film, is in the [next section](#bfl-challenge-train-a-style-tell-a-story).

The training frames come from copyrighted Zagreb Film episodes, so the LoRA is a hackathon experiment, not something to publish more widely until that's sorted out.

## BFL Challenge: Train a Style, Tell a Story

This project is an entry in the Black Forest Labs hackathon track **Media Generation: Train a Style, Tell a Story**. We trained a LoRA on FLUX 3 Image Klein to produce the flat hand-drawn cartoon look of 1960s Zagreb Film's Professor Balthazar, then used it to generate a film that answers a real kid's question.

### The style

Flat 1960s Zagreb Film hand-drawn cartoon, the Professor Balthazar look — thick black outlines, flat muted colours, simple round faces. The base Klein model cannot produce this look without the LoRA.

### Where the data came from

23 frames extracted and cleaned from three Zagreb Film cartoon episodes on YouTube. Deduplicated, cropped, and frames containing text were dropped (text in training images teaches the model fake lettering). Each frame was captioned by a vision model (MiniCPM-V-4\_5 on Nebius Token Factory) with content-only descriptions ending in the trigger word `bltzr style`.

### Which checkpoint

Final 2,000-step checkpoint (`baltazar-style-lora.safetensors`), rank-32 LoRA, learning rate 1e-4, AdamW, batch size 1, resolution 1024. Trained on FLUX 3 Image Klein Base (`black-forest-labs/flux-3-image-klein-base`) with AI Toolkit (Ostris), arch `flux3`, on an NVIDIA RTX PRO 6000 GPU rented from Nebius Cloud. Total training time: 34 minutes.

**LoRA on Hugging Face:** [jurecerkez/baltazar-style-lora](https://huggingface.co/jurecerkez/baltazar-style-lora)

### The film

[`bfl-challenge/film.mp4`](bfl-challenge/film.mp4) (61 seconds, 1280×704) — "Why are Ukraine and Russia fighting?", a four-step story in the Balthazar style that explains the background honestly, shows different points of view, points to people helping, and ends with a question back to the viewer. The style holds across all four scenes.

### Training images

6 of the 23 training images:

![img01](bfl-challenge/training_images/img01.jpg)
![img06](bfl-challenge/training_images/img06.jpg)
![img11](bfl-challenge/training_images/img11.jpg)
![img16](bfl-challenge/training_images/img16.jpg)
![img21](bfl-challenge/training_images/img21.jpg)
![img25](bfl-challenge/training_images/img25.jpg)

### Base vs. LoRA

Same prompt and seed. Klein Base on the left, with the LoRA on the right:

![Base vs LoRA](bfl-challenge/base_vs_lora.jpg)

## Project layout

```
.
├── README.md
├── blender/
│   ├── retro_bedroom.blend  # the Blender scene
│   ├── room_helpers.py      # bpy helpers used by every Blender snippet
│   └── renders/room_iso.png # EEVEE render
├── tools/                   # command-line tools, each a self-contained uv script
│   ├── flux_image.py        # FLUX 3 Image / Klein CLI (generate, or edit with --image)
│   ├── news_agent.py        # Tavily + Nemotron: today's stories, written for kids, FLUX Klein images
│   ├── news_voice.py        # narrates each step with Chatterbox
│   ├── news_video.py        # FLUX 3 Video clips per step, narration on top, joined with ffmpeg
│   ├── news_publish.py      # puts the stories in the show (public/news/, news.json)
│   ├── presenter_voice.py   # voices Olive's lines with Chatterbox
│   └── chatterbox_server.py # local Chatterbox TTS server on :8004
├── labs_prompts/
│   ├── prompts.tsv          # FLUX prompts for the labs concepts
│   └── generate.sh          # runs them through tools/flux_image.py
├── images/
│   ├── room/<name>/         # generated textures and posters
│   ├── refs/                # logos and DGX Spark press photos
│   └── logs/                # FLUX run logs (not in git)
├── docs/images/             # figures for this README
├── news/<date>/             # stories.json, step images, voices and videos (not in git)
└── room-viewer/             # React + three.js app
    ├── public/models/retro_bedroom.glb
    ├── public/news/         # today's story videos (news_publish.py, not in git)
    ├── public/audio/intro-jingle.mp3
    ├── public/voices/olive/ # Olive's recorded lines
    └── src/
        ├── main.jsx         # picks the bedroom or /labs from the path
        ├── App.jsx          # state, channels, the Watch TV programme, lights
        ├── Room.jsx         # model, TV click, LED, video, TVFeed (HTML on the screen)
        ├── TVControls.jsx   # the TV panel
        ├── CameraRig.jsx    # camera shots and the Watch TV sequence
        ├── crtMaterial.js   # CRT shader
        ├── crtSound.js      # synthesized power sounds
        ├── InfoPanel.jsx    # renders this README inside the app
        └── labs/
            ├── Labs.jsx         # /labs index and the EXPERIMENTS list
            ├── LogoLab.jsx      # /labs/logo
            ├── PresenterLab.jsx # /labs/presenter
            ├── brand.jsx        # globe, logo mark, wordmark, Lockup
            ├── Lockups.jsx      # lockup matrix and logo-in-use scenes
            ├── intro.jsx        # the logo intro and the outro
            ├── sting.js         # plays the jingle
            ├── Olive.jsx        # the presenter
            ├── show.jsx         # rundown, Newsroom, voice playback, captions
            ├── stories.json     # the evergreen stories and Olive's lines
            ├── news.json        # today's news (news_publish.py)
            ├── olive-voice.json # which lines are voiced
            ├── FluxGallery.jsx  # FLUX concepts with their prompts
            ├── assets/          # generated FLUX concepts
            └── labs.css
```

## Running and regenerating

**The app**

```sh
cd room-viewer
npm install
npm run dev
```

Open `http://localhost:5173/` for the bedroom (press **Watch TV**), `http://localhost:5173/?debug` for the TV panel, and `http://localhost:5173/labs` for the experiments.

**Images.** Set `BFL_API_KEY`, then:

```sh
# text to image
uv run tools/flux_image.py "Retro pixel art poster, a green dragon…" \
  --aspect-ratio 3:4 --out images/room/poster_x

# edit from references (paths or URLs, up to 10)
uv run tools/flux_image.py \
  "Pixel art poster in the style of <ref_image_1> with the logo from <ref_image_0>" \
  --image images/refs/logo.jpg --image images/room/poster_rocket/….png \
  --aspect-ratio 3:4 --out images/room/poster_y
```

**Labs concepts.** Add or edit a line in `labs_prompts/prompts.tsv`, then run the whole list, or only the ids that match a filter:

```sh
bash labs_prompts/generate.sh                    # everything
bash labs_prompts/generate.sh presenter/owl      # one experiment or concept
```

**Today's news.** Put `TAVILY_API_KEY`, `NEBIUS_API_KEY` and `BFL_API_KEY` in the environment or in a `.env` file at the root (git ignores it; `HF_TOKEN` there speeds up Chatterbox's model downloads). Start Chatterbox in another terminal, then run the steps in order:

```sh
uv run tools/chatterbox_server.py       # keep it running, on localhost:8004

uv run tools/news_agent.py --count 1    # find, pick and write the stories, draw the steps
uv run tools/news_voice.py              # narrate each step
uv run tools/news_video.py              # animate, add the narration, join
uv run tools/news_publish.py            # into the show
uv run tools/presenter_voice.py         # Olive's new lines
```

Each script works on the latest `news/<date>/stories.json` and skips what's already done. Useful options: `news_agent.py --no-images` to tune the writing first, `--only <story-id>` and `--force` on the voice and video scripts, and `news_video.py --audio` to let FLUX add its own sound under the narration.

**Olive's voice.** With Chatterbox running:

```sh
uv run tools/presenter_voice.py         # only new or changed lines, stories and news
uv run tools/presenter_voice.py --only war-intro --force
uv run tools/presenter_voice.py --model multilingual --exaggeration 0.7
```

**Model.** Edit `blender/retro_bedroom.blend`, then re-export with the same settings (run inside Blender; `//` is the folder of the `.blend`):

```python
bpy.ops.export_scene.gltf(
    filepath=bpy.path.abspath("//../room-viewer/public/models/retro_bedroom.glb"),
    export_format="GLB", export_apply=True, use_renderable=True,
    export_lights=False, export_cameras=False,
    export_image_format="JPEG", export_jpeg_quality=85,
)
```

## Credits

- **DGX Spark** product photos from the [PNY press image kit](https://www.pny.com/company/press-center/press-images/nvidia-dgx-spark).
- **Logos** from [Dashboard Icons](https://dashboardicons.com/) and [LobeHub Icons](https://lobehub.com/icons). NVIDIA, DGX Spark, Nemotron, Nebius, Black Forest Labs and Tavily are trademarks of their respective owners and are used here for a personal, non-commercial scene.
- **Posters, textures and labs concepts** generated with [FLUX 3 Image](https://docs.bfl.ai/) by Black Forest Labs; story images with FLUX 3 Klein and story videos with FLUX 3 Video.
- **The Balthazar style LoRA** trained by a teammate with [AI Toolkit](https://github.com/ostris/ai-toolkit) on a [Nebius AI Cloud](https://nebius.com/) GPU, from frames of *Professor Balthazar* by Zagreb Film.
- **News** found with [Tavily](https://www.tavily.com/) and written for kids by NVIDIA Nemotron 3.5 Super VL on [Nebius Token Factory](https://nebius.com/).
- **The narrator's voice** in the story videos made with Chatterbox, cloned from the sample of the [Fish Audio voice "Dash (PBS KIDS)"](https://fish.audio/m/0ace0d3ff3cd403e88e751d4d9485020/).
- **Jingle**: "Positive Orchestral Jingle" by sergequadrado, [Freesound #455606](https://freesound.org/s/455606/).
- **Olive's voice** made with [Chatterbox](https://github.com/resemble-ai/chatterbox) by Resemble AI, cloned from the sample of the [Fish Audio voice "kids"](https://fish.audio/m/7c9a5cb2f8914bd1963d4237e540c036/).
- **Fonts**: [Fredoka](https://fonts.google.com/specimen/Fredoka), [Nunito](https://fonts.google.com/specimen/Nunito) and [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) from Google Fonts.
