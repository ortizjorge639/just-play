"""Copy a verified repo-contained archive into a fresh ignored directory; no ZIP."""
import argparse
from datetime import datetime, timezone
import json
import re
import shutil

from glb import sha256
from paths import ROOT, GENERATED
from verify_archive import verify

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--name", default=f"package-{datetime.now(timezone.utc):%Y%m%dT%H%M%S}")
args = parser.parse_args()
if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", args.name):
    parser.error("--name must be a simple new directory name")
verify()
assert GENERATED.resolve() == GENERATED and not GENERATED.is_symlink()
GENERATED.mkdir(exist_ok=True)
dest = GENERATED / args.name
dest.mkdir()
repo = ROOT.parents[1]
for folder in [ROOT, repo / "docs/canopy-art"]:
    for path in sorted(folder.rglob("*")):
        relative = path.relative_to(folder)
        if any(part in {"generated", "node_modules", ".browsers", ".runtime", ".npm-cache", "__pycache__"}
               for part in relative.parts):
            continue
        assert not path.is_symlink(), path
        if not path.is_file() or path.suffix == ".pyc":
            continue
        target = dest / path.relative_to(repo)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
        assert sha256(target) == sha256(path)
for name in ["README.md", "PRODUCT.md", "docs/demo.md", "docs/treehouse-world-study.md",
             "lib/demo/world.ts", "lib/demo/state.ts"]:
    target = dest / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(repo / name, target)
files = [path for path in dest.rglob("*") if path.is_file()]
print(json.dumps({"package": dest.relative_to(ROOT).as_posix(), "files": len(files),
                  "bytes": sum(path.stat().st_size for path in files)}))
