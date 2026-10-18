import { useEffect } from 'react'
import { THEMES } from './labs/intro.jsx'
import { STORIES, segmentsFor } from './labs/show.jsx'

export const CHANNELS = {
  video: 'Video',
  logo: 'Logo intro',
  show: 'News show',
  outro: 'Outro',
}

/**
 * Remote control for the bedroom TV: pick a channel, then drive the logo intro or the news show.
 * Keys: 1-4 channels, ← → step the show, space pauses/runs it, R replays the intro or outro.
 */
export default function TVControls({
  channel,
  onChannel,
  show,
  logo,
  tvOn,
  onToggleTV,
  muted,
  onToggleSound,
  onWatch,
  onHighlightPosters,
  highlighting,
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea')) return
      const channelKeys = Object.keys(CHANNELS)
      if (e.key >= '1' && e.key <= String(channelKeys.length)) onChannel(channelKeys[e.key - 1])
      else if (channel === 'show' && e.key === 'ArrowRight') show.next()
      else if (channel === 'show' && e.key === 'ArrowLeft') show.prev()
      else if (channel === 'show' && e.key === ' ') {
        e.preventDefault()
        show.setAuto((a) => !a)
      } else if ((channel === 'logo' || channel === 'outro') && e.key.toLowerCase() === 'r') logo.replay()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [channel, onChannel, show, logo])

  return (
    <aside className="tv-controls">
      <div className="tvc-head">
        <strong>TV</strong>
        <span className="tvc-row-inline">
          <button className={`tvc-power ${tvOn ? 'on' : ''}`} onClick={onToggleTV} aria-pressed={tvOn}>
            <i /> {tvOn ? 'On' : 'Off'}
          </button>
          {/* labelled with its state, like the power button: sound starts off until clicked */}
          <button className={`tvc-sound ${muted ? '' : 'on'}`} onClick={onToggleSound} aria-pressed={!muted}>
            {muted ? '🔇 Muted' : '🔊 Sound'}
          </button>
          <button onClick={onWatch}>Watch TV</button>
        </span>
      </div>

      <div className="tvc-seg">
        {Object.entries(CHANNELS).map(([key, label], i) => (
          <button key={key} className={key === channel ? 'active' : ''} onClick={() => onChannel(key)} title={`Key ${i + 1}`}>
            {label}
          </button>
        ))}
      </div>

      {(channel === 'logo' || channel === 'outro') && (
        <>
          <p className="tvc-label">Look</p>
          <div className="tvc-seg">
            {Object.entries(THEMES).map(([key, label]) => (
              <button key={key} className={key === logo.theme ? 'active' : ''} onClick={() => logo.setTheme(key)}>
                {label}
              </button>
            ))}
          </div>
          <button className="tvc-wide" onClick={logo.replay}>
            Replay {channel === 'logo' ? 'intro' : 'outro'} <kbd>R</kbd>
          </button>
        </>
      )}

      {channel === 'show' && (
        <>
          <p className="tvc-label">Story</p>
          <div className="tvc-list">
            {STORIES.map((s, i) => (
              <button
                key={s.id}
                className={i === show.storyIdx ? 'active' : ''}
                style={{ '--accent': s.accent }}
                onClick={() => show.goStory(i)}
              >
                <span>{s.topic}</span>
                {s.question}
              </button>
            ))}
          </div>
          <p className="tvc-label">Segment</p>
          <div className="tvc-seg">
            {segmentsFor(show.story).map((x) => (
              <button key={x.id} className={x.id === show.segment ? 'active' : ''} onClick={() => show.setSegment(x.id)}>
                {x.label.replace(' at the desk', '')}
              </button>
            ))}
          </div>
          <div className="tvc-row">
            <button onClick={show.prev}>
              <kbd>←</kbd> Prev
            </button>
            <button className={show.auto ? 'active' : ''} onClick={() => show.setAuto((a) => !a)}>
              {show.auto ? 'Running' : 'Paused'} <kbd>␣</kbd>
            </button>
            <button onClick={show.next}>
              Next <kbd>→</kbd>
            </button>
          </div>
        </>
      )}

      <p className="tvc-label">Posters</p>
      <button className={`tvc-wide ${highlighting ? 'active' : ''}`} onClick={onHighlightPosters}>
        Highlight the team and partners
      </button>

      {channel === 'video' && <p className="tvc-note">Drop a video file on the page, or open the app with ?video=&lt;url&gt;, to play it here.</p>}
    </aside>
  )
}
