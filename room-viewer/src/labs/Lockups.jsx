import { useState } from 'react'
import { Lockup, LogoMark } from './brand.jsx'
import Olive from './Olive.jsx'
import { SAMPLE_VIDEO } from './show.jsx'

const LAYOUTS = [
  { id: 'stacked', label: 'Stacked', use: 'Title and end cards, merch' },
  { id: 'horizontal', label: 'Horizontal', use: 'Desk front, page headers, corner bug' },
  { id: 'inline', label: 'One line', use: 'Lower thirds, strips, footers' },
  { id: 'mark', label: 'Mark', use: 'Avatar, app icon, favicon, watermark' },
]

const TONES = [
  { id: 'color', label: 'Colour', bg: 'bg-cream' },
  { id: 'reverse', label: 'Reverse', bg: 'bg-navy' },
  { id: 'mono-navy', label: 'One colour', bg: 'bg-paper' },
  { id: 'mono-white', label: 'White', bg: 'bg-teal' },
]

// Sizes per layout so every cell in the matrix reads at a similar visual weight.
const MATRIX_SIZE = { stacked: 34, horizontal: 30, inline: 28, mark: 40 }

const CORNERS = { tl: 'Top left', tr: 'Top right', bl: 'Bottom left', br: 'Bottom right' }
const BUGS = {
  mark: 'Mark only',
  name: 'Mark + name',
  pill: 'On a pill',
}


export default function Lockups() {
  return (
    <>
      <section>
        <h2>Lockups</h2>
        <p className="section-note">
          Four layouts in four tones. Everything scales from one number, the height of “BIG”, so the pieces keep their
          proportions at any size.
        </p>
        <div className="lk-matrix">
          <div />
          {TONES.map((t) => (
            <div key={t.id} className="lk-col-head">
              {t.label}
            </div>
          ))}
          {LAYOUTS.map((l) => (
            <Row key={l.id} layout={l} />
          ))}
        </div>
      </section>

      <section>
        <h2>Clear space and small sizes</h2>
        <p className="section-note">
          Keep one globe’s width clear around the logo. Below 32px the face is dropped and the globe stops turning, so
          the mark stays a crisp shape.
        </p>
        <div className="lk-rules">
          <div className="lk-clear bg-cream">
            <span className="lk-clear-box">
              <Lockup layout="horizontal" size={44} />
            </span>
            <span className="lk-clear-label">clear space = 1 globe</span>
          </div>
          <div className="lk-sizes bg-cream">
            {[96, 64, 48, 32, 24, 16].map((px) => (
              <figure key={px}>
                <LogoMark size={px / 1.2} face={px >= 32} spin={px >= 32} />
                <figcaption>{px}px</figcaption>
              </figure>
            ))}
          </div>
          <div className="lk-dont bg-cream">
            <p>
              <b>Don’t</b>
            </p>
            <ul>
              <li>recolour the globe or the question mark</li>
              <li>put the colour version on busy video, use white</li>
              <li>stretch, rotate (stickers excepted) or outline it</li>
              <li>separate “BIG” from the other two words</li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <h2>In use</h2>
        <p className="section-note">How the logo sits in the places the show needs it.</p>
        <div className="lk-uses">
          <CornerBug />
          <Use title="Lower third" note="One-line lockup in the tab, the question gets the space.">
            <div className="use-frame use-lt">
              <video src={SAMPLE_VIDEO} muted autoPlay loop playsInline />
              <div className="use-lt-bar">
                <span className="use-lt-tab">
                  <Lockup layout="inline" tone="reverse" size={15} />
                </span>
                <span className="use-lt-q">What is an election?</span>
              </div>
            </div>
          </Use>
          <Use title="End card" note="Stacked, reversed, with the call to send a question in.">
            <div className="use-frame use-end">
              <Lockup layout="stacked" tone="reverse" size={30} />
              <p>Got a little big question?</p>
              <span>Ask a grown-up to send it to us</span>
            </div>
          </Use>
          <Use title="Video thumbnail" note="Mark top-left, never over the question or a face.">
            <div className="use-frame use-thumb">
              <span className="use-thumb-mark">
                <LogoMark size={26} face={false} spin={false} />
              </span>
              <p>
                Why do countries <em>fight?</em>
              </p>
              <Olive crop="head" mood="gentle" className="use-thumb-olive" />
            </div>
          </Use>
          <Use title="Browser tab and avatar" note="The mark alone, on cream or on teal.">
            <div className="use-frame use-web">
              <div className="use-tab">
                <LogoMark size={14} face={false} spin={false} />
                <span>Little Big Questions</span>
                <i>×</i>
              </div>
              <div className="use-avatars">
                <span className="use-avatar">
                  <LogoMark size={44} />
                </span>
                <span className="use-avatar teal">
                  <LogoMark size={44} />
                </span>
                <span className="use-avatar-icon">
                  <LogoMark size={40} />
                </span>
              </div>
            </div>
          </Use>
          <Use title="Sticker" note="The one place the logo may tilt. Thick white outline, for notebooks and lunchboxes.">
            <div className="use-frame use-sticker">
              <span className="sticker">
                <Lockup layout="stacked" size={28} />
              </span>
              <span className="sticker small">
                <LogoMark size={46} />
              </span>
            </div>
          </Use>
        </div>
      </section>
    </>
  )
}

function Row({ layout }) {
  return (
    <>
      <div className="lk-row-head">
        <strong>{layout.label}</strong>
        <span>{layout.use}</span>
      </div>
      {TONES.map((t) => (
        <div key={t.id} className={`lk-cell ${t.bg}`}>
          <Lockup layout={layout.id} tone={t.id} size={MATRIX_SIZE[layout.id]} />
        </div>
      ))}
    </>
  )
}

function Use({ title, note, children }) {
  return (
    <figure className="lk-use">
      {children}
      <figcaption>
        <strong>{title}</strong> {note}
      </figcaption>
    </figure>
  )
}

// The on-air bug: a small logo that sits in a corner for the whole show.
function CornerBug() {
  const [corner, setCorner] = useState('br')
  const [style, setStyle] = useState('name')
  return (
    <Use
      title="Corner bug"
      note="Sits on every frame of the show. White on video so it never fights the picture; the pill is for bright or busy footage."
    >
      <div className="use-frame use-bug">
        <video src={SAMPLE_VIDEO} muted autoPlay loop playsInline />
        <div className={`bug-x at-${corner} bug-${style}`} key={`${corner}-${style}`}>
          {style === 'mark' && <LogoMark size={34} tone="mono-white" face={false} spin={false} />}
          {style === 'name' && <Lockup layout="horizontal" tone="mono-white" size={17} face={false} spin={false} />}
          {style === 'pill' && <Lockup layout="inline" size={16} />}
        </div>
      </div>
      <div className="bug-controls">
        <div className="seg">
          {Object.entries(CORNERS).map(([k, label]) => (
            <button key={k} className={k === corner ? 'active' : ''} onClick={() => setCorner(k)}>
              {label}
            </button>
          ))}
        </div>
        <div className="seg">
          {Object.entries(BUGS).map(([k, label]) => (
            <button key={k} className={k === style ? 'active' : ''} onClick={() => setStyle(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </Use>
  )
}
