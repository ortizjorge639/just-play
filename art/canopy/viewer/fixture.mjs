// Synthetic in-memory geometry tests the harness, never substitutes for approved exports.
export const fixtureManifest = {
  viewer: {
    markers: [
      { name: 'LOCATION_Gathering', asset: 'environment', position: [0, 0, 0] },
      { name: 'LOCATION_Grove', asset: 'environment', position: [20, 3, -5] },
      { name: 'LOCATION_Trailhead', asset: 'environment', position: [-6, -1, 22] },
      { name: 'DOOR_Grove', asset: 'environment', position: [17, 3, -3.1] },
      { name: 'ATTACH_plot', asset: 'environment', position: [37, 4, 10] },
    ],
    characterHeights: { pip: { min: .9, max: 1.1 }, sol: { min: .9, max: 1.1 } },
  },
};

export function fixtureGLB(id) {
  const positions = new Float32Array([-.5, 0, -.5, .5, 0, -.5, .5, 1, -.5, -.5, 1, -.5, -.5, 0, .5, .5, 0, .5, .5, 1, .5, -.5, 1, .5]);
  const indices = new Uint16Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5]);
  const times = new Float32Array([0, 1.5, 3]);
  const values = new Float32Array([0, 0, 0, 0, .04, 0, 0, 0, 0]);
  const walkTimes = new Float32Array([0, .5, 1]);
  const chunks = [positions, indices, times, values, walkTimes].map(array => Buffer.from(array.buffer));
  let offset = 0;
  const bufferViews = chunks.map(chunk => { const view = { buffer: 0, byteOffset: offset, byteLength: chunk.length }; offset += chunk.length; return view; });
  const actor = ['pip', 'sol'].includes(id);
  const nodes = [{ name: `${id}_body`, mesh: 0 }];
  if (id === 'environment') nodes.push({ name: 'Fixture_Cover', mesh: 0, translation: [0, 2, 0], extras: { configurable: 'roof' } });
  if (id === 'environment') for (const marker of fixtureManifest.viewer.markers) nodes.push({ name: marker.name, translation: marker.position, extras: { kind: 'orientation-marker' } });
  const document = {
    asset: { version: '2.0', generator: 'synthetic browser-harness test' },
    scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes,
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    materials: [{ name: 'fixture-matte', pbrMetallicRoughness: { baseColorFactor: [.4, .6, .3, 1], metallicFactor: 0, roughnessFactor: .8 } }],
    buffers: [{ byteLength: offset }], bufferViews,
    accessors: [
      { bufferView: 0, componentType: 5126, count: 8, type: 'VEC3', min: [-.5, 0, -.5], max: [.5, 1, .5] },
      { bufferView: 1, componentType: 5123, count: 36, type: 'SCALAR' },
      { bufferView: 2, componentType: 5126, count: 3, type: 'SCALAR', min: [0], max: [3] },
      { bufferView: 3, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 4, componentType: 5126, count: 3, type: 'SCALAR', min: [0], max: [1] },
    ],
    ...(actor ? { animations: ['Idle', 'Walk', 'Greeting'].map(name => ({ name, channels: [{ sampler: 0, target: { node: 0, path: 'translation' } }], samplers: [{ input: name === 'Walk' ? 4 : 2, output: 3, interpolation: 'LINEAR' }] })) } : {}),
  };
  let json = Buffer.from(JSON.stringify(document));
  json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
  const binary = Buffer.concat(chunks);
  const header = Buffer.alloc(12), jsonHeader = Buffer.alloc(8), binaryHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + json.length + 8 + binary.length, 8);
  jsonHeader.writeUInt32LE(json.length); jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  binaryHeader.writeUInt32LE(binary.length); binaryHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, json, binaryHeader, binary]);
}
