import { mkdir, realpath } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const webRoot = dirname(fileURLToPath(import.meta.url));
export const workspaceRoot = resolve(webRoot, '..');
export const generatedRoot = resolve(workspaceRoot, 'generated');
export const assetRoot = resolve(process.env.CANOPY_ASSETS ?? resolve(workspaceRoot, 'approval-v003'));

export async function checkedAssets(path = assetRoot) {
  const canonical = await realpath(path);
  if (canonical !== resolve(path) || (canonical !== resolve(workspaceRoot, 'approval-v003') &&
      !canonical.startsWith(`${generatedRoot}${sep}`))) {
    throw new Error('CANOPY_ASSETS must be approval-v003 or a nonsymlinked generated run.');
  }
  return canonical;
}

export async function createOutput(label) {
  const name = process.env.CANOPY_RUN ?? `viewer-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name) || !/^[a-z-]+$/.test(label)) {
    throw new Error('CANOPY_RUN and output label must be simple directory names.');
  }
  await mkdir(generatedRoot, { recursive: true });
  if (await realpath(generatedRoot) !== generatedRoot) throw new Error('Refusing symlinked generated output.');
  const run = resolve(generatedRoot, name);
  await mkdir(run, { recursive: true });
  if (await realpath(run) !== run) throw new Error('Refusing symlinked run output.');
  const output = resolve(run, label);
  await mkdir(output); // Never overwrite another verification/capture.
  console.log(`Fresh evidence: ${output}`);
  return output;
}
