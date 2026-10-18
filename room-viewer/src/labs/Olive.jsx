// Olive, the owl who presents the news. Coded version of the FLUX "owl" concept so she can
// blink, talk, glance at the story screen and change expression in real time.
//
// mood:    'happy' | 'explaining' | 'gentle'  (gentle = softer brows and a head tilt, for hard stories)
// talking: animates the beak
// look:    'camera' | 'screen' (screen is to her left, our right)
// crop:    'body' (down to the desk edge) or 'head' (for the picture-in-picture bubble)
//
// Drawn for desk framing: the 'body' crop ends at y=240, which is where the desk's front edge
// sits, and her wing-hands rest just above that line. The body runs on below so bobbing never
// opens a gap.

const BROWS = {
  happy: ['M80 66q30-18 60 0', 'M160 66q30-18 60 0'],
  explaining: ['M80 68q30-14 60-4', 'M160 58q30-12 60 6'],
  // inner ends lifted: concerned, never cross
  gentle: ['M82 72q30-4 58-16', 'M160 56q28 2 58 16'],
}

const VIEWBOX = { body: '0 0 300 240', head: '30 0 240 210' }

export default function Olive({ mood = 'happy', talking = false, look = 'camera', crop = 'body', className = '' }) {
  const [browL, browR] = BROWS[mood] ?? BROWS.happy
  const raised = crop === 'body' && mood === 'explaining' && talking
  const pupil = look === 'screen' ? 'translate(8px, 3px)' : 'translate(0px, 0px)'
  return (
    <svg
      className={`olive mood-${mood} ${talking ? 'talking' : ''} ${className}`}
      viewBox={VIEWBOX[crop]}
      aria-label="Olive the owl"
      role="img"
    >
      <g className="olive-bob">
        <g className="olive-head">
          {/* ear tufts */}
          <path d="M90 60L70 10l54 34z" fill="#a86d38" />
          <path d="M210 60l20-50-54 34z" fill="#a86d38" />
          {/* body: round head running straight down past the desk edge */}
          <path d="M150 28C232 28 264 92 264 154V280H36V154C36 92 68 28 150 28z" fill="#c98a4b" />
          {/* cardigan with a cream chest in the V */}
          <path d="M36 172Q62 186 112 190L150 280H36z" fill="#2bb3a3" />
          <path d="M264 172Q238 186 188 190L150 280H264z" fill="#2bb3a3" />
          <path d="M112 190Q150 200 188 190L150 280z" fill="#ffe9c7" />
          <path d="M136 206l14 7 14-7M140 224l10 5 10-5" fill="none" stroke="#e6c79a" strokeWidth="4" strokeLinecap="round" />
          <path d="M112 190L150 280L188 190" fill="none" stroke="#ffc93c" strokeWidth="6" strokeLinejoin="round" />
          {/* facial disc */}
          <circle cx="110" cy="112" r="46" fill="#f3d2a2" />
          <circle cx="190" cy="112" r="46" fill="#f3d2a2" />
          {/* cheeks */}
          <circle cx="76" cy="152" r="10" fill="#ff6b5a" opacity="0.35" />
          <circle cx="224" cy="152" r="10" fill="#ff6b5a" opacity="0.35" />
          {/* eyes */}
          {[110, 190].map((cx) => (
            <g key={cx} className="olive-eye">
              <circle cx={cx} cy="112" r="30" fill="#fff" />
              <g className="olive-pupil" style={{ transform: pupil }}>
                <circle cx={cx} cy="114" r="14" fill="#1d2350" />
                <circle cx={cx + 5} cy="108" r="5" fill="#fff" />
              </g>
            </g>
          ))}
          {/* glasses */}
          <g fill="none" stroke="#1d2350" strokeWidth="7">
            <circle cx="110" cy="112" r="34" />
            <circle cx="190" cy="112" r="34" />
            <path d="M144 108q6-6 12 0" strokeLinecap="round" />
          </g>
          {/* brows */}
          <g fill="none" stroke="#7a4a22" strokeWidth="8" strokeLinecap="round">
            <path className="olive-brow" d={browL} />
            <path className="olive-brow" d={browR} />
          </g>
          {/* beak */}
          <path className="olive-beak-low" d="M139 150h22l-11 18z" fill="#e8901a" />
          <path d="M134 140h32l-16 22z" fill="#ffb02e" stroke="#e8901a" strokeWidth="3" strokeLinejoin="round" />
        </g>

        {/* wings in cardigan sleeves, wing-tip "hands" resting on the desk edge */}
        <g className="olive-wing-left">
          <path d="M40 176Q22 212 52 240H104Q96 214 72 192z" fill="#24998b" />
          <path d="M60 226q16-10 38-2q8 8-2 16H62q-10-4-2-14z" fill="#a86d38" />
        </g>
        {raised ? (
          // raised towards the story screen while explaining
          <g className="olive-wing-right raised">
            <path d="M222 222Q256 180 258 122L290 126Q292 186 250 232z" fill="#24998b" />
            <path d="M258 124q2-22 14-30q12 4 16 30z" fill="#a86d38" />
          </g>
        ) : (
          <g className="olive-wing-right">
            <path d="M260 176Q278 212 248 240H196Q204 214 228 192z" fill="#24998b" />
            <path d="M240 226q-16-10-38-2q-8 8 2 16h34q10-4 2-14z" fill="#a86d38" />
          </g>
        )}
      </g>
    </svg>
  )
}
