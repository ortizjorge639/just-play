import assert from 'node:assert/strict';
import { mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function captureFrames({ page, output, frames, fps, sample }) {
  assert.ok(Number.isInteger(frames) && frames > 0 && Number.isFinite(fps) && fps > 0);
  await mkdir(output, { recursive: true });
  assert.ok(!(await readdir(output)).some(name => /^frame-\d+\.png$/.test(name)), `Frame sequence already exists at ${output}; move it before recording again.`);
  for (let frame = 0; frame < frames; frame++) {
    await page.evaluate(sample, { frame, seconds: frame / fps });
    await page.locator('#scene').screenshot({ path: resolve(output, `frame-${String(frame).padStart(4, '0')}.png`) });
  }
}
