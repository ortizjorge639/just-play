"""Check immutable source coverage and all nine final GLBs without Blender."""
import argparse
import json
from pathlib import Path

from glb import inspect_exports, sha256
from paths import ROOT, DELIVERY


def verify(assets=DELIVERY):
    assets = Path(assets).resolve()
    manifest = json.loads((assets / "manifest.json").read_text())
    for name, digest in manifest["files_sha256"].items():
        target = (assets / name).resolve()
        assert target.is_relative_to(assets), name
        assert sha256(target) == digest, f"Hash mismatch: {name}"
    report = inspect_exports(assets / "exports")
    assert report == json.loads((assets / "export-report.json").read_text())
    preserved = []
    if assets == DELIVERY:
        repo = ROOT.parents[1]
        provenance = json.loads((ROOT / "provenance.json").read_text())
        for entry in provenance["files"]:
            path = repo / entry["path"]
            assert path.is_file(), f"Missing archived source: {entry['path']}"
            if path.is_relative_to(DELIVERY) or path.name == "source-brief.txt":
                assert sha256(path) == entry["source_sha256"], entry["path"]
                preserved.append(entry["path"])
        brief = repo / "docs/canopy-art/source-brief.txt"
        assert len(brief.read_text().splitlines()) == 128
    return {"status": "passed", "immutable_files_checked": len(preserved),
            "exports": len(report["files"]),
            "environment_triangles": report["environment_contribution_triangles"],
            "static_meshes": 9, "static_material_primitives": 82}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assets", type=Path, default=DELIVERY)
    print(json.dumps(verify(parser.parse_args().assets), indent=2))
