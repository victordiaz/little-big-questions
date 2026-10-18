import { Globe, HOOK, Lockup } from './brand.jsx'
import Olive from './Olive.jsx'

// The show's bumpers: the logo intro that opens it and the outro that closes it. Both are CSS
// animation on a timeline of delays (see .intro and .outro in labs.css) and play the jingle.

// How long the intro runs before the show cuts to the next thing: the ~4.4 s animation
// (and the 4 s jingle) plus a moment holding on the logo.
export const INTRO_SECONDS = 6
// How long the outro holds before the TV switches off at the end of the show: Olive's ~5.6 s
// wave goodbye plus a moment on the logo.
export const OUTRO_SECONDS = 7

// Looks for the bumpers. Same timeline, different paint.
export const THEMES = {
  studio: 'Studio (night)',
  daylight: 'Daylight',
  pixel: 'Pixel CRT',
}

// Remounting with a new key replays it from the top.
export function Intro({ theme }) {
  return (
    <div className={`intro theme-${theme}`}>
      <div className="intro-rays" />
      <div className="intro-stars">
        {Array.from({ length: 18 }, (_, i) => (
          <i key={i} style={{ '--i': i, left: `${(i * 53) % 100}%`, top: `${(i * 37) % 100}%` }} />
        ))}
      </div>
      <div className="intro-flash" />
      <div className="intro-lockup">
        <svg className="intro-mark" viewBox="0 0 200 240" aria-hidden="true">
          <ellipse className="intro-orbit" cx="100" cy="200" rx="56" ry="16" pathLength="1" />
          <path className="intro-hook-shadow" d={HOOK} pathLength="1" />
          <path className="intro-hook" d={HOOK} pathLength="1" />
          <g className="intro-globe">
            <Globe x={100} y={200} r={30} />
          </g>
          <ellipse className="intro-orbit front" cx="100" cy="200" rx="56" ry="16" pathLength="1" />
        </svg>
        <div className="intro-words">
          <span className="w-little">Little</span>
          <span className="w-big">
            {'BIG'.split('').map((c, i) => (
              <span key={i} style={{ '--i': i }}>
                {c}
              </span>
            ))}
          </span>
          <span className="w-questions">
            {'Questions'.split('').map((c, i) => (
              <span key={i} style={{ '--i': i }}>
                {c}
              </span>
            ))}
          </span>
          <span className="w-tag">news for curious kids</span>
        </div>
      </div>
      <div className="intro-sparks">
        {Array.from({ length: 8 }, (_, i) => (
          <i key={i} style={{ '--a': `${i * 45}deg` }} />
        ))}
      </div>
    </div>
  )
}

// The closing card: sign-off, the stacked logo and Olive waving goodbye from the corner.
// Shares the intro's background (rays, stars, theme); remount with a new key to replay.
export function Outro({ theme }) {
  return (
    <div className={`intro outro theme-${theme}`}>
      <div className="intro-rays" />
      <div className="intro-stars">
        {Array.from({ length: 18 }, (_, i) => (
          <i key={i} style={{ '--i': i, left: `${(i * 53) % 100}%`, top: `${(i * 37) % 100}%` }} />
        ))}
      </div>
      <div className="outro-content">
        <p className="outro-bye">That’s all for today!</p>
        <div className="outro-lockup">
          <Lockup layout="stacked" tone={theme === 'daylight' ? 'color' : 'reverse'} size={60} />
        </div>
        <p className="outro-tag">Keep asking little big questions</p>
      </div>
      <div className="outro-olive">
        <Olive crop="head" mood="happy" />
      </div>
    </div>
  )
}

