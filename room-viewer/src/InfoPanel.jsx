import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import GithubSlugger from 'github-slugger'
// The same README that GitHub shows, so the two never drift apart.
import readme from '../../README.md?raw'

// README image paths are relative to the repo root (docs/images/…, bfl-challenge/…); map them to bundled URLs.
// GIFs are left out: the panel plays the MP4 beside each one instead (a quarter of the size).
const IMAGES = import.meta.glob(['../../docs/images/*', '!../../docs/images/*.gif', '../../bfl-challenge/**/*.jpg'], {
  eager: true,
  query: '?url',
  import: 'default',
})
const resolveImage = (src) => IMAGES[`../../${src}`] ?? src

// The README's own "Contents" list is for GitHub; the app shows a sidebar instead.
const APP_README = readme.replace(/^## Contents\n[\s\S]*?(?=^## )/m, '')

// Sidebar entries from the ## / ### headings, with the same ids rehype-slug gives them.
const TOC = (() => {
  const slugger = new GithubSlugger()
  const items = []
  let inFence = false
  for (const line of APP_README.split('\n')) {
    if (line.startsWith('```')) inFence = !inFence
    const m = !inFence && line.match(/^(#{1,3}) (.+)$/)
    if (!m) continue
    // slug the rendered text: drop inline code/link markup first
    const text = m[2].replace(/`([^`]*)`/g, '$1').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    const id = slugger.slug(text)
    if (m[1].length > 1) items.push({ id, text, level: m[1].length })
  }
  return items
})()

// Set to the GitHub repo URL (e.g. https://github.com/you/retro-bedroom) to make file links clickable.
const REPO_URL = ''

let mermaidLoader
function loadMermaid() {
  // mermaid is large, so it is only fetched the first time the panel opens
  mermaidLoader ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({ startOnLoad: false, theme: 'dark', fontFamily: 'system-ui, sans-serif' })
    return mermaid
  })
  return mermaidLoader
}

let diagramCount = 0

function Mermaid({ code }) {
  const [svg, setSvg] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    loadMermaid()
      .then((mermaid) => mermaid.render(`readme-diagram-${++diagramCount}`, code))
      .then(({ svg }) => alive && setSvg(svg))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [code])

  if (failed) return <pre>{code}</pre>
  if (!svg) return <div className="diagram loading">Drawing diagram…</div>
  return <div className="diagram" dangerouslySetInnerHTML={{ __html: svg }} />
}

const components = {
  pre({ node, children, ...props }) {
    const code = Array.isArray(children) ? children[0] : children
    if (code?.props?.className?.includes('language-mermaid')) {
      return <Mermaid code={String(code.props.children).trim()} />
    }
    return <pre {...props}>{children}</pre>
  },
  img({ node, src, alt, ...props }) {
    const video = src.endsWith('.gif') && IMAGES[`../../${src.replace(/\.gif$/, '.mp4')}`]
    if (video) return <video src={video} aria-label={alt} autoPlay loop muted playsInline />
    return <img src={resolveImage(src)} alt={alt} loading="lazy" {...props} />
  },
  a({ node, href = '', children, ...props }) {
    if (href.startsWith('#')) return <a href={href} {...props}>{children}</a>
    if (/^https?:/.test(href)) {
      return (
        <a href={href} target="_blank" rel="noreferrer" {...props}>
          {children}
        </a>
      )
    }
    // repo-relative file link: only clickable when we know where the repo lives
    if (REPO_URL) {
      return (
        <a href={`${REPO_URL}/blob/main/${href}`} target="_blank" rel="noreferrer" {...props}>
          {children}
        </a>
      )
    }
    return <span className="file-link">{children}</span>
  },
}

export default function InfoPanel({ open, onClose }) {
  const panel = useRef()
  const [active, setActive] = useState(TOC[0]?.id)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    panel.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Highlight the section currently at the top of the reading area.
  useEffect(() => {
    if (!open) return
    const root = panel.current
    const headings = TOC.map((t) => root.querySelector(`#${CSS.escape(t.id)}`)).filter(Boolean)
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length) setActive(visible[0].target.id)
      },
      { root, rootMargin: '0px 0px -75% 0px' },
    )
    headings.forEach((h) => observer.observe(h))
    return () => observer.disconnect()
  }, [open])

  const jump = (e, id) => {
    e.preventDefault()
    panel.current.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActive(id)
  }

  if (!open) return null
  return (
    <>
      <div
        ref={panel}
        className="info-overlay"
        role="dialog"
        aria-label="About this project"
        tabIndex={-1}
        // clicks on the empty backdrop (not the text or the contents) close the overlay
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="info-layout" onClick={(e) => e.target === e.currentTarget && onClose()}>
          <nav className="info-toc" aria-label="Contents">
            <p className="info-toc-title">Contents</p>
            <ul>
              {TOC.map((t) => (
                <li key={t.id} className={`level-${t.level}${t.id === active ? ' active' : ''}`}>
                  <a href={`#${t.id}`} onClick={(e) => jump(e, t.id)}>
                    {t.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <article className="readme">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSlug]} components={components}>
              {APP_README}
            </ReactMarkdown>
          </article>
        </div>
      </div>
      {/* outside the overlay: its backdrop-filter would otherwise make "fixed" scroll with it */}
      <button className="info-close" onClick={onClose} aria-label="Close">
        ×
      </button>
    </>
  )
}
