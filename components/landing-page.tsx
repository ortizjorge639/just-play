import Link from "next/link"
import Image from "next/image"
import { ArrowDown, ArrowUpRight } from "lucide-react"
import "./landing-page.css"
import marketingArtwork from "../public/media/game-art/artwork.json"

const screenshots = [
  { id: "discover", title: "Get a shortlist.", description: "Choose your mood, energy, and available time. Get up to three recommendations. Skip a game or lock one in.", image: "discovery", alt: "Discovery screen with Hades, Stardew Valley and Hollow Knight recommendations" },
  { id: "playing", title: "Pick up where you left off.", description: "Set a goal for this session and leave yourself a note for the next one.", image: "now-playing", alt: "Now Playing screen with session timer, goal, and notes" },
  { id: "standby", title: "Keep the session in view.", description: "Open StandBy for a full-screen view of your game art, timer, and session controls.", image: "standby", alt: "StandBy screen with dithered Hades artwork and session controls" },
  { id: "home", title: "Keep track of what you played.", description: "Look back through your sessions and the games you've marked completed.", image: "home", alt: "Home screen showing completed games" },
]

export function LandingPage() {
  return (
    <main className="landing" id="top">
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
          <p className="landing-intro">Not sure what to play? Get up to three games from a curated catalog that fit your mood, energy, and time.</p>
          <div className="landing-actions">
            <Link className="landing-primary" href="/auth/sign-up">Find my next game <ArrowUpRight size={20} aria-hidden="true" /></Link>
            <a className="landing-secondary" href="#how-it-works">See how it works <ArrowDown size={18} aria-hidden="true" /></a>
          </div>
        </div>
        <div className="landing-hero-art">
          <div className="landing-cover landing-cover-back"><Image src={marketingArtwork[1].image} alt="" fill sizes="(max-width: 800px) 50vw, 24vw" /></div>
          <div className="landing-cover landing-cover-front">
            <Image src={marketingArtwork[0].image} alt="Hades game cover" fill sizes="(max-width: 800px) 50vw, 24vw" priority />
          </div>
        </div>
      </section>

      <section id="how-it-works" className="landing-product" aria-labelledby="product-title">
        <div className="landing-section-head">
          <h2 id="product-title">Choose a game.<br />Keep your place.</h2>
        </div>
        {screenshots.map((screen) => (
          <article key={screen.id} id={screen.id} className="landing-feature">
            <div className="landing-feature-copy"><h3>{screen.title}</h3><p>{screen.description}</p></div>
            <figure>
              <a href={`/media/${screen.image}.png`} target="_blank" rel="noopener noreferrer" aria-label={`Open full-size ${screen.image.replaceAll("-", " ")} screenshot`}>
                <Image src={`/media/${screen.image}.png`} alt={screen.alt} width={1440} height={900} sizes="(max-width: 800px) 100vw, 65vw" />
              </a>
            </figure>
          </article>
        ))}
      </section>

      <section className="landing-film" id="film" aria-labelledby="film-title">
        <div className="landing-section-head"><h2 id="film-title">Watch the reel.</h2></div>
        <video controls playsInline preload="none" poster="/media/reel-poster.jpg" aria-label="Just Play: Flow through your backlog, a 20-second animated promo">
          <source src="/media/just-play-wide.mp4" type="video/mp4" />
          <track kind="captions" src="/media/reel.vtt" srcLang="en" label="English" default />
          Your browser cannot play the film. <a href="/media/just-play-wide.mp4">Download the MP4</a>.
        </video>
        <details className="landing-transcript"><summary>Read transcript</summary><p>So many games. What fits tonight? Mood. Energy. Time. One good choice. Settle in. Keep your journey. Just Play. Flow through your backlog. Find your next game from a curated catalog.</p></details>
      </section>

      <section className="landing-faq" aria-labelledby="faq-title">
        <h2 id="faq-title">Questions?</h2>
        <details><summary>Does Just Play connect to my Steam library?</summary><p>Not yet. Recommendations come from Just Play&apos;s curated catalog. Library import is planned, not a current feature.</p></details>
        <details><summary>Does it launch or include the games?</summary><p>No. You&apos;ll need access to the game and launch it yourself.</p></details>
        <details><summary>Do I have to track every minute?</summary><p>No. You can turn off time recording for future sessions in Settings. StandBy is optional too.</p></details>
      </section>

      <section className="landing-outro" aria-labelledby="outro-title">
        <h2 id="outro-title">What are you playing tonight?</h2>
        <Link href="/auth/sign-up" className="landing-primary">Find my next game <ArrowUpRight size={20} aria-hidden="true" /></Link>
      </section>
      <footer className="landing-footer"><Link href="/about" className="landing-wordmark">Just Play.</Link><a href="https://www.igdb.com/">Game data: IGDB</a><a href="/media/artwork-credits.txt">Credits</a><a href="#top">Back to top ↑</a></footer>
    </main>
  )
}
