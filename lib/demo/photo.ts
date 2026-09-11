import {
  Vector2,
  WebGLRenderTarget,
  type Camera,
  type Scene,
  type WebGLRenderer,
} from "three"

function encodePng(pixels: Uint8Array, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) throw new Error("A 2D canvas is unavailable.")
  const image = context.createImageData(width, height)
  const rowLength = width * 4
  for (let row = 0; row < height; row++) {
    const source = (height - row - 1) * rowLength
    image.data.set(pixels.subarray(source, source + rowLength), row * rowLength)
  }
  context.putImageData(image, 0, 0)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob?.size) resolve(blob)
      else reject(new Error("The PNG encoder returned an empty image."))
    }, "image/png")
  }).finally(() => {
    canvas.width = 0
    canvas.height = 0
  })
}

export async function captureScenePng(renderer: WebGLRenderer, scene: Scene, camera: Camera): Promise<Blob> {
  const dimensions = renderer.getDrawingBufferSize(new Vector2())
  const width = Math.floor(dimensions.x)
  const height = Math.floor(dimensions.y)
  if (width < 1 || height < 1) throw new Error("The drawing buffer is empty.")

  const target = new WebGLRenderTarget(width, height, { depthBuffer: true, stencilBuffer: false })
  target.texture.colorSpace = renderer.outputColorSpace
  const previousTarget = renderer.getRenderTarget()
  const previousCubeFace = renderer.getActiveCubeFace()
  const previousMipmapLevel = renderer.getActiveMipmapLevel()
  const pixels = new Uint8Array(width * height * 4)
  try {
    renderer.setRenderTarget(target)
    renderer.render(scene, camera)
    renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels)
  } finally {
    renderer.setRenderTarget(previousTarget, previousCubeFace, previousMipmapLevel)
    target.dispose()
  }
  if (!pixels.some(channel => channel !== 0)) throw new Error("The rendered image is blank.")
  return encodePng(pixels, width, height)
}
