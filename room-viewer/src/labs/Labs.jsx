import { useEffect } from 'react'
import LogoLab from './LogoLab.jsx'
import PresenterLab from './PresenterLab.jsx'
import { LogoMark } from './brand.jsx'
import './labs.css'

// Each experiment is one entry on /labs and one page at /labs/<slug>.
// To add one: write the page component and add a row here.
export const EXPERIMENTS = [
  {
    slug: 'logo',
    title: 'Logo',
    blurb: 'The show’s mark and an animated news-programme intro, built in code next to FLUX concepts.',
    status: 'Exploring',
    component: LogoLab,
  },
  {
    slug: 'presenter',
    title: 'Presenter',
    blurb: 'Who hosts the news, and how they look in the studio, on the bedroom TV and over a story video.',
    status: 'Exploring',
    component: PresenterLab,
  },
]

export default function Labs() {
  const slug = window.location.pathname.replace(/^\/labs\/?/, '').replace(/\/$/, '')
  const experiment = EXPERIMENTS.find((e) => e.slug === slug)
  const Page = experiment?.component

  useEffect(() => {
    document.title = experiment ? `${experiment.title} · LBQ Labs` : 'LBQ Labs'
  }, [experiment])

  return (
    <div className="labs">
      <header className="labs-bar">
        <a className="labs-home" href="/labs">
          <LogoMark size={28} />
          <span>
            Little Big Questions <b>Labs</b>
          </span>
        </a>
        {experiment && (
          <nav>
            {EXPERIMENTS.map((e) => (
              <a key={e.slug} href={`/labs/${e.slug}`} className={e === experiment ? 'active' : ''}>
                {e.title}
              </a>
            ))}
          </nav>
        )}
      </header>
      {Page ? <Page /> : slug ? <NotFound slug={slug} /> : <Index />}
    </div>
  )
}

function Index() {
  return (
    <main className="labs-main">
      <section className="labs-hero">
        <h1>Little experiments</h1>
        <p>
          Little Big Questions helps kids make sense of the big, sometimes scary things happening in the world:
          real news, told as friendly cartoon stories that are honest without being frightening. This is where
          we try things out before they go into the show.
        </p>
      </section>
      <ul className="labs-list">
        {EXPERIMENTS.map((e, i) => (
          <li key={e.slug}>
            <a href={`/labs/${e.slug}`}>
              <span className="labs-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="labs-entry">
                <strong>{e.title}</strong>
                <span>{e.blurb}</span>
              </span>
              <span className="labs-status">{e.status}</span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  )
}

function NotFound({ slug }) {
  return (
    <main className="labs-main">
      <section className="labs-hero">
        <h1>No experiment called “{slug}”</h1>
        <p>
          <a href="/labs">Back to all experiments</a>
        </p>
      </section>
    </main>
  )
}
