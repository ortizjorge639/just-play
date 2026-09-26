import { memo, useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { AnimatePresence, LazyMotion, domMax, m, MotionConfig, useReducedMotion } from "framer-motion";
import { createWorld, type World } from "./scene";
import { isSave, loadSave, minutesLabel, SAMPLE_GAMES, SAVE_KEY, type Game, type Kind, type Save, type View } from "./data";

type IconName = "leaf" | "book" | "play" | "home" | "plus" | "sun" | "moon" | "arrow" | "close" | "check" | "pause" | "sound" | "clock" | "flower" | "minus" | "reset" | "search";
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    leaf: <><path d="M19 4C9 2 3 6 5 13c2 7 12 5 14-9Z" /><path d="m5 20 9-11M9 15l-1-5m3 3 5 1" /></>,
    book: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9 4v16m4-11h3m-3 4h3" /></>,
    play: <path d="m9 5 10 7-10 7V5Z" />,
    home: <><path d="m3 11 9-8 9 8M5 10v10h14V10" /><path d="M10 20v-7h4v7" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1" /></>,
    moon: <path d="M19 15A8 8 0 0 1 9 5a8 8 0 1 0 10 10Z" />,
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    pause: <><path d="M8 5v14m8-14v14" /></>,
    sound: <><path d="m4 10 4 0 5-4v12l-5-4H4v-4Zm12-2a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
    clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
    flower: <><path d="M12 20v-6m0 3 5-2M12 8c-5-10-12 1-4 3-8 7 5 12 4 3 8 7 12-5 4-3 8-6-4-12-4-3Z" /><circle cx="12" cy="11" r="2" /></>,
    minus: <path d="M5 12h14" />,
    reset: <><path d="M4 10a8 8 0 1 1 2 8M4 4v6h6" /></>,
    search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const Portrait = memo(function Portrait({ game, large = false }: { game: Game; large?: boolean }) {
  return <svg className={`portrait${large ? " portrait-large" : ""}`} viewBox="0 0 120 120" aria-hidden="true">
    <ellipse cx="60" cy="107" rx="29" ry="5" fill="#304f3e" opacity=".12" />
    <ellipse cx="60" cy="88" rx="23" ry="23" fill={game.accent} />
    <ellipse cx="60" cy="88" rx="11" ry="12" fill="#f5e5c4" />
    <ellipse cx="45" cy="105" rx="10" ry="7" fill={game.color} />
    <ellipse cx="75" cy="105" rx="10" ry="7" fill={game.color} />
    {game.kind === "bunny"
      ? <><ellipse cx="40" cy="27" rx="10" ry="24" fill={game.color} transform="rotate(-12 40 27)" /><ellipse cx="80" cy="27" rx="10" ry="24" fill={game.color} transform="rotate(12 80 27)" /></>
      : game.kind === "cat" || game.kind === "fox"
        ? <><path d="m25 45 3-31 30 26m5 0 29-26 3 31" fill={game.color} /><path d="m33 35 1-12 13 15m27 0 12-15 1 12" fill="#e8b3a4" /></>
        : game.kind !== "bird" ? <><circle cx="32" cy="38" r="12" fill={game.color} /><circle cx="88" cy="38" r="12" fill={game.color} /></> : null}
    <ellipse cx="60" cy="58" rx="38" ry="31" fill={game.color} />
    <ellipse cx="60" cy="71" rx="20" ry="13" fill="#f5e5c4" />
    <ellipse cx="46" cy="57" rx="3.5" ry="5" fill="#354132" /><ellipse cx="74" cy="57" rx="3.5" ry="5" fill="#354132" />
    <circle cx="45" cy="55" r="1.2" fill="#fff8e7" /><circle cx="73" cy="55" r="1.2" fill="#fff8e7" />
    <ellipse cx="35" cy="68" rx="5.5" ry="3" fill="#df9b8f" /><ellipse cx="85" cy="68" rx="5.5" ry="3" fill="#df9b8f" />
    {game.kind === "bird" ? <path d="m52 66 16 0-8 11Z" fill="#d99d42" /> : <><path d="m56 66 8 0-4 5Z" fill="#4a4c36" /><path d="M56 75q4 4 8 0" fill="none" stroke="#6a5945" strokeWidth="1.5" strokeLinecap="round" /></>}
    <path d="M62 32c-3-13 9-17 17-14-1 10-8 16-17 14Z" fill="#678d65" /><path d="m62 33 9-10" stroke="#4e7154" strokeWidth="1.5" />
  </svg>;
});

const Art = memo(function Art({ game }: { game: Game }) {
  return <m.div layoutId={`game-art-${game.id}`} transition={{ type: "spring", stiffness: 210, damping: 27 }} className={`game-art art-${game.kind}`} style={{ "--art-color": game.accent, "--resident-color": game.color } as CSSProperties}>
    <span className="art-sun" /><span className="art-hill hill-back" /><span className="art-hill hill-front" />
    <span className="art-leaf leaf-one"><Icon name="leaf" size={38} /></span>
    <span className="art-leaf leaf-two"><Icon name="leaf" size={26} /></span>
    <Portrait game={game} large />
    <span className="art-caption">{game.resident}&apos;s next chapter</span>
  </m.div>;
});

function SessionClock({ game, session, onToggle, onLog }: {
  game: Game; session: Save["session"]; onToggle: () => void; onLog: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const active = session?.gameId === game.id;
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  const seconds = active ? Math.max(0, Math.floor((now - session.startedAt) / 1000)) : 0;
  const reached = seconds >= game.goal * 60;
  return <div className="session-controls">
    <div className="session-label"><Icon name="clock" size={17} /><span>{active ? "A little time for yourself" : "Make a little room to play"}</span>
      <span className="timer" aria-label="Session elapsed time">{`${Math.floor(seconds / 60)}`.padStart(2, "0")}:{`${seconds % 60}`.padStart(2, "0")}</span></div>
    <div className="goal-track" role="progressbar" aria-label="Session goal" aria-valuenow={Math.min(seconds, game.goal * 60)} aria-valuemin={0} aria-valuemax={game.goal * 60}>
      <span style={{ transform: `scaleX(${Math.min(1, seconds / (game.goal * 60))})` }} />
    </div>
    <p className="goal-copy" aria-live="polite">{reached ? "A lovely little session. Keep going, or call it a day." : `${game.goal}-minute goal. No rush, no streaks.`}</p>
    <div className="button-row">
      <button className="button primary" onClick={onToggle}><Icon name={active ? "pause" : "play"} size={17} />{active ? "Pause & save" : "Start a session"}</button>
      {!active && <button className="button text-button" onClick={onLog}>Log {game.goal} min<Icon name="plus" size={15} /></button>}
    </div>
  </div>;
}

function App() {
  const [initial] = useState(loadSave);
  const [save, setSave] = useState(initial.save);
  const [storageError, setStorageError] = useState(initial.error);
  const [view, setView] = useState<View>("treehouse");
  const [selectedId, setSelectedId] = useState<string | null>(() => initial.save.games.find(g => g.status === "completed")?.id || null);
  const [arrival, setArrival] = useState<string | null>(null);
  const [night, setNight] = useState(false);
  const [pausedMotion, setPausedMotion] = useState(false);
  const [rendererState, setRendererState] = useState("Planting your treehouse...");
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const reducedMotion = useReducedMotion();
  const canvas = useRef<HTMLCanvasElement>(null);
  const world = useRef<World | null>(null);
  const addDialog = useRef<HTMLDialogElement>(null);
  const settingsDialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const noticeTimer = useRef<number | null>(null);
  const selected = save.games.find(g => g.id === selectedId && g.status === "completed") || save.games.find(g => g.status === "completed");
  const residents = save.games.filter(g => g.status === "completed");
  const playing = save.games.filter(g => g.status === "playing");
  const backlog = save.games.filter(g => g.status === "backlog");
  const motionEnabled = !reducedMotion && !pausedMotion;

  const selectResident = useCallback((id: string) => { setSelectedId(id); world.current?.select(id); }, []);
  useEffect(() => {
    if (!canvas.current) return;
    let cancelled = false;
    let scene: World | null = null;
    createWorld(canvas.current, initial.save.games, selectResident,
      backend => { if (!cancelled) setRendererState(backend); },
      error => { if (!cancelled) setRendererError(error); },
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    ).then(result => {
      if (cancelled) result.dispose();
      else { scene = result; world.current = result; }
    }).catch((error: unknown) => {
      console.error("Treehouse initialization failed", error);
      if (!cancelled) setRendererError("Your browser couldn't open the 3D view. Your library still works below. Try an up-to-date browser with graphics acceleration enabled.");
    });
    return () => { cancelled = true; scene?.dispose(); world.current = null; };
  }, [initial.save.games, selectResident]);
  // A ready-state change also applies interactions made while shaders were compiling.
  useEffect(() => { world.current?.update(save.games, arrival); }, [save.games, arrival, rendererState]);
  useEffect(() => { world.current?.setView(view); }, [view, rendererState]);
  useEffect(() => { world.current?.setNight(night); }, [night, rendererState]);
  useEffect(() => { world.current?.setMotion(motionEnabled); }, [motionEnabled, rendererState]);
  useEffect(() => { world.current?.select(selectedId); }, [selectedId, rendererState]);
  useEffect(() => {
    if (showAdd) addDialog.current?.showModal();
    else addDialog.current?.close();
  }, [showAdd]);
  useEffect(() => {
    if (showSettings) settingsDialog.current?.showModal();
    else settingsDialog.current?.close();
  }, [showSettings]);
  useEffect(() => () => { if (noticeTimer.current !== null) clearTimeout(noticeTimer.current); }, []);

  function announce(text: string) {
    setNotice(text);
    if (noticeTimer.current !== null) clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 5200);
  }
  function commit(next: Save) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(next));
      setStorageError(null);
    } catch (error) {
      console.warn("Treehouse: unable to persist change", error);
      setStorageError("This change is only in this tab. Local storage is unavailable; keep this page open to avoid losing it.");
    }
    setSave(next);
  }
  function navigate(next: View) {
    setView(next); setQuery("");
    requestAnimationFrame(() => heading.current?.focus());
  }
  function startGame(game: Game) {
    commit({ ...save, games: save.games.map(g => g.id === game.id ? { ...g, status: "playing" } : g) });
    navigate("playing");
    announce(`${game.title} is ready when you are.`);
  }
  function finishGame(game: Game) {
    const elapsed = save.session?.gameId === game.id ? Math.max(0, (Date.now() - save.session.startedAt) / 60000) : 0;
    setArrival(game.id); setSelectedId(game.id);
    commit({ ...save, session: save.session?.gameId === game.id ? null : save.session,
      games: save.games.map(g => g.id === game.id ? { ...g, status: "completed", minutes: g.minutes + elapsed } : g) });
    navigate("treehouse");
    announce(`${game.resident} moved in! A little piece of ${game.title}, here to stay.`);
  }
  function toggleSession(game: Game) {
    const current = save.session;
    const elapsed = current ? Math.max(0, (Date.now() - current.startedAt) / 60000) : 0;
    const stopping = current?.gameId === game.id;
    commit({ ...save,
      games: current ? save.games.map(g => g.id === current.gameId ? { ...g, minutes: g.minutes + elapsed } : g) : save.games,
      session: stopping ? null : { gameId: game.id, startedAt: Date.now() },
    });
    if (stopping) announce(`Session saved. ${minutesLabel(elapsed)} well spent.`);
  }
  function logSession(game: Game) {
    commit({ ...save, games: save.games.map(g => g.id === game.id ? { ...g, minutes: g.minutes + game.goal } : g) });
    announce(`${game.goal} minutes added to ${game.title}. A little time well spent.`);
  }
  function addGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") || "").trim();
    if (!title) return;
    const kind = String(data.get("kind") || "bear") as Kind;
    const sample = SAMPLE_GAMES.find(g => g.kind === kind)!;
    const game: Game = { ...sample, id: crypto.randomUUID(), title, status: "backlog", minutes: 0, resident: String(data.get("resident") || "").trim() || "Sprout", genre: "Your next little adventure", note: "Saved a spot, just for you." };
    commit({ ...save, games: [...save.games, game] });
    setShowAdd(false); navigate("backlog"); announce(`${title} has a place on your shelf.`);
    event.currentTarget.reset();
  }
  function resetDemo() {
    commit({ version: 1, games: SAMPLE_GAMES, session: null });
    setArrival(null); setSelectedId("hike"); setShowSettings(false); navigate("treehouse");
    announce("Sample library restored. A fresh little start.");
  }

  return <MotionConfig reducedMotion={motionEnabled ? "user" : "always"}>
    <LazyMotion features={domMax} strict>
      <div className={`app${night ? " evening" : ""}`} data-view={view}>
        <a className="skip-link" href="#main">Skip to your library</a>
        <header className="header">
          <button className="brand" onClick={() => navigate("treehouse")} aria-label="Just Play home">
            <span className="brand-mark"><Icon name="leaf" size={27} /></span>
            <span>just play<span className="brand-period">.</span></span>
          </button>
          <nav className="navigation" aria-label="Game library">
            {([{ id: "backlog", label: "Backlog", icon: "book", count: backlog.length }, { id: "playing", label: "In progress", icon: "play", count: playing.length }, { id: "treehouse", label: "Treehouse", icon: "home", count: residents.length }] as const).map(tab =>
              <button key={tab.id} className={`nav-tab${view === tab.id ? " active" : ""}`} onClick={() => navigate(tab.id)} aria-current={view === tab.id ? "page" : undefined}>
                <Icon name={tab.icon} size={18} /><span>{tab.label}</span><span className="count">{tab.count}</span>
              </button>)}
          </nav>
          <div className="header-actions">
            <span className="demo-tag">A little demo</span>
            <button className="profile-button" onClick={() => setShowSettings(true)} aria-label="Prototype settings"><span>J</span><span className="profile-leaf"><Icon name="leaf" size={13} /></span></button>
          </div>
        </header>
        {storageError && <div className="storage-error" role="alert">{storageError}<button onClick={() => setShowSettings(true)}>Settings</button></div>}
        <main id="main" tabIndex={-1}>
          <section className={`world-section${view !== "treehouse" ? " world-hidden" : ""}`} aria-label="Your treehouse diorama" aria-hidden={view !== "treehouse"} inert={view !== "treehouse"}>
            <div className="forest-layer forest-back" /><div className="forest-layer forest-front" />
            <div className="world-intro">
              <div className="weather"><Icon name={night ? "moon" : "sun"} size={19} /><span>{night ? "A cozy evening" : "A lovely little afternoon"}</span></div>
              <h1 ref={view === "treehouse" ? heading : undefined} tabIndex={-1}>Good games.<br />Great company.</h1>
              <p>Every game you finish<br />makes this place a little more you.</p>
              <div className="resident-count"><span className="tiny-leaf"><Icon name="leaf" size={15} /></span>{residents.length} {residents.length === 1 ? "resident" : "residents"} & counting</div>
            </div>
            <div className="canvas-wrap">
              <canvas ref={canvas} aria-label="Interactive toy treehouse. Drag to rotate, or use the view controls. Select residents in the list below." />
              {rendererState.includes("Planting") && !rendererError && <div className="scene-loading" role="status"><Icon name="leaf" size={26} />{rendererState}</div>}
              {rendererError && <div className="scene-error" role="alert"><Icon name="home" size={32} /><h2>The list is still lovely.</h2><p>{rendererError}</p></div>}
            </div>
            {selected && <aside className="resident-note" aria-label="Selected resident">
              <span className="note-pin" /><div className="note-portrait"><Portrait game={selected} /></div>
              <AnimatePresence mode="wait" initial={false}>
                <m.div key={selected.id} initial={{ opacity: 0, y: motionEnabled ? 6 : 0 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: motionEnabled ? .2 : 0 }}>
                  <h2>{arrival === selected.id ? `Welcome home, ${selected.resident}.` : `Meet ${selected.resident}.`}</h2>
                  <p>&ldquo;{selected.note}&rdquo;</p>
                  <span className="note-rule" /><span className="note-game">{selected.title}</span>
                  <span className="note-foot"><Icon name="check" size={13} />A story you finished</span>
                </m.div>
              </AnimatePresence>
            </aside>}
            <div className="world-bottom">
              <span className="world-hint"><Icon name="leaf" size={16} />{residents.length > 12 ? "12 friends visiting. Pick anyone below to bring them into view." : "A home for your happy endings."}</span>
              <div className="world-controls" aria-label="Diorama controls">
                <button onClick={() => world.current?.rotate(-1)} aria-label="Rotate left" title="Rotate left"><span className="rotate-left"><Icon name="reset" size={17} /></span></button>
                <button onClick={() => world.current?.home()} aria-label="Reset view" title="Reset view"><Icon name="home" size={17} /></button>
                <button onClick={() => world.current?.rotate(1)} aria-label="Rotate right" title="Rotate right"><Icon name="reset" size={17} /></button>
                <span className="control-divider" />
                <button onClick={() => world.current?.zoom(-1)} aria-label="Zoom out" title="Zoom out"><Icon name="minus" size={17} /></button>
                <button onClick={() => world.current?.zoom(1)} aria-label="Zoom in" title="Zoom in"><Icon name="plus" size={17} /></button>
                <span className="control-divider" />
                <button onClick={() => setNight(!night)} aria-label={night ? "Switch to afternoon" : "Switch to evening"} title={night ? "Afternoon" : "Evening"}><Icon name={night ? "sun" : "moon"} size={17} /></button>
                <button onClick={() => setPausedMotion(!pausedMotion)} aria-pressed={pausedMotion} aria-label={pausedMotion ? "Resume ambient motion" : "Pause ambient motion"} title="Ambient motion"><Icon name={pausedMotion ? "play" : "pause"} size={17} /></button>
              </div>
            </div>
          </section>
          {view === "treehouse" && <section className="resident-section" aria-labelledby="residents-title">
            <div className="section-heading"><div><h2 id="residents-title">Look who&apos;s made themselves at home</h2><p>Your completed games, keeping you company.</p></div><span className="completed-label"><Icon name="check" size={15} />Completed</span></div>
            {residents.length ? <div className="resident-shelf">
              {residents.map(game => <button className={`resident-item${game.id === selected?.id ? " selected" : ""}`} key={game.id} onClick={() => selectResident(game.id)} aria-pressed={game.id === selected?.id}>
                <span className="resident-portrait" style={{ "--resident-tint": game.accent } as CSSProperties}><Portrait game={game} /></span>
                <span className="resident-details"><strong>{game.title}</strong><span>{game.resident} lives here now</span><span className="resident-time">{minutesLabel(game.minutes)} of memories</span></span>
                <span className="resident-check"><Icon name="check" size={13} /></span>
              </button>)}
            </div> : <div className="empty-state"><Icon name="home" size={40} /><h3>A little room to grow.</h3><p>Finish a game and your first resident will move in.</p><button className="button primary" onClick={() => navigate("playing")}>See your games<Icon name="arrow" size={17} /></button></div>}
            {selected && <aside className="mobile-resident-note" aria-label="Selected resident on mobile"><Portrait game={selected} /><div><h3>Meet {selected.resident}.</h3><p>&ldquo;{selected.note}&rdquo;</p><span>{selected.title}</span></div></aside>}
            <div className="next-adventure"><div className="next-icon"><Icon name="flower" size={24} /></div><div><strong>There&apos;s room for your next adventure.</strong><span>No need to rush. Your treehouse grows with you.</span></div><button onClick={() => navigate("backlog")}>Visit your backlog<Icon name="arrow" size={17} /></button></div>
          </section>}
          {view === "backlog" && <section className="library-section" aria-labelledby="backlog-title">
            <div className="library-heading"><div><h1 id="backlog-title" ref={heading} tabIndex={-1}>Little adventures, waiting.</h1><p>A shelf of possibilities. Pick what feels good today.</p></div><button className="button primary" onClick={() => setShowAdd(true)} disabled={save.games.length >= 100}><Icon name="plus" size={17} />Add a game</button></div>
            <div className="library-toolbar"><span>{backlog.length} games on your shelf</span><label className="search-field"><Icon name="search" size={17} /><input type="search" aria-label="Search backlog" placeholder="Find a little adventure..." value={query} onChange={event => setQuery(event.target.value)} /></label></div>
            <div className="game-grid">{backlog.filter(game => game.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(game =>
              <article className="game-card" key={game.id}>
                <Art game={game} /><div className="game-card-body"><h2>{game.title}</h2><p>{game.genre}</p><button className="button secondary" onClick={() => startGame(game)}>Start playing<Icon name="arrow" size={16} /></button></div>
              </article>)}</div>
            {!backlog.length && <div className="empty-state"><Icon name="book" size={40} /><h2>A clear shelf. A fresh start.</h2><p>Add a game whenever something catches your eye.</p><button className="button primary" onClick={() => setShowAdd(true)}>Add a game</button></div>}
            {backlog.length > 0 && !backlog.some(game => game.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())) && <div className="empty-state"><h2>No games by that name.</h2><button className="button secondary" onClick={() => setQuery("")}>Clear search</button></div>}
            <p className="library-note"><Icon name="leaf" size={16} />A backlog is a collection of possibilities, not a to-do list.</p>
          </section>}
          {view === "playing" && <section className="library-section progress-section" aria-labelledby="progress-title">
            <div className="library-heading"><div><h1 id="progress-title" ref={heading} tabIndex={-1}>A little time to play.</h1><p>You don&apos;t have to finish today. Just enjoy being here.</p></div><span className="playing-badge"><span />{playing.length} in progress</span></div>
            <div className="playing-list">{playing.map(game => <article className="playing-card" key={game.id}>
              <Art game={game} /><div className="playing-info"><div className="playing-title"><div><h2>{game.title}</h2><p>{game.genre}</p></div><span className="time-played">{minutesLabel(game.minutes)} played</span></div>
                <SessionClock game={game} session={save.session} onToggle={() => toggleSession(game)} onLog={() => logSession(game)} />
                <div className="finish-row"><span><Icon name="home" size={17} />{game.resident} has a place waiting.</span><button onClick={() => finishGame(game)}>Finished the game?<Icon name="check" size={16} /></button></div>
              </div>
            </article>)}</div>
            {!playing.length && <div className="empty-state"><Icon name="play" size={40} /><h2>What are you in the mood for?</h2><p>Choose something from your backlog. Its story starts with you.</p><button className="button primary" onClick={() => navigate("backlog")}>Find your next game<Icon name="arrow" size={17} /></button></div>}
          </section>}
        </main>
        <footer><span><Icon name="leaf" size={14} />A little progress. A lovely place.</span><span>Sample library · Saved on this device <span className="footer-dot">·</span> <button onClick={() => setShowSettings(true)}>About this prototype</button></span></footer>
        <div className="notice-region" role="status" aria-live="polite" aria-atomic="true">
          <AnimatePresence>{notice && <m.div className="toast" key={notice} initial={{ opacity: 0, y: motionEnabled ? 24 : 0, scale: motionEnabled ? .95 : 1 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: motionEnabled ? 8 : 0 }} transition={{ type: "spring", stiffness: 250, damping: 24 }}><span><Icon name="leaf" size={23} /></span>{notice}<button aria-label="Dismiss notification" onClick={() => setNotice("")}><Icon name="close" size={16} /></button></m.div>}</AnimatePresence>
        </div>
        <dialog ref={addDialog} className="dialog" onCancel={() => setShowAdd(false)} onClose={() => setShowAdd(false)} aria-labelledby="add-title">
          <button className="dialog-close" onClick={() => setShowAdd(false)} aria-label="Close add game"><Icon name="close" /></button><Icon name="book" size={28} /><h2 id="add-title">A new little possibility.</h2><p>Add a game to this device&apos;s sample library.</p>
          <form onSubmit={addGame}><label>Game title<input name="title" required maxLength={100} placeholder="What would you like to play?" /></label><label>Resident name<input name="resident" maxLength={24} placeholder="Sprout" /></label><label>Your future friend<select name="kind" defaultValue="bear"><option value="bear">A little bear</option><option value="fox">A little fox</option><option value="bunny">A little bunny</option><option value="bird">A little bird</option><option value="cat">A little cat</option><option value="frog">A little frog</option></select></label><button className="button primary" type="submit">Add to backlog<Icon name="plus" size={17} /></button></form>
        </dialog>
        <dialog ref={settingsDialog} className="dialog settings-dialog" onCancel={() => setShowSettings(false)} onClose={() => setShowSettings(false)} aria-labelledby="settings-title">
          <button className="dialog-close" onClick={() => setShowSettings(false)} aria-label="Close settings"><Icon name="close" /></button><Icon name="leaf" size={28} /><h2 id="settings-title">Your little prototype.</h2><p>An original toy world for Just Play. Sample games, original residents, no account needed.</p>
          <dl className="settings-facts"><div><dt>Renderer</dt><dd>{rendererError ? "3D unavailable" : rendererState}</dd></div><div><dt>Your library</dt><dd>Stored on this device only</dd></div><div><dt>Connections</dt><dd>No Supabase, IGDB, or CDN</dd></div><div><dt>Motion</dt><dd>{reducedMotion ? "Reduced (system preference)" : pausedMotion ? "Paused" : "Gentle ambient movement"}</dd></div></dl>
          <p className="settings-small">Resetting replaces only this prototype&apos;s local library, including games you added. It does not touch your Just Play account.</p>
          <form onSubmit={event => { event.preventDefault(); resetDemo(); }}><label className="confirm-reset"><input type="checkbox" required />I want to restore the sample library.</label><button className="button secondary" type="submit"><Icon name="reset" size={16} />Reset demo library</button></form>
        </dialog>
      </div>
    </LazyMotion>
  </MotionConfig>;
}

// The runtime schema is shared with tests and the future production adapter.
export { isSave };
createRoot(document.getElementById("root")!).render(<App />);
