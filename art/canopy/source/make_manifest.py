"""Describe newly exported assets without borrowing historical verification."""
import json

from glb import inspect_exports, sha256
from paths import DELIVERY, output_root, write_json

out = output_root()
audit = json.loads((out / "blender-audit.json").read_text())
report = inspect_exports(out / "exports")
write_json(out / "export-report.json", report)
reference = json.loads((DELIVERY / "manifest.json").read_text())
manifest = {key: reference[key] for key in (
    "title", "scope", "awaiting_art_approval", "source_revision", "application_modified",
    "source_units", "coordinates", "materials", "product_state_contract", "integration_caveats")}
manifest.update({
    "version": "portable development rebuild of approval-v003; not new approval",
    "source_blend": audit["saved_path"],
    "source_blend_sha256": audit["saved_sha256"],
    "exports": report["files"],
    "budgets": {
        "environment_contribution_baseline_triangles": 180000,
        "environment_contribution_actual_triangles": report["environment_contribution_triangles"],
        "characters": {name: info["triangles"] for name, info in audit["characters"].items()},
    },
    "characters": audit["characters"],
    "verification": {
        "blender": "Fresh isolated exact-file audit in blender-audit.json.",
        "glb": "Fresh structural/accessor inspection in export-report.json.",
        "browser": "Not established by this manifest; run the viewer verifiers separately.",
        "production_integration": "Not integrated or authorized.",
        "target_device_performance": "Not measured.",
    },
    "files_sha256": {f"exports/{path.name}": sha256(path) for path in sorted((out / "exports").glob("*.glb"))},
})
blend = out / "canopy-approval-v003.blend"
if blend.exists():
    manifest["blend"] = blend.name
    manifest["files_sha256"][blend.name] = sha256(blend)
write_json(out / "manifest.json", manifest)
print(f"MANIFEST: 9 checked exports, {report['environment_contribution_triangles']} environment triangles")
