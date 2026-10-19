// The logo intro's jingle, started together with the animation (about 4 s, the length of the
// CSS timeline in labs.css). "Positive Orchestral Jingle" by sergequadrado, Freesound #455606.
import { sharedAudio } from './media.js'

const JINGLE = '/audio/intro-jingle.mp3'

export function playSting() {
  // shared so Play can unlock it on iOS (media.js), which also swaps its source for silence
  const jingle = sharedAudio('jingle')
  if (!jingle.src.endsWith(JINGLE)) jingle.src = JINGLE
  // a replay restarts it rather than layering a second copy
  jingle.currentTime = 0
  jingle.play().catch(() => {})
}
