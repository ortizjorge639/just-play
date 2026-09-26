"""Paths for isolated, non-overwriting Canopy development runs."""
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DELIVERY = ROOT / "approval-v003"
GENERATED = ROOT / "generated"


def output_root():
    value = os.environ.get("CANOPY_OUTPUT")
    if not value:
        raise RuntimeError("Use source/run.py; CANOPY_OUTPUT must name a fresh owned run.")
    path = Path(value).resolve()
    if not path.is_relative_to(GENERATED) or path == GENERATED:
        raise ValueError("Output must be a child of art/canopy/generated, without symlinks.")
    if not (path / ".canopy-run").is_file():
        raise ValueError("Output was not reserved by source/run.py.")
    return path


def fresh_path(path):
    path = Path(path).resolve()
    if not path.is_relative_to(output_root()) or path.exists():
        raise FileExistsError(f"Refusing output outside this run or overwriting: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def write_json(path, value):
    with fresh_path(path).open("x") as stream:
        json.dump(value, stream, indent=2)
        stream.write("\n")


def display_path(path):
    path = Path(path).resolve()
    return path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else path.name
