import { Vector2, type Camera, type Scene, type WebGLRenderer } from "three"

type CaptureRenderer = Pick<WebGLRenderer,
  "domElement" | "getDrawingBufferSize" | "getRenderTarget" | "getActiveCubeFace" |
  "getActiveMipmapLevel" | "setRenderTarget" | "render"
>

export async function captureScenePng(renderer: CaptureRenderer, scene: Scene, camera: Camera): Promise<Blob> {
  const dimensions = renderer.getDrawingBufferSize(new Vector2())
  const width = Math.floor(dimensions.x)
  const height = Math.floor(dimensions.y)
  if (width < 1 || height < 1) throw new Error("The drawing buffer is empty.")

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  try {
    const context = canvas.getContext("2d")
    if (!context) throw new Error("A 2D canvas is unavailable.")
    const previousTarget = renderer.getRenderTarget()
    const previousCubeFace = renderer.getActiveCubeFace()
    const previousMipmapLevel = renderer.getActiveMipmapLevel()
    try {
      // Copy synchronously: the default framebuffer keeps tone mapping and MSAA,
      // but its contents may be discarded after yielding to the browser.
      renderer.setRenderTarget(null)
      renderer.render(scene, camera)
      context.drawImage(renderer.domElement, 0, 0, width, height)
    } finally {
      renderer.setRenderTarget(previousTarget, previousCubeFace, previousMipmapLevel)
    }
    if (!context.getImageData(0, 0, width, height).data.some(channel => channel !== 0)) {
      throw new Error("The rendered image is blank.")
    }
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob?.size) resolve(blob)
        else reject(new Error("The PNG encoder returned an empty image."))
      }, "image/png")
    })
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}
