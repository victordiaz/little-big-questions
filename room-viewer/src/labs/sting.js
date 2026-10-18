// The logo intro's jingle, started together with the animation (about 4 s, the length of the
// CSS timeline in labs.css). "Positive Orchestral Jingle" by sergequadrado, Freesound #455606.
const JINGLE = '/audio/intro-jingle.mp3'

let jingle

export function playSting() {
  jingle ??= new Audio(JINGLE)
  // a replay restarts it rather than layering a second copy
  jingle.currentTime = 0
  jingle.play().catch(() => {})
}
