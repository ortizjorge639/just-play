import assert from 'node:assert/strict';

const finite = values => values.every(Number.isFinite);

export function markerExpectations(manifest) {
  const source = manifest.viewer?.markers ?? manifest.validation?.markers ?? manifest.markers ?? manifest.coordinates?.expected_markers_gltf;
  if (Array.isArray(source)) return source;
  if (source && typeof source === 'object') return Object.entries(source).map(([name, value]) => ({ name, ...(Array.isArray(value) ? { position: value } : value) }));
  return [];
}

export function assertSceneStats(stats, manifest) {
  assert.equal(stats.invalidGeometry.length, 0, stats.invalidGeometry.join('\n'));
  assert.equal(stats.invalidMaterials.length, 0, stats.invalidMaterials.join('\n'));
  assert.ok(stats.meshes > 0 && stats.triangles > 0 && stats.materials > 0, 'Scene must contain renderable geometry/materials');
  assert.ok(stats.triangles < (manifest.viewer?.limits?.triangles ?? 5_000_000), 'Triangle budget exceeded');
  assert.ok(stats.environmentTriangles <= (manifest.viewer?.limits?.environmentTriangles ?? manifest.budgets?.environment_contribution_baseline_triangles ?? 180_000), 'Environment triangle budget exceeded (world assets only; excludes characters and unloaded colliders)');
  assert.ok(stats.materials < (manifest.viewer?.limits?.materials ?? 2_000), 'Material budget exceeded');
  assert.ok(stats.draw.calls > 0 && stats.draw.triangles > 0, 'Overview must submit visible geometry');
  for (const id of ['environment', 'pip', 'sol', 'ember-small', 'hearth-deck', 'rain-postcard']) {
    const asset = stats.assets[id];
    assert.ok(asset?.meshes > 0 && asset.triangles > 0, `${id}: no geometry`);
    assert.ok(finite([...asset.bounds.min, ...asset.bounds.max, ...asset.bounds.size]), `${id}: invalid bounds`);
    assert.ok(asset.bounds.size.every(value => value > 0 && value < 1000), `${id}: bounds must be nondegenerate and <1000 m per axis`);
    assert.ok([...asset.bounds.min, ...asset.bounds.max].every(value => Math.abs(value) < 10_000), `${id}: implausible world placement`);
    if (['pip', 'sol'].includes(id)) {
      const character = manifest.characters?.[id === 'pip' ? 'Pip' : 'Sol'];
      const expectedHeight = character?.height_m ?? (id === 'pip' ? 1.6608581543 : 1.6679999828);
      const range = manifest.viewer?.characterHeights?.[id] ?? { min: expectedHeight - .02, max: expectedHeight + .02 };
      assert.ok(asset.height >= range.min && asset.height <= range.max, `${id}: +Y height ${asset.height} outside ${range.min}–${range.max} m`);
      assert.ok(asset.clips.length >= 3, `${id}: expected Idle, Walk, Greeting clips`);
      for (const semantic of ['Idle', 'Walk', 'Greeting']) {
        const alias = manifest.viewer?.animations?.[id]?.[semantic] ?? character?.clips?.[semantic]?.name ?? semantic;
        const clip = asset.clips.find(clip => clip.name.toLowerCase().includes(alias.toLowerCase()));
        assert.ok(clip, `${id}: missing ${semantic} variant`);
        const expectedDuration = manifest.viewer?.clipDurations?.[id]?.[clip.name] ?? character?.clips?.[semantic]?.period_seconds ?? (semantic === 'Walk' ? 1 : 3);
        assert.ok(Math.abs(clip.duration - expectedDuration) < .001, `${id}/${clip.name}: duration ${clip.duration}, expected ${expectedDuration}s; export animation times starting at zero`);
      }
      for (const clip of asset.clips) {
        assert.ok(clip.valid && clip.tracks > 0, `${id}/${clip.name}: invalid clip`);
        assert.ok(Math.abs(clip.startTime) < 1e-6, `${id}/${clip.name}: first key at ${clip.startTime}s, expected zero`);
      }
    }
  }
  const expected = markerExpectations(manifest);
  assert.ok(expected.length >= 3, 'Manifest must declare at least three named, non-collinear orientation markers; see web/README.md');
  assert.ok(expected.every(marker => marker.name && Array.isArray(marker.position) && marker.position.length === 3 && finite(marker.position)), 'Orientation marker entries require name and finite position[3]');
  const a = expected[0].position;
  const vectors = expected.slice(1).map(marker => marker.position.map((v, i) => v - a[i]));
  const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  assert.ok(vectors.some((u, i) => vectors.slice(i + 1).some(v => Math.hypot(...cross(u, v)) > .01)), 'Orientation markers must not be collinear');
  assert.ok(expected.some(marker => Math.abs(marker.position[1]) > .5), 'At least one marker must check nonzero +Y elevation');
  const checks = expected.map(expectedMarker => {
    const matches = stats.markers.filter(marker => (!expectedMarker.asset || marker.asset === expectedMarker.asset)
      && (marker.name === expectedMarker.name || marker.extras.marker === expectedMarker.name));
    assert.equal(matches.length, 1, `Expected exactly one marker "${expectedMarker.name}", found ${matches.length}`);
    const actual = matches[0];
    assert.ok(Object.keys(actual.extras).length > 0, `${expectedMarker.name}: marker must retain glTF extras`);
    const distance = Math.hypot(...actual.position.map((v, i) => v - expectedMarker.position[i]));
    assert.ok(distance <= (expectedMarker.tolerance ?? .05), `${expectedMarker.name}: expected ${expectedMarker.position}, found ${actual.position} (distance ${distance})`);
    return { name: expectedMarker.name, expected: expectedMarker.position, actual: actual.position, distance };
  });
  return checks;
}

export async function inspectAnimations(page, manifest) {
  return page.evaluate(config => {
    const api = window.canopyTest;
    api.setView('cast');
    const summaries = [];
    const delta = (a, b) => {
      if (a.length !== b.length) throw new Error('Animation changed node count');
      let maximum = 0;
      for (let n = 0; n < a.length; n++) {
        const av = [...a[n].matrix, ...a[n].morphs], bv = [...b[n].matrix, ...b[n].morphs];
        if (av.length !== bv.length || !av.every(Number.isFinite) || !bv.every(Number.isFinite)) throw new Error('Animation has invalid matrices/morphs');
        for (let i = 0; i < av.length; i++) maximum = Math.max(maximum, Math.abs(av[i] - bv[i]));
      }
      return maximum;
    };
    for (const id of ['pip', 'sol']) {
      for (const clip of api.stats().assets[id].clips) {
        const frames = Math.max(2, Math.ceil(clip.duration * 24));
        if (frames > 14_400) throw new Error(`${id}/${clip.name}: clip exceeds 10-minute inspection limit`);
        const start = api.sampleClip(id, clip.name, 0);
        let maximumMotion = 0, maximumMotionTime = 0, previous = start, maximumStep = 0;
        for (let frame = 1; frame <= frames; frame++) {
          const sample = api.sampleClip(id, clip.name, frame / frames * clip.duration);
          const motion = delta(start, sample);
          if (motion > maximumMotion) { maximumMotion = motion; maximumMotionTime = frame / frames * clip.duration; }
          maximumStep = Math.max(maximumStep, delta(previous, sample));
          previous = sample;
        }
        const endpointDelta = delta(start, previous);
        const requiredLoop = config.loopingClips?.[id]?.includes(clip.name) ?? /idle|walk|greeting/i.test(clip.name);
        const tolerance = config.animationTolerance ?? .002;
        if (maximumMotion <= 1e-7) throw new Error(`${id}/${clip.name}: no animated matrix/morph change`);
        if (requiredLoop && endpointDelta > tolerance) throw new Error(`${id}/${clip.name}: loop endpoint delta ${endpointDelta} > ${tolerance}`);
        summaries.push({ asset: id, clip: clip.name, duration: clip.duration, samples: frames + 1, maximumMotion, maximumMotionTime, maximumStep, endpointDelta, requiredLoop, tolerance });
      }
    }
    api.playAction('Idle');
    api.setView('overview');
    api.setTime(0);
    return summaries;
  }, manifest.viewer ?? {});
}

export async function assertAmbientLoop(page) {
  const result = await page.evaluate(() => {
    const api = window.canopyTest;
    api.playAction('Idle');
    api.setView('ambient');
    const sample = seconds => {
      api.setTime(seconds);
      return {
        camera: api.stats().camera,
        actors: ['pip', 'sol'].flatMap(id => api.snapshot(id).flatMap(node => [...node.matrix, ...node.morphs])),
      };
    };
    const start = sample(0), end = sample(6);
    const cameraDelta = Math.max(...[...start.camera.position, ...start.camera.target].map((value, i) => Math.abs(value - [...end.camera.position, ...end.camera.target][i])));
    let actorDelta = 0;
    for (let i = 0; i < start.actors.length; i++) actorDelta = Math.max(actorDelta, Math.abs(start.actors[i] - end.actors[i]));
    api.setTime(0);
    return { duration: 6, cameraDelta, actorDelta };
  });
  assert.ok(result.cameraDelta < 1e-8 && result.actorDelta < .002, `Ambient loop discontinuity: ${JSON.stringify(result)}`);
  return result;
}
