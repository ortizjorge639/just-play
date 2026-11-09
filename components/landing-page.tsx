import Link from "next/link"
import Image from "next/image"
import { ArrowDown, ArrowUpRight, Play } from "lucide-react"
import "./landing-page.css"
import marketingArtwork from "../public/media/game-art/artwork.json"

const screenshots = [
  { id: "discover", title: "Find your kind of tonight.", description: "Choose your mood, energy, and time. Get a small set of games from a curated catalog—not another endless list.", image: "discovery", alt: "Staged Discovery screen with Hades, Stardew Valley and Hollow Knight recommendations" },
  { id: "playing", title: "One game. Your pace.", description: "Lock in a choice, set a session goal, and leave a note for next time. Just Play helps you choose; you launch and play the game yourself.", image: "now-playing", alt: "Demo Now Playing screen with session timer, goal, and notes" },
  { id: "standby", title: "Make room for the moment.", description: "Leave StandBy beside your game. Dithered artwork, color choices, and optional motion give your session a little atmosphere.", image: "standby", alt: "Staged StandBy screen with dithered Hades artwork and session controls" },
  { id: "home", title: "See how far you've wandered.", description: "Keep session history and a gallery of games you've marked beaten. No race to finish everything.", image: "home", alt: "Demo Home screen showing completed games as artwork cards" },
]

const visualContract = "<!-- THESIS: A shelf becomes one invitation, not a feature-grid pitch. OWN-WORLD: Forest ink, ivory, amber, recognizable catalog covers, solid native controls. STORY: Understand the curated-catalog recommendation loop, inspect the real app, then choose a game. FIRST VIEWPORT: Large left-hand backlog headline and signup action; two right-hand covers resolve to one choice. FORM: Brief-pinned cinematic flow, followed by alternating product evidence; static mobile reflow and user-controlled film. -->"

export function LandingPage() {
  return (
    <main className="landing" id="top">
      <template dangerouslySetInnerHTML={{ __html: visualContract }} />
      <a className="landing-skip" href="#how-it-works">Skip to how it works</a>
      <header className="landing-nav">
        <Link href="/about" className="landing-wordmark">Just Play<span aria-hidden="true">.</span></Link>
        <nav aria-label="Marketing navigation">
          <a href="#how-it-works">The app</a>
          <a href="#film">Watch the reel</a>
          <Link href="/auth/login" className="landing-nav-action">Sign in <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </nav>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <h1 id="landing-title">Flow through<br />your <span>backlog.</span></h1>
          <p>Less deciding. More playing.</p>
          <p className="landing-intro">Find your next game from a curated catalog, based on your mood, energy, and time. Pick one. Settle in.</p>
          <div className="landing-actions">
            <Link className="landing-primary" href="/auth/sign-up">Find my next game <ArrowUpRight size={20} aria-hidden="true" /></Link>
            <a className="landing-secondary" href="#how-it-works">See how it works <ArrowDown size={18} aria-hidden="true" /></a>
          </div>
          <p className="landing-small">A companion for choosing and tracking games. Library import is not available yet.</p>
        </div>
        <div className="landing-hero-art">
          <div className="landing-cover landing-cover-back"><Image src={marketingArtwork[1].image} alt="" fill sizes="35vw" /></div>
          <div className="landing-cover landing-cover-front">
            <Image src={marketingArtwork[0].image} alt="Hades game cover" fill sizes="(max-width: 800px) 80vw, 40vw" priority />
            <div><span>Tonight, not someday.</span><strong>Just one good choice.</strong></div>
          </div>
          <a className="landing-art-note" href="/media/artwork-credits.txt">Real game artwork · credits</a>
        </div>
      </section>

      <section className="landing-film" id="film" aria-labelledby="film-title">
        <div className="landing-section-head">
          <h2 id="film-title">From the pile<br />to the play.</h2>
          <div><p>The feeling, in 20 seconds.</p><a href="/media/just-play-social.mp4" download>Download the vertical cut <ArrowDown size={16} aria-hidden="true" /></a></div>
        </div>
        <video controls playsInline preload="none" poster="/media/reel-poster.jpg" aria-label="Just Play: Flow through your backlog, a 20-second animated promo">
          <source src="/media/just-play-wide.mp4" type="video/mp4" />
          <track kind="captions" src="/media/reel.vtt" srcLang="en" label="English" default />
          Your browser cannot play the film. <a href="/media/just-play-wide.mp4">Download the MP4</a>.
        </video>
        <details className="landing-transcript"><summary>Read the film transcript and artwork credits</summary><p>So many games. What fits tonight? Mood. Energy. Time. One good choice. Settle in. Keep your journey. Just Play. Flow through your backlog. Find your next game from a curated catalog.</p><p>Game data and covers from <a href="https://www.igdb.com/">IGDB</a>. Artwork belongs to the respective game owners; no publisher endorsement is implied. <a href="/media/artwork-credits.txt">Full credits and source terms</a>.</p></details>
      </section>

      <section id="how-it-works" className="landing-product" aria-labelledby="product-title">
        <div className="landing-section-head">
          <h2 id="product-title">Here&apos;s what<br />you&apos;re getting into.</h2>
          <p>Actual app screens, staged with demo data<br />and covers from our curated catalog.</p>
        </div>
        {screenshots.map((screen, index) => (
          <article key={screen.id} id={screen.id} className={`landing-feature ${index % 2 ? "landing-feature-reverse" : ""}`}>
            <div className="landing-feature-copy"><h3>{screen.title}</h3><p>{screen.description}</p></div>
            <figure>
              <a href={`/media/${screen.image}.png`} target="_blank" rel="noopener noreferrer" aria-label={`Open full-size ${screen.image.replaceAll("-", " ")} screenshot`}>
                <Image src={`/media/${screen.image}.png`} alt={screen.alt} width={1440} height={900} sizes="(max-width: 800px) 100vw, 65vw" />
              </a>
              <figcaption><a href={`/media/${screen.image}.png`} target="_blank" rel="noopener noreferrer">View full-size screenshot <ArrowUpRight size={16} aria-hidden="true" /></a><span>Staged demo data</span></figcaption>
            </figure>
          </article>
        ))}
      </section>

      <p className="landing-demo-disclaimer">These demo titles illustrate the interface, not live catalog availability or publisher endorsement. Game data and covers: <a href="https://www.igdb.com/">IGDB</a>. <a href="/media/artwork-credits.txt">Artwork credits and source terms</a>.</p>

      <section className="landing-faq" aria-labelledby="faq-title">
        <h2 id="faq-title">Before you jump in.</h2>
        <details><summary>Does Just Play connect to my Steam library?</summary><p>Not yet. Recommendations come from Just Play&apos;s curated catalog. Library import is planned, not a current feature.</p></details>
        <details><summary>Does it launch or include the games?</summary><p>No. Just Play helps you choose and track play sessions. You&apos;ll need access to the game and launch it yourself.</p></details>
        <details><summary>Do I have to track every minute?</summary><p>No. You can turn off time recording for future sessions in Settings. StandBy is optional too.</p></details>
        <details><summary>What&apos;s the difference between Completed and Arrived?</summary><p>Completed means you marked a game beaten. Arrived means it met your arrival rule and earned a permanent place in Home; it can arrive before completion.</p></details>
      </section>

      <section className="landing-outro" aria-labelledby="outro-title">
        <Play aria-hidden="true" size={36} />
        <h2 id="outro-title">Your next adventure<br />doesn&apos;t need a spreadsheet.</h2>
        <Link href="/auth/sign-up" className="landing-primary">Just Play <ArrowUpRight size={20} aria-hidden="true" /></Link>
        <p>Have an account? <Link href="/auth/login">Sign in</Link></p>
      </section>
      <footer className="landing-footer"><Link href="/about" className="landing-wordmark">Just Play.</Link><span>Flow through your backlog.</span><a href="#top">Back to top ↑</a></footer>
    </main>
  )
}
