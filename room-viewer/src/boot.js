// The loading screen in index.html: it's there from the first paint, before any JS. The viewer
// moves its bar while the room loads and fades it out once the scene has rendered.
const boot = () => document.getElementById('boot')

export function setBootProgress(fraction) {
  boot()?.style.setProperty('--p', Math.max(0.04, Math.min(1, fraction)))
}

export function hideBoot() {
  const el = boot()
  if (!el || el.classList.contains('done')) return
  setBootProgress(1)
  el.classList.add('done')
  setTimeout(() => el.remove(), 700)
}
