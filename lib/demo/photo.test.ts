import test from "node:test"
import assert from "node:assert/strict"
import { SRGBColorSpace, type Camera, type Scene, type WebGLRenderer, type WebGLRenderTarget } from "three"
import { captureScenePng } from "./photo"

test("photo capture flips WebGL pixels, restores renderer state and releases its target", async () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document")
  let encoded: Uint8ClampedArray | null = null
  let canvasWidth = 0
  let canvasHeight = 0
  let encodedWidth = 0
  let encodedHeight = 0
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => ({
        get width() { return canvasWidth },
        set width(value: number) { canvasWidth = value },
        get height() { return canvasHeight },
        set height(value: number) { canvasHeight = value },
        getContext: () => ({
          createImageData: (width: number, height: number) => ({
            data: new Uint8ClampedArray(width * height * 4),
          }),
          putImageData: (image: ImageData) => { encoded = image.data },
        }),
        toBlob: (callback: BlobCallback, type: string) => {
          encodedWidth = canvasWidth
          encodedHeight = canvasHeight
          callback(new Blob([encoded!], { type }))
        },
      }),
    },
  })

  const previous = {} as WebGLRenderTarget
  let current: WebGLRenderTarget | null = previous
  let disposed = false
  let renders = 0
  let captureColorSpace = ""
  let restoredCubeFace = -1
  let restoredMipmapLevel = -1
  const renderer = {
    outputColorSpace: SRGBColorSpace,
    getDrawingBufferSize: (size: { set: (x: number, y: number) => unknown }) => size.set(2, 2),
    getRenderTarget: () => current,
    getActiveCubeFace: () => 3,
    getActiveMipmapLevel: () => 2,
    setRenderTarget: (target: WebGLRenderTarget | null, cubeFace?: number, mipmapLevel?: number) => {
      current = target
      if (target && target !== previous) {
        captureColorSpace = target.texture.colorSpace
        target.addEventListener("dispose", () => { disposed = true })
      } else if (target === previous) {
        restoredCubeFace = cubeFace ?? -1
        restoredMipmapLevel = mipmapLevel ?? -1
      }
    },
    render: () => { renders++ },
    readRenderTargetPixels: (_target: WebGLRenderTarget, _x: number, _y: number, _width: number, _height: number, pixels: Uint8Array) => {
      pixels.set([
        220, 20, 10, 255, 220, 20, 10, 255,
        10, 20, 220, 255, 10, 20, 220, 255,
      ])
    },
  } as unknown as WebGLRenderer

  try {
    const blob = await captureScenePng(renderer, {} as Scene, {} as Camera)
    assert.equal(blob.type, "image/png")
    assert.ok(blob.size > 0)
    assert.equal(renders, 1)
    assert.equal(current, previous)
    assert.equal(disposed, true)
    assert.equal(captureColorSpace, SRGBColorSpace)
    assert.equal(restoredCubeFace, 3)
    assert.equal(restoredMipmapLevel, 2)
    assert.equal(encodedWidth, 2)
    assert.equal(encodedHeight, 2)
    assert.equal(canvasWidth, 0)
    assert.equal(canvasHeight, 0)
    assert.deepEqual(Array.from(encoded!.slice(0, 4)), [10, 20, 220, 255])
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument)
    else Reflect.deleteProperty(globalThis, "document")
  }
})

test("photo capture rejects a blank render and still releases its target", async () => {
  let current: WebGLRenderTarget | null = null
  let disposed = false
  const renderer = {
    outputColorSpace: SRGBColorSpace,
    getDrawingBufferSize: (size: { set: (x: number, y: number) => unknown }) => size.set(1, 1),
    getRenderTarget: () => null,
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
    setRenderTarget: (target: WebGLRenderTarget | null) => {
      current = target
      if (target) target.addEventListener("dispose", () => { disposed = true })
    },
    render: () => undefined,
    readRenderTargetPixels: () => undefined,
  } as unknown as WebGLRenderer

  await assert.rejects(captureScenePng(renderer, {} as Scene, {} as Camera), /blank/)
  assert.equal(current, null)
  assert.equal(disposed, true)
})
