import { useId } from 'react'

// Shared brand pieces for Little Big Questions, drawn in SVG so they scale and animate.
// The mark follows the FLUX "globe-question" concept: a coral question mark whose dot is a smiling Earth.
//
// Tones, used by every piece:
//   color      full colour on light backgrounds
//   reverse    full colour on navy / dark video
//   mono-navy  one colour, for print, embossing, watermarks on light
//   mono-white one colour, for watermarks on busy video

const NAVY = '#1d2350'
const CREAM = '#fff6e6'
const MONO = { 'mono-navy': NAVY, 'mono-white': '#ffffff' }

// Land blobs for a globe of radius 50 centred on 0,0. The strip is 120 units wide and drawn twice,
// so sliding it left by 120 loops seamlessly and reads as the planet turning.
const LAND = [
  'M-40 -25q10-15 25-8q12 6 6 18q-8 10-2 22q4 12-10 10q-14-4-16-18q-2-10-3-24z',
  'M5 -38q18-8 30 2q8 8-2 14q-12 4-20-2q-10-4-8-14z',
  'M14 4q14-6 24 4q6 12-4 24q-10 8-18-2q-8-12-2-26z',
  'M50 -22q12-4 16 6q2 10-8 12q-10 0-8-18z',
  'M-30 30q12-2 16 6q-4 8-14 6q-6-4-2-12z',
]

// mono: draw the globe as a flat disc of that colour, with the face cut out in `monoInk`.
export function Globe({ x = 0, y = 0, r = 50, face = true, spin = true, mono, monoInk = CREAM }) {
  // Each globe needs its own clip/gradient ids when several are on one page.
  const id = 'globe' + useId().replace(/[^\w-]/g, '')
  const s = r / 50
  const ink = mono ? monoInk : NAVY
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {mono ? (
        <circle r="50" fill={mono} />
      ) : (
        <>
          <defs>
            <clipPath id={`${id}-clip`}>
              <circle r="50" />
            </clipPath>
            <radialGradient id={`${id}-shade`} cx="35%" cy="30%" r="75%">
              <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
              <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
              <stop offset="1" stopColor="#0b1b4a" stopOpacity="0.35" />
            </radialGradient>
          </defs>
          <circle r="50" fill="#3fa7f5" />
          <g clipPath={`url(#${id}-clip)`}>
            <g className={spin ? 'globe-spin' : undefined}>
              {[0, 120].map((dx) => (
                <g key={dx} transform={`translate(${dx} 0)`} fill="#7ed957">
                  {LAND.map((d) => (
                    <path key={d} d={d} />
                  ))}
                </g>
              ))}
            </g>
          </g>
          <circle r="50" fill={`url(#${id}-shade)`} />
        </>
      )}
      {face && (
        <g className="globe-face">
          <ellipse className="blink" cx="-14" cy="-4" rx="5" ry="7" fill={ink} />
          <ellipse className="blink" cx="14" cy="-4" rx="5" ry="7" fill={ink} />
          {!mono && <circle cx="-24" cy="10" r="6" fill="#ff6b5a" opacity="0.5" />}
          {!mono && <circle cx="24" cy="10" r="6" fill="#ff6b5a" opacity="0.5" />}
          <path d="M-10 12q10 10 20 0" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" />
        </g>
      )}
    </g>
  )
}

// The question-mark hook, in the mark's 200x240 viewBox. Kept as one stroke so it can be "drawn".
export const HOOK = 'M52 70C52 34 80 16 108 16C142 16 160 40 160 66C160 92 140 104 122 114C106 123 100 134 100 152'

// The mark is 200x240; `size` is its width in px (height is 1.2x).
export function LogoMark({ size = 64, face = true, tone = 'color', spin = true, className = '' }) {
  const mono = MONO[tone]
  // In one colour the face is cut out of the disc, so it takes the colour of what's behind it.
  const monoInk = tone === 'mono-white' ? NAVY : CREAM
  return (
    <svg className={`logo-mark ${className}`} viewBox="0 0 200 240" width={size} height={size * 1.2} aria-hidden="true">
      <path
        className="logo-hook"
        d={HOOK}
        pathLength="1"
        fill="none"
        stroke={mono || '#ff6b5a'}
        strokeWidth="34"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Globe x={100} y={200} r={30} face={face} spin={spin} mono={mono} monoInk={monoInk} />
    </svg>
  )
}

// layout: 'stacked' (three lines, centred) | 'left' (three lines, left-aligned) | 'row' (one line)
export function Wordmark({ layout = 'stacked', tone = 'color', className = '' }) {
  return (
    <span className={`wordmark wm-${layout} tone-${tone} ${className}`}>
      <span className="wm-little">Little</span>
      <span className="wm-big">BIG</span>
      <span className="wm-questions">Questions</span>
    </span>
  )
}

// A complete logo. `size` is the cap height of "BIG" in px; everything else scales from it.
//   stacked     mark over the wordmark: title cards, end cards, merch
//   horizontal  mark beside the three-line wordmark: desk front, headers, the corner bug
//   inline      mark beside a one-line wordmark: narrow strips, lower thirds, footers
//   mark        the mark alone: avatars, app icon, favicon, small watermarks
export function Lockup({ layout = 'horizontal', tone = 'color', size = 40, face = true, spin = true, className = '' }) {
  const markWidth = { stacked: 1.9, horizontal: 1.55, inline: 0.75, mark: 1.6 }[layout] * size
  return (
    <span className={`lockup-x lk-${layout} ${className}`} style={{ '--lk': `${size}px` }} role="img" aria-label="Little Big Questions">
      <LogoMark size={markWidth} face={face} tone={tone} spin={spin} />
      {layout !== 'mark' && (
        <Wordmark layout={{ stacked: 'stacked', horizontal: 'left', inline: 'row' }[layout]} tone={tone} />
      )}
    </span>
  )
}
