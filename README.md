# Retro Bedroom

A cozy 90s gamer bedroom, rebuilt in Blender from a single AI-generated reference image, textured with images from FLUX, and shipped as an interactive React + three.js app. The CRT TV in the app plays a real video, switches on and off like a tube set, and the camera can fly in to watch it.

![The app: overview](docs/images/app-overview.jpg)

The bedroom is also the set for **Little Big Questions**, a news show that helps kids make sense of the big, sometimes scary things happening in the world (elections, wars, climate, inequality) with friendly cartoon stories that are honest without being frightening. Its logo, its presenter and the show itself were worked out as small experiments under `/labs`, and now play on the bedroom's CRT.

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
14. [Project layout](#project-layout)
15. [Running and regenerating](#running-and-regenerating)
16. [Credits](#credits)

## The pipeline at a glance

```mermaid
flowchart LR
    ref["Reference image<br/>(4 views of the room)"] --> blender
    subgraph blender["Blender 5.2 (driven over MCP)"]
        direction TB
        py["Python via bpy<br/>room_helpers.py"] --> scene["retro_bedroom.blend"]
        scene --> render["EEVEE render<br/>renders/room_iso.png"]
    end
    flux["FLUX 3 Image API<br/>flux_image.py"] -->|"posters, blanket,<br/>carpet, labels…"| blender
    web["Logos + press photos<br/>images/refs/"] -->|"--image references"| flux
    scene -->|"glTF export"| glb["retro_bedroom.glb"]
    bbb["Big Buck Bunny<br/>(first 60 s)"] --> app
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

The room is 4 × 4 m with 2.6 m walls, modelled entirely from simple primitives in a low-poly style. A small helper module, [`room_helpers.py`](room_helpers.py), gives every script the same building blocks (`box`, `plane`, `cyl`, `mat`, `img_mat`), so each step is a short Python snippet sent to Blender:

```python
exec(open("room_helpers.py").read())
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

All artwork came from the [FLUX 3 Image](https://docs.bfl.ai/flux_3/flux3_image_overview) API through [`flux_image.py`](flux_image.py). Jobs ran in parallel (the account allows 8 at a time), each into its own folder under `images/room/`.

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

The TV plays `public/videos/big-buck-bunny.mp4` (the first 60 s of the Blender Foundation film, 640 × 360, 3.4 MB). To play something else:

- change `DEFAULT_VIDEO` in `src/App.jsx`,
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

`CameraRig.jsx` uses drei's `CameraControls`. Its `setLookAt(…, true)` animates the move and returns a promise when the camera arrives, which is what lets the TV switch on at the right moment. Shots: **Overview** (fitted to the window), **Watch TV**, **Posters**, **DGX Spark**, **From bed** and **Orbit**.

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
    Rig->>App: onTvChange(false)
    App->>TV: on = false
    TV-->>TV: power-off animation, pause video
    Rig->>Rig: setLookAt(floor in front of TV, animate)
    Note over Rig: camera flies in from the overview
    Rig-->>Rig: promise resolves on arrival
    Rig->>App: onTvChange(true) after 400 ms
    App->>TV: on = true
    TV-->>TV: play video, power-on animation, thump + static
```

If another shot is chosen mid-flight, a run counter discards the stale promise so the TV doesn't switch on unexpectedly. Since [step 12](#step-12-the-show-on-the-bedroom-tv), Watch TV also turns the sound on and opens the Little Big Questions programme instead of the video.

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

**The show** (`src/labs/show.jsx`) is a rundown of stories, each a single question, in `src/labs/stories.json`. Every story runs three segments:

```mermaid
flowchart LR
    intro["Intro<br/>Olive asks the question at the desk"] --> video["Story video<br/>fills the screen, Olive in a corner bubble"]
    video --> outro["Wrap-up<br/>people see it differently,<br/>a question back to the viewer"]
    outro -->|"next story"| intro
    outro -->|"after the last story"| closing["Outro"]
```

Everything inside the studio is sized in container units, so the same set works at 16:9 on the labs page and at 4:3 on the TV.

**Her voice.** `labs_prompts/presenter_voice.py` voices each intro and wrap-up line with [Chatterbox](https://github.com/resemble-ai/chatterbox) running locally, cloning the sample clip of a Fish Audio voice ("kids"). The sample's link is signed for an hour, so the script fetches a fresh one from the Fish Audio API on every run. It writes one wav per line to `public/voices/olive/` and records each line's text and length in `src/labs/olive-voice.json`. A line is redone only when its text changes, and a line edited after it was recorded stays silent until it is voiced again. On a Mac's CPU each line takes 20 to 80 seconds.

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

**The TV panel** (top right, `src/TVControls.jsx`) is the remote control:

| Control | What it does | Key |
|---|---|---|
| Power, Sound | switch the set on or off, and mute or unmute, each labelled with its state | |
| Watch TV | fly to the TV and start the programme | |
| Video · Logo intro · News show · Outro | change channel | `1`–`4` |
| Look, Replay | pick the intro and outro look, and replay them with the jingle | `R` |
| Story, Segment | jump to any story or segment | |
| Prev, Running, Next | step through the show, or pause and resume it | `←` `→` space |

`?channel=logo`, `?channel=show` or `?channel=outro` opens the app on that channel.

**Watch TV** now opens the whole programme:

```mermaid
sequenceDiagram
    actor User
    participant App
    participant Rig as CameraRig
    participant TV as TVFeed
    User->>App: click "Watch TV"
    App->>App: sound on, channel = Logo intro
    App->>Rig: shot = "watchTV"
    Rig->>App: TV off, fly in, TV on
    App->>TV: logo intro + jingle (6 s)
    App->>TV: News show, story 1 to 4<br/>(Olive's voice, story videos)
    App->>TV: Outro + jingle, no static
```

The intro waits until the set is actually on, so it isn't missed during the camera move. If the camera is already at the TV, it starts right away, and picking another channel or shot cancels the hand-over to the show.

![The programme on the bedroom TV](docs/images/tv-programme.jpg)

## Project layout

```
.
├── README.md
├── flux_image.py            # FLUX 3 Image CLI (generate, or edit with --image)
├── room_helpers.py          # bpy helpers used by every Blender snippet
├── labs_prompts/
│   ├── prompts.tsv          # FLUX prompts for the labs concepts
│   ├── generate.sh          # runs them through flux_image.py
│   └── presenter_voice.py   # voices Olive's lines with Chatterbox
├── retro_bedroom.blend      # the Blender scene
├── renders/room_iso.png     # EEVEE render
├── images/
│   ├── room/<name>/         # generated textures and posters
│   └── refs/                # logos and DGX Spark press photos
├── docs/images/             # figures for this README
└── room-viewer/             # React + three.js app
    ├── public/models/retro_bedroom.glb
    ├── public/videos/big-buck-bunny.mp4
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
            ├── show.jsx         # rundown, Newsroom, voice playback
            ├── stories.json     # the stories and Olive's lines
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

Open `http://localhost:5173/` for the bedroom (press **Watch TV**) and `http://localhost:5173/labs` for the experiments.

**Images.** Set `BFL_API_KEY`, then:

```sh
# text to image
uv run flux_image.py "Retro pixel art poster, a green dragon…" \
  --aspect-ratio 3:4 --out images/room/poster_x

# edit from references (paths or URLs, up to 10)
uv run flux_image.py \
  "Pixel art poster in the style of <ref_image_1> with the logo from <ref_image_0>" \
  --image images/refs/logo.jpg --image images/room/poster_rocket/….png \
  --aspect-ratio 3:4 --out images/room/poster_y
```

**Labs concepts.** Add or edit a line in `labs_prompts/prompts.tsv`, then run the whole list, or only the ids that match a filter:

```sh
bash labs_prompts/generate.sh                    # everything
bash labs_prompts/generate.sh presenter/owl      # one experiment or concept
```

**Olive's voice.** Start Chatterbox (`uv run scripts/chatterbox-server.py` in the voice lab project, on `localhost:8004`), set `FISH_API_KEY`, then:

```sh
uv run labs_prompts/presenter_voice.py                       # only new or changed lines
uv run labs_prompts/presenter_voice.py --only war-intro --force
uv run labs_prompts/presenter_voice.py --model multilingual --exaggeration 0.7
```

**Model.** Edit the scene in Blender, then re-export with the same settings (run inside Blender):

```python
bpy.ops.export_scene.gltf(
    filepath="room-viewer/public/models/retro_bedroom.glb",
    export_format="GLB", export_apply=True, use_renderable=True,
    export_lights=False, export_cameras=False,
    export_image_format="JPEG", export_jpeg_quality=85,
)
```

## Credits

- **Big Buck Bunny** © Blender Foundation, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), from [peach.blender.org](https://peach.blender.org/).
- **DGX Spark** product photos from the [PNY press image kit](https://www.pny.com/company/press-center/press-images/nvidia-dgx-spark).
- **Logos** from [Dashboard Icons](https://dashboardicons.com/) and [LobeHub Icons](https://lobehub.com/icons). NVIDIA, DGX Spark, Nebius and Black Forest Labs are trademarks of their respective owners and are used here for a personal, non-commercial scene.
- **Posters, textures and labs concepts** generated with [FLUX 3 Image](https://docs.bfl.ai/) by Black Forest Labs.
- **Jingle**: "Positive Orchestral Jingle" by sergequadrado, [Freesound #455606](https://freesound.org/s/455606/).
- **Olive's voice** made with [Chatterbox](https://github.com/resemble-ai/chatterbox) by Resemble AI, cloned from the sample of the [Fish Audio voice "kids"](https://fish.audio/m/7c9a5cb2f8914bd1963d4237e540c036/).
- **Fonts**: [Fredoka](https://fonts.google.com/specimen/Fredoka), [Nunito](https://fonts.google.com/specimen/Nunito) and [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) from Google Fonts.
