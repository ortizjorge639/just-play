"""Small dependency-free checks for this slice's uncompressed glTF 2 exports."""
import hashlib
import json
import math
from pathlib import Path
import struct

EXPECTED_TRIANGLES = {
    "environment.glb": 120860, "ember-small.glb": 344, "hearth-deck.glb": 29190,
    "hearth-enrichment.glb": 428, "rain-postcard.glb": 200, "pip.glb": 7158,
    "sol.glb": 6470, "collision-proxies.glb": 726, "cameras.glb": 0,
}
STATIC = {"environment.glb", "ember-small.glb", "hearth-deck.glb",
          "hearth-enrichment.glb", "rain-postcard.glb"}


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def inspect(path):
    raw = Path(path).read_bytes()
    magic, version, length = struct.unpack_from("<4sII", raw)
    assert magic == b"glTF" and version == 2 and length == len(raw), path
    size, kind = struct.unpack_from("<II", raw, 12)
    assert kind == 0x4E4F534A
    data = json.loads(raw[20:20 + size])
    bin_size, bin_kind = struct.unpack_from("<II", raw, 20 + size)
    assert bin_kind == 0x004E4942 and 28 + size + bin_size == length
    binary = raw[28 + size:]
    assert not data.get("images"), "No image dependencies belong to this slice"
    assert len(data["buffers"]) == 1 and "uri" not in data["buffers"][0]

    def floats(index):
        accessor = data["accessors"][index]
        view = data["bufferViews"][accessor["bufferView"]]
        width = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}[accessor["type"]]
        assert accessor["componentType"] == 5126 and not accessor.get("sparse")
        start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        stride = view.get("byteStride", width * 4)
        values = [struct.unpack_from("<" + "f" * width, binary, start + i * stride)
                  for i in range(accessor["count"])]
        assert all(math.isfinite(value) for row in values for value in row)
        return values

    triangles = primitives = 0
    for mesh in data.get("meshes", []):
        for primitive in mesh["primitives"]:
            assert primitive.get("mode", 4) == 4
            floats(primitive["attributes"]["POSITION"])
            count = data["accessors"][primitive["indices"]]["count"]
            assert count % 3 == 0
            triangles += count // 3
            primitives += 1
    for material in data.get("materials", []):
        pbr = material.get("pbrMetallicRoughness", {})
        for key in ("roughnessFactor", "metallicFactor"):
            assert 0 <= pbr.get(key, 1) <= 1
    for animation in data.get("animations", []):
        duration = 6 if Path(path).name == "cameras.glb" else 1 if animation["name"].endswith("Walk") else 3
        for sampler in animation["samplers"]:
            times = [row[0] for row in floats(sampler["input"])]
            values = floats(sampler["output"])
            assert abs(times[0]) < 1e-6 and abs(times[-1] - duration) < 1e-6
            assert all(b > a for a, b in zip(times, times[1:]))
            assert max(abs(a - b) for a, b in zip(values[0], values[-1])) < 1e-5
    if Path(path).stem in {"pip", "sol"}:
        character = Path(path).stem.capitalize()
        assert {a["name"] for a in data["animations"]} == {
            f"{character}_{clip}" for clip in ("Idle", "Walk", "Greeting")}
        assert len(data["skins"]) == 1 and len(data["skins"][0]["joints"]) == 16
    if Path(path).name == "cameras.glb":
        assert len(data["cameras"]) == 6
        assert [a["name"] for a in data["animations"]] == ["Ambient loopAction"]
    return {
        "bytes": len(raw), "triangles": triangles, "meshes": len(data.get("meshes", [])),
        "material_primitives": primitives, "materials": len(data.get("materials", [])),
        "nodes": len(data.get("nodes", [])), "skins": len(data.get("skins", [])),
        "animations": [a["name"] for a in data.get("animations", [])],
        **({"cameras": len(data["cameras"])} if "cameras" in data else {}),
    }


def inspect_exports(directory):
    files = {path.name: inspect(path) for path in sorted(Path(directory).glob("*.glb"))}
    assert set(files) == set(EXPECTED_TRIANGLES), files.keys()
    for name, triangles in EXPECTED_TRIANGLES.items():
        assert files[name]["triangles"] == triangles, (name, files[name])
    assert sum(files[name]["meshes"] for name in STATIC) == 9
    assert sum(files[name]["material_primitives"] for name in STATIC) == 82
    environment = sum(files[name]["triangles"] for name in STATIC)
    assert environment == 151022 and environment <= 180000
    return {"files": files, "environment_contribution_triangles": environment, "baseline_budget": 180000}
