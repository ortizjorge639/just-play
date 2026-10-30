import { test } from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import { build } from "esbuild"
import type { Scene } from "three"
import type { mountSettlement } from "./renderer"

// Keep the real scene, figures and scheduler; replace only browser I/O.
const threeURL = pathToFileURL(createRequire(`${process.cwd()}/package.json`).resolve("three")).href
const rendererPromise = build({
  entryPoints: ["components/settlement/renderer.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  plugins: [{
    name: "renderer-browser-io",
    setup(build) {
      build.onResolve({ filter: /^file:/ }, args => ({ path: args.path, external: true }))
      build.onResolve({ filter: /^(three|three\/addons\/loaders\/GLTFLoader\.js|\.\/sound)$/ }, args => ({
        path: args.path, namespace: "browser-io",
      }))
      build.onLoad({ filter: /.*/, namespace: "browser-io" }, args => ({
        contents: args.path === "three" ? `
          export * from ${JSON.stringify(threeURL)}
          export class WebGLRenderer {
            domElement = Object.assign(new EventTarget(), { setAttribute() {}, remove() {} })
            setPixelRatio() {}
            setSize() {}
            render(scene) {
              globalThis.settlementRenderedScene = scene
              globalThis.settlementRenderCount++
            }
            dispose() {}
            forceContextLoss() {}
          }
        ` : args.path === "./sound" ? `
          export const playLand = () => { globalThis.settlementLandings++ }
          export const startAmbient = () => () => {}
        ` : `
          import { Group } from ${JSON.stringify(threeURL)}
          export class GLTFLoader {
            async parseAsync() { return { scene: new Group(), animations: [] } }
          }
        `,
      }))
    },
  }],
}).then(bundle => import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`)) as Promise<{
  mountSettlement: typeof mountSettlement
}>

for (const stage of ["waiting", "falling", "ordinary", "already-reduced"] as const) {
  test(`resident arrival finishes visibly when ${stage}`, async t => {
    const renderer = await rendererPromise
    let now = 1000, nextFrame = 0
    const frames = new Map<number, FrameRequestCallback>()
    const motion = Object.assign(new EventTarget(), { matches: stage === "already-reduced" })
    const document = Object.assign(new EventTarget(), { hidden: false })
    const globals = {
      document,
      matchMedia: () => motion,
      performance: { now: () => now },
      devicePixelRatio: 1,
      ResizeObserver: class { observe() {} disconnect() {} },
      fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }),
      requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame },
      cancelAnimationFrame: (id: number) => { frames.delete(id) },
      settlementRenderedScene: undefined as Scene | undefined,
      settlementRenderCount: 0,
      settlementLandings: 0,
    }
    const originals = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
    for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
    const controller = new AbortController()
    t.after(() => {
      controller.abort()
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else Reflect.deleteProperty(globalThis, key)
      }
    })
    const host = Object.assign(new EventTarget(), {
      dataset: {} as Record<string, string>,
      appendChild() {},
      getBoundingClientRect: () => ({ width: 640, height: 480 }),
    })
    await renderer.mountSettlement(host as unknown as HTMLElement, {
      version: 1,
      decks: [{ index: 0, parent: null, residents: 2 }],
      placements: ["first", "second"].map((gameId, slot) => ({ gameId, slot, deck: 0, partId: "", rotation: 0, tier: 0 })),
    }, controller.signal)
    const scene = (globalThis as typeof globalThis & { settlementRenderedScene: Scene }).settlementRenderedScene
    const receipts = globalThis as typeof globalThis & { settlementRenderCount: number; settlementLandings: number }
    const figures = scene.children.filter(object => object.scale.x === 1.25)
    assert.equal(figures.length, 2)
    const rest = figures.map(figure => figure.position.y)
    const arrivals: string[] = []
    host.addEventListener("settlement-arrived", event => arrivals.push((event as CustomEvent<string>).detail))
    const advance = (milliseconds: number) => {
      now += milliseconds
      const callbacks = [...frames.values()]
      frames.clear()
      callbacks.forEach(callback => callback(now))
    }
    host.dispatchEvent(new CustomEvent("settlement-arrive", { detail: ["first", "second"] }))
    if (stage !== "already-reduced") {
      assert.ok(figures.every(figure => !figure.visible))
      if (stage === "falling" || stage === "ordinary") {
        advance(200)
        assert.equal(figures[0].visible, true)
        assert.ok(figures[0].position.y > rest[0])
        assert.equal(figures[1].visible, false, "staggered arrival is still waiting")
      }
      if (stage === "ordinary") {
        advance(1500)
      } else {
        const renders = receipts.settlementRenderCount
        motion.matches = true
        motion.dispatchEvent(new Event("change"))
        assert.equal(frames.size, 0, "reduced motion stops the frame loop")
        assert.ok(receipts.settlementRenderCount > renders, "the final visible state must be drawn without another frame")
      }
    }
    assert.ok(figures.every(figure => figure.visible), "all arriving residents must be visible")
    assert.deepEqual(figures.map(figure => figure.position.y), rest, "residents must land at their resting height")
    assert.deepEqual(arrivals, ["first", "second"], "arrival completes exactly once for each resident")
    assert.equal(receipts.settlementLandings, stage === "ordinary" ? 2 : 0, "only animated arrivals play landing effects")
    if (stage !== "ordinary") {
      motion.matches = false
      motion.dispatchEvent(new Event("change"))
      assert.equal(frames.size, 1, "ordinary animation resumes")
      advance(100)
      assert.ok(figures.every(figure => figure.visible))
      assert.deepEqual(figures.map(figure => figure.position.y), rest)
      assert.deepEqual(arrivals, ["first", "second"], "completed arrivals must not replay")
    }
  })
}
