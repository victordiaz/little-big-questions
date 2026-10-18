import { useCallback, useEffect, useRef, useState } from 'react'
import Olive from './Olive.jsx'
import { Globe, LogoMark, Wordmark } from './brand.jsx'
import storiesJson from './stories.json'

// The news show: the rundown of stories, the logic that steps through it, and the studio that
// renders it. Used by /labs/presenter and by the bedroom TV in the main app.

// A show is a rundown of stories. Each story runs three segments:
//   intro  - Olive at the desk asks the question and sets it up
//   video  - the story video takes the screen, Olive stays in a corner bubble
//   outro  - back to the desk: different views, and "your questions matter"
// The lines live in stories.json so labs_prompts/presenter_voice.py can voice them.
// When there's news (news.json, from news_publish.py) the rundown is today's news, each story
// with its own narrated video and the `chapters` that caption it, and the show ends after it.
// Without news it falls back to the evergreen stories. A glob, so the show still works before
// the file exists.
const NEWS = Object.values(import.meta.glob('./news.json', { eager: true, import: 'default' }))[0] ?? []
export const STORIES = NEWS.length ? NEWS : storiesJson

export const SEGMENTS = [
  { id: 'intro', label: 'Intro at the desk' },
  { id: 'video', label: 'Story video' },
  { id: 'outro', label: 'Wrap-up' },
]

// A story without its own video (the evergreen ones) goes straight from intro to wrap-up.
export const segmentsFor = (story) => SEGMENTS.filter((x) => x.id !== 'video' || story.video)

// A story video to show the logo over in the labs, if there's news.
export const SAMPLE_VIDEO = NEWS.find((s) => s.video)?.video


// Where the show is in the rundown, and how to move through it. `onEnd` runs when the last
// story's wrap-up finishes (the bedroom TV rolls the outro); without it the show just stops.
export function useShow({ onEnd } = {}) {
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd
  const [storyIdx, setStoryIdx] = useState(0)
  const [segment, setSegment] = useState('intro')
  const [auto, setAuto] = useState(true)

  const goStory = useCallback((i) => {
    setStoryIdx((i + STORIES.length) % STORIES.length)
    setSegment('intro')
  }, [])

  const next = useCallback(() => {
    const segs = segmentsFor(STORIES[storyIdx])
    const s = segs.findIndex((x) => x.id === segment)
    if (s < segs.length - 1) setSegment(segs[s + 1].id)
    else if (storyIdx < STORIES.length - 1) goStory(storyIdx + 1)
    else if (onEndRef.current) onEndRef.current()
    else setAuto(false)
  }, [segment, storyIdx, goStory])

  const prev = useCallback(() => {
    const segs = segmentsFor(STORIES[storyIdx])
    const s = segs.findIndex((x) => x.id === segment)
    if (s > 0) setSegment(segs[s - 1].id)
    else if (storyIdx > 0) {
      setStoryIdx(storyIdx - 1)
      setSegment(SEGMENTS.at(-1).id)
    }
  }, [segment, storyIdx])

  return { story: STORIES[storyIdx], storyIdx, segment, auto, setAuto, setSegment, goStory, next, prev }
}

// `voice`: play Olive's recorded lines (labs_prompts/presenter_voice.py) when they exist, and
// the narration of a news story's video.
export function Newsroom({ story, segment, auto, onDone, voice = false }) {
  const line = segment === 'intro' ? story.intro : segment === 'outro' ? story.outro : ''
  const key = `${story.id}-${segment}`
  const { typed, talking } = useLine(line, key, voice ? voiceFor(key, line) : null)
  const videoRef = useRef(null)
  const [videoTime, setVideoTime] = useState(0)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  // Advance on its own when "Run the show" is on: after a line is finished, or when the story
  // video ends (its onEnded below).
  useEffect(() => {
    if (!auto || segment === 'video' || talking) return
    const t = setTimeout(onDone, segment === 'outro' ? 3000 : 1500)
    return () => clearTimeout(t)
  }, [auto, segment, talking, onDone])

  // The narration is the video's sound, on when the show's sound is.
  const sound = Boolean(story.video && story.narrated) && voice
  const soundRef = useRef(sound)
  soundRef.current = sound
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = !sound
  }, [sound])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (segment !== 'video') return v.pause()
    v.currentTime = 0
    setVideoTime(0)
    // If the browser won't play sound yet, play it muted rather than not at all; the captions
    // still tell the story.
    v.muted = !soundRef.current
    v.play().catch(() => {
      v.muted = true
      v.play().catch(() => {})
    })
  }, [segment, story.id])

  // The caption for the narration playing now: the last chapter that has started.
  const chapter = segment === 'video' ? (story.chapters ?? []).findLast((c) => c.start <= videoTime) : null

  const mood = segment === 'outro' && story.mood !== 'gentle' ? 'happy' : story.mood

  return (
    <div className={`stage seg-${segment}`} style={{ '--accent': story.accent }}>
      <div className="set-wall">
        {[12, 30, 70, 88].map((x) => (
          <i key={x} className="set-lamp" style={{ left: `${x}%` }} />
        ))}
      </div>
      <div className="set-ring" />
      <div className="set-floor" />

      <div className="set-screen">
        <div className="screen-card" key={story.id}>
          <span className="screen-topic">{story.topic}</span>
          <span className="screen-q">{story.question}</span>
          <svg viewBox="-60 -60 120 120" className="screen-globe" aria-hidden="true">
            <Globe r={50} />
          </svg>
        </div>
        <video
          ref={videoRef}
          src={story.video}
          muted
          playsInline
          preload="metadata"
          onTimeUpdate={(e) => setVideoTime(e.currentTarget.currentTime)}
          onEnded={() => auto && segment === 'video' && onDoneRef.current()}
        />
      </div>

      {/* Olive and the desk move as one, so her hands always rest on the desk edge. */}
      <div className="set-anchor">
        <div className="desk-top" />
        <Olive mood={mood} talking={talking} look={talking ? 'camera' : 'screen'} />
        <div className="desk-front">
          <LogoMark size={40} face={false} spin={false} />
          <Wordmark layout="row" tone="reverse" />
        </div>
      </div>

      <div className="bug">
        <LogoMark size={22} face={false} spin={false} />
        <span>{story.date ? 'Today’s news' : 'Today’s question'}</span>
      </div>

      <div className="lower-third" key={`${story.id}-lt`}>
        <span className="lt-tab">{story.topic}</span>
        <span className="lt-q">{story.question}</span>
      </div>

      {line && (
        <div className="subtitle" key={`${story.id}-${segment}`}>
          <b>Olive</b>
          {/* the full line, invisible, sizes the bubble so it doesn't grow while typing */}
          <span className="sub-text">
            <span className="sub-full" aria-hidden="true">
              {line}
            </span>
            <span className="sub-typed">{typed}</span>
          </span>
        </div>
      )}

      {chapter && (
        <div className="subtitle caption" key={`${story.id}-${chapter.start}`}>
          <b>Today’s story</b>
          <span className="sub-text">{chapter.text}</span>
        </div>
      )}

      <div className="pip">
        <Olive crop="head" mood={story.mood} look="screen" />
        <span>Olive is watching with you</span>
      </div>

      <div className="ticker">
        <div className="ticker-track">
          {[0, 1].map((k) => (
            <span key={k}>
              Your questions matter ✦ Send us a little big question ✦ It’s okay to feel worried, talk to a grown-up you
              trust ✦ People see things differently ✦&nbsp;
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// Olive's recorded lines, if labs_prompts/presenter_voice.py has made them. A glob, so the show
// still works before the file exists.
const VOICE = Object.values(import.meta.glob('./olive-voice.json', { eager: true, import: 'default' }))[0] ?? {}

// The recording for a line, unless the line was rewritten after it was recorded.
function voiceFor(key, text) {
  return VOICE[key]?.text === text ? `/voices/olive/${key}.wav` : null
}

// Shows a line in the bubble. With a recording, the text follows the audio and Olive talks
// while it plays; without one (or if the browser blocks playback) it types out at speaking pace.
// A new `key` restarts it.
function useLine(text, key, src) {
  const [state, setState] = useState({ key, n: 0, done: !text })

  useEffect(() => {
    setState({ key, n: 0, done: !text })
    if (!text) return
    let audio, frame, timer
    // Once this line is cleaned up (next line, or StrictMode's test unmount), nothing from it may
    // touch the bubble: a late play() rejection used to start a typing loop that was never stopped.
    let cancelled = false
    const set = (n, done) =>
      cancelled || setState((s) => (s.key === key && s.n === n && s.done === done ? s : { key, n, done }))

    const type = () => {
      let n = 0
      timer = setInterval(() => {
        n = Math.min(n + 1, text.length)
        set(n, n === text.length)
        if (n === text.length) clearInterval(timer)
      }, 38)
    }

    if (src) {
      audio = new Audio(src)
      const follow = () => {
        if (audio.duration) set(Math.ceil((text.length * audio.currentTime) / audio.duration), false)
        frame = requestAnimationFrame(follow)
      }
      audio.addEventListener('ended', () => {
        cancelAnimationFrame(frame)
        set(text.length, true)
      })
      audio
        .play()
        .then(() => {
          if (!cancelled) frame = requestAnimationFrame(follow)
        })
        .catch(() => {
          if (!cancelled) type()
        })
    } else type()

    return () => {
      cancelled = true
      clearInterval(timer)
      cancelAnimationFrame(frame)
      audio?.pause()
    }
  }, [text, key, src])

  const current = state.key === key ? state : { n: 0, done: !text }
  return { typed: text.slice(0, current.n), talking: !current.done }
}
