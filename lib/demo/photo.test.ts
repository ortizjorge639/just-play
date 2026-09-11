import test from "node:test"
import assert from "node:assert/strict"
import { PerspectiveCamera, Scene, Vector2, WebGLRenderTarget } from "three"
import { captureScenePng } from "./photo"

async function fixture(run: (value: {
  renderer: Parameters<typeof captureScenePng>[0]
  events: string[]
  size: () => [number, number]
  setBlank: () => void
  setRenderFailure: () => void
}) => Promise<void>) {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document")
  const events: string[] = []
  let width = 0, height = 0, blank = false, renderFailure = false
  const source = {} as HTMLCanvasElement
  const previousTarget = new WebGLRenderTarget(1, 1)
  let current: ReturnType<Parameters<typeof captureScenePng>[0]["getRenderTarget"]> = previousTarget
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => ({
        get width() { return width },
        set width(value: number) { width = value },
        get height() { return height },
        set height(value: number) { height = value },
        getContext: () => ({
          drawImage: (image: HTMLCanvasElement, x: number, y: number, w: number, h: number) => {
            assert.equal(current, null, "Copy the display framebuffer, not a linear render target")
            assert.equal(image, source)
            assert.deepEqual([x, y, w, h], [0, 0, 2, 2])
            events.push("copy")
          },
          getImageData: () => ({ data: new Uint8ClampedArray(blank ? [0, 0, 0, 0] : [10, 20, 30, 255]) }),
        }),
        toBlob: (callback: BlobCallback, type: string) => {
          assert.deepEqual([width, height], [2, 2])
          assert.equal(current, previousTarget)
          events.push("encode")
          callback(new Blob(["copied display pixels"], { type }))
        },
      }),
    },
  })
  const renderer: Parameters<typeof captureScenePng>[0] = {
    domElement: source,
    getDrawingBufferSize: (size: Vector2) => size.set(2, 2),
    getRenderTarget: () => current,
    getActiveCubeFace: () => 3,
    getActiveMipmapLevel: () => 2,
    setRenderTarget: (target, face, level) => {
      assert.ok(target === null || target === previousTarget, "Capture must not allocate an off-screen render target")
      current = target === null ? null : previousTarget
      if (target === previousTarget) {
        assert.equal(face, 3)
        assert.equal(level, 2)
        events.push("restore")
      } else events.push("display")
    },
    render: () => {
      assert.equal(current, null)
      events.push("render")
      if (renderFailure) throw new Error("render failed")
    },
  }
  try {
    await run({
      renderer, events, size: () => [width, height],
      setBlank: () => { blank = true },
      setRenderFailure: () => { renderFailure = true },
    })
  } finally {
    previousTarget.dispose()
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument)
    else Reflect.deleteProperty(globalThis, "document")
  }
}

test("photo copies the display synchronously before encoding, then releases its canvas", async () => {
  await fixture(async ({ renderer, events, size }) => {
    const pending = captureScenePng(renderer, new Scene(), new PerspectiveCamera())
    assert.deepEqual(events, ["display", "render", "copy", "restore", "encode"])
    const blob = await pending
    assert.equal(blob.type, "image/png")
    assert.ok(blob.size > 0)
    assert.deepEqual(size(), [0, 0])
  })
})

test("photo restores the previous renderer target and releases memory on render failure", async () => {
  await fixture(async ({ renderer, events, size, setRenderFailure }) => {
    setRenderFailure()
    await assert.rejects(captureScenePng(renderer, new Scene(), new PerspectiveCamera()), /render failed/)
    assert.deepEqual(events, ["display", "render", "restore"])
    assert.deepEqual(size(), [0, 0])
  })
})

test("photo rejects an empty copied frame and releases its canvas", async () => {
  await fixture(async ({ renderer, events, size, setBlank }) => {
    setBlank()
    await assert.rejects(captureScenePng(renderer, new Scene(), new PerspectiveCamera()), /blank/)
    assert.deepEqual(events, ["display", "render", "copy", "restore"])
    assert.deepEqual(size(), [0, 0])
  })
})
