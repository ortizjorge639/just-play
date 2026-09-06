import test from "node:test"
import assert from "node:assert/strict"
import { Mesh } from "three"
import { buildVillage, disposeVillage } from "../../components/demo/geometry"
import { INTERIOR_CENTER } from "./world"

test("the original village stays batched and contains only finite geometry", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document")
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => ({
        width: 0, height: 0,
        getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }),
      }),
    },
  })
  try {
    for (const built of [false, true]) {
      const group = buildVillage(built)
      let meshes = 0, triangles = 0
      group.traverse(object => {
        if (!(object instanceof Mesh)) return
        meshes++
        const positions = object.geometry.getAttribute("position")
        triangles += (object.geometry.index?.count ?? positions.count) / 3
        for (const coordinate of positions.array) assert.ok(Number.isFinite(coordinate))
        for (let i = 0; i < positions.count; i++) {
          const insideRoom = Math.abs(positions.getX(i) - INTERIOR_CENTER) < 4.9 && Math.abs(positions.getZ(i)) < 4.9
          assert.ok(!insideRoom || positions.getY(i) < 4.8, "Distant scenery intrudes into the open-roof interior")
        }
      })
      assert.ok(meshes <= 40, `Static scenery expanded to ${meshes} draw calls`)
      assert.ok(triangles <= 150_000, `Static scenery expanded to ${triangles} triangles`)
      disposeVillage(group)
    }
  } finally {
    if (previous) Object.defineProperty(globalThis, "document", previous)
    else Reflect.deleteProperty(globalThis, "document")
  }
})
