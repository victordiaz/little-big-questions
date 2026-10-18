import { useState } from 'react'
import { Intro, Outro, THEMES } from './intro.jsx'
import Lockups from './Lockups.jsx'
import FluxGallery from './FluxGallery.jsx'
import { playSting } from './sting.js'

const FLUX_ORDER = ['globe-question', 'stacked-wordmark', 'news-emblem', 'app-icon', 'kid-and-giant-mark', 'pixel-intro']
const FLUX_LABELS = {
  'globe-question': 'Globe as the dot',
  'stacked-wordmark': 'Stacked sticker wordmark',
  'news-emblem': 'News emblem',
  'app-icon': 'App icon',
  'kid-and-giant-mark': 'Title card: the giant question',
  'pixel-intro': 'Pixel title screen',
}

export default function LogoLab() {
  const [take, setTake] = useState(0)
  const [theme, setTheme] = useState('studio')
  // Browsers only allow audio after a click, so the jingle starts with Replay or a look change
  const [sound, setSound] = useState(true)

  const [outroTake, setOutroTake] = useState(0)
  const playOutro = () => {
    setOutroTake((t) => t + 1)
    if (sound) playSting()
  }

  const replay = () => {
    setTake((t) => t + 1)
    if (sound) playSting()
  }

  return (
    <main className="labs-main">
      <section className="lab-head">
        <p className="lab-kicker">Experiment 01</p>
        <h1>Logo</h1>
        <p>
          The coded mark takes the strongest FLUX direction, a question mark whose dot is a smiling Earth, and turns
          it into a news-programme intro: the camera starts tight on the planet, pulls back, the question draws itself
          and the name lands. About five seconds, then it holds.
        </p>
      </section>

      <section>
        <div className="intro-controls">
          <div className="seg">
            {Object.entries(THEMES).map(([key, label]) => (
              <button
                key={key}
                className={key === theme ? 'active' : ''}
                onClick={() => {
                  setTheme(key)
                  replay()
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="pill" onClick={() => setSound((s) => !s)} aria-pressed={sound}>
            {sound ? 'Sound on' : 'Sound off'}
          </button>
          <button className="pill primary" onClick={replay}>
            Replay intro
          </button>
        </div>
        <Intro key={`${theme}-${take}`} theme={theme} />
      </section>

      <section>
        <h2>Outro</h2>
        <p className="section-note">
          Closes the show after the last story’s wrap-up, with the same jingle and look as the intro.
        </p>
        <div className="intro-controls">
          <button className="pill primary" onClick={playOutro}>
            Play outro
          </button>
        </div>
        <Outro key={`${theme}-${outroTake}`} theme={theme} />
      </section>

      <Lockups />

      <section>
        <h2>FLUX concepts</h2>
        <p className="section-note">
          Generated with <code>flux_image.py</code>; prompts live in <code>labs_prompts/prompts.tsv</code>. Click one to
          see it large with its prompt.
        </p>
        <FluxGallery experiment="logo" order={FLUX_ORDER} labels={FLUX_LABELS} />
      </section>
    </main>
  )
}
