import { useState } from 'react'
import promptsTsv from '../../../labs_prompts/prompts.tsv?raw'

// Every image made by labs_prompts/generate.sh, keyed by "<experiment>/<id>".
// Re-running the script for an id adds a newer version next to the old ones.
const FILES = import.meta.glob('./assets/*/*/*.{png,jpg,jpeg,webp}', { eager: true, query: '?url', import: 'default' })

const PROMPTS = Object.fromEntries(
  promptsTsv
    .split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [id, aspect, prompt] = line.split('\t')
      return [id, { aspect, prompt }]
    }),
)

export function fluxImages(experiment) {
  const groups = {}
  for (const [path, url] of Object.entries(FILES).sort(([a], [b]) => a.localeCompare(b))) {
    const [, exp, id] = path.split('/').slice(1)
    if (exp !== experiment) continue
    ;(groups[id] ??= { id, ...PROMPTS[`${exp}/${id}`], versions: [] }).versions.push(url)
  }
  return Object.values(groups)
}

// Latest version of one concept, for using a FLUX image elsewhere on a page.
export function fluxImage(experiment, id) {
  return fluxImages(experiment).find((g) => g.id === id)?.versions.at(-1)
}

export default function FluxGallery({ experiment, order = [], labels = {} }) {
  const [open, setOpen] = useState(null)
  const rank = (id) => (order.includes(id) ? order.indexOf(id) : order.length)
  const groups = fluxImages(experiment).sort((a, b) => rank(a.id) - rank(b.id))

  if (!groups.length) {
    return (
      <p className="flux-empty">
        No FLUX images yet. Run <code>bash labs_prompts/generate.sh {experiment}/</code> from the repo root.
      </p>
    )
  }

  return (
    <>
      <div className="flux-grid">
        {groups.map((g) => {
          const src = g.versions.at(-1)
          return (
            <figure key={g.id} className={`flux-card aspect-${(g.aspect || '1:1').replace(':', 'x')}`}>
              <button onClick={() => setOpen({ ...g, src })} aria-label={`Open ${g.id}`}>
                <img src={src} alt={g.prompt || g.id} loading="lazy" />
              </button>
              <figcaption>
                <strong>{labels[g.id] || g.id}</strong>
                {g.versions.length > 1 && <span className="flux-versions">{g.versions.length} versions</span>}
                <code>{experiment}/{g.id}</code>
              </figcaption>
            </figure>
          )
        })}
      </div>
      {open && (
        <div className="flux-lightbox" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <img src={open.src} alt={open.prompt || open.id} />
          <p>{open.prompt}</p>
        </div>
      )}
    </>
  )
}
