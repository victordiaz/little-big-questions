import { useState } from 'react'
import FluxGallery, { fluxImage } from './FluxGallery.jsx'
import { Newsroom, STORIES, segmentsFor, useShow } from './show.jsx'

const VIEWS = {
  studio: 'Studio 16:9',
  tv: 'On the bedroom TV',
}

const CAST = [
  { id: 'owl', name: 'Olive the owl', note: 'Wise but not old. Glasses and a cardigan read “teacher you like”. Coded below so we can animate her.' },
  { id: 'robot', name: 'Pip the TV-robot', note: 'His head is a CRT, so he echoes the bedroom TV. Fun, but a screen face is harder to make warm.' },
  { id: 'fox', name: 'Remy the fox reporter', note: 'A kid-aged reporter, closest to the audience. Good for field segments.' },
  { id: 'blob', name: 'Quill the question', note: 'The logo as a character. Very ownable, less expressive body language.' },
]

export default function PresenterLab() {
  const { story, storyIdx, segment, auto, setAuto, setSegment, goStory, next } = useShow()
  const [view, setView] = useState('studio')
  const [voice, setVoice] = useState(true)

  return (
    <main className="labs-main">
      <section className="lab-head">
        <p className="lab-kicker">Experiment 02</p>
        <h1>Presenter</h1>
        <p>
          A friendly host at a news desk, the way kids already know the news looks, but warmer. Each story is one
          question: the presenter asks it, the story video takes over the big screen while they stay in a corner
          bubble, then they come back to say that people see it differently and that the viewer’s questions matter.
        </p>
      </section>

      <section>
        <div className="show-controls">
          <div className="seg">
            {Object.entries(VIEWS).map(([key, label]) => (
              <button key={key} className={key === view ? 'active' : ''} onClick={() => setView(key)}>
                {label}
              </button>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            Run the show
          </label>
          <label className="check">
            <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} />
            Olive’s voice
          </label>
        </div>

        <div className={`show-layout view-${view}`}>
          <Frame view={view}>
            <Newsroom story={story} segment={segment} auto={auto} onDone={next} voice={voice} />
          </Frame>

          <aside className="rundown">
            <h3>Rundown</h3>
            <ol>
              {STORIES.map((s, i) => (
                <li key={s.id} className={i === storyIdx ? 'active' : ''} style={{ '--accent': s.accent }}>
                  <button onClick={() => goStory(i)}>
                    <span className="rd-topic">{s.topic}</span>
                    <span className="rd-q">{s.question}</span>
                  </button>
                  {i === storyIdx && (
                    <div className="rd-segs">
                      {segmentsFor(s).map((x) => (
                        <button key={x.id} className={x.id === segment ? 'active' : ''} onClick={() => setSegment(x.id)}>
                          {x.label}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </section>

      <section>
        <h2>How the presenter behaves</h2>
        <ul className="rules">
          <li>
            <b>Eye level, desk between us.</b> Same framing as grown-up news, so it feels real, but the desk is low and
            round so it doesn’t feel like a wall.
          </li>
          <li>
            <b>Expression follows the story.</b> Light stories get the happy face; hard ones (war) get softer brows, a
            small head tilt and a slower line, never a frightened face.
          </li>
          <li>
            <b>Never leaves during the video.</b> A corner bubble keeps a familiar face on screen while the story
            plays, so the scary bits are never watched alone.
          </li>
          <li>
            <b>Ends on the viewer.</b> Every wrap-up says people see things differently and asks the kid a question
            back.
          </li>
          <li>
            <b>Reads on a small CRT.</b> Big shapes, high contrast, title-safe lower third: check the “On the bedroom
            TV” view, which is roughly what the three.js TV will show.
          </li>
        </ul>
      </section>

      <section>
        <h2>Casting: four presenters from FLUX</h2>
        <p className="section-note">Each one as a character sheet and in the studio.</p>
        <div className="cast">
          {CAST.map((c) => (
            <article key={c.id} className="cast-card">
              <div className="cast-shots">
                <img src={fluxImage('presenter', `${c.id}-newsroom`)} alt={`${c.name} in the studio`} loading="lazy" />
                <img src={fluxImage('presenter', `${c.id}-sheet`)} alt={`${c.name} character sheet`} loading="lazy" />
              </div>
              <h3>{c.name}</h3>
              <p>{c.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>All FLUX images</h2>
        <p className="section-note">
          Includes an empty set plate (for compositing a presenter over a painted studio) and a look at the show on a
          90s CRT.
        </p>
        <FluxGallery experiment="presenter" order={['empty-set', 'on-the-crt']} />
      </section>
    </main>
  )
}

function Frame({ view, children }) {
  if (view !== 'tv') return <div className="frame-studio">{children}</div>
  return (
    <div className="crt">
      <div className="crt-screen">
        {children}
        <div className="crt-glass" />
      </div>
      <div className="crt-panel">
        <span className="crt-led" />
        <span className="crt-knob" />
        <span className="crt-knob" />
      </div>
    </div>
  )
}
