import { GLTFLoader as OriginalLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

interface LoadGate { waiting: boolean; release?: () => void }
declare global {
  interface Window { canopyParseGate?: LoadGate; canopyHashGate?: LoadGate }
}

// Harness-only barrier after the real parser; production imports the real loader.
export class GLTFLoader extends OriginalLoader {
  override async parseAsync(data: string | ArrayBuffer, path: string) {
    const gltf = await super.parseAsync(data, path)
    const gate = window.canopyParseGate
    if (gate) {
      gate.waiting = true
      await new Promise<void>(resolve => { gate.release = resolve })
    }
    return gltf
  }
}
