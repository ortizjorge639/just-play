import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { removeDisposableProfile } from "./disposable-profile"

// The kernel race is nondeterministic: inject only its error at the filesystem
// boundary, then perform the real removal against an actual disposable profile.
test("profile cleanup retries a transient Chromium file-writer race", async () => {
  const profile = await mkdtemp(path.join(tmpdir(), "jp-profile-regression-"))
  await mkdir(path.join(profile, "Default"))
  await writeFile(path.join(profile, "Default", "Preferences"), "{}")
  let attempts = 0
  try {
    await removeDisposableProfile(profile, async target => {
      if (++attempts === 1) throw Object.assign(new Error("directory repopulated"), { code: "ENOTEMPTY" })
      await rm(target, { recursive: true, force: true })
    })
    assert.equal(attempts, 2)
    await assert.rejects(stat(profile), { code: "ENOENT" })
  } finally { await rm(profile, { recursive: true, force: true }) }
})

test("profile cleanup never suppresses a permanent filesystem failure", async () => {
  const failure = Object.assign(new Error("denied"), { code: "EACCES" })
  let attempts = 0
  await assert.rejects(removeDisposableProfile("/unused", async () => { attempts++; throw failure }), error => error === failure)
  assert.equal(attempts, 1)
})

test("profile cleanup bounds retries and propagates an unresolved race", async () => {
  const failure = Object.assign(new Error("busy"), { code: "EBUSY" })
  let attempts = 0
  await assert.rejects(removeDisposableProfile("/unused", async () => { attempts++; throw failure }), error => error === failure)
  assert.equal(attempts, 6)
})
