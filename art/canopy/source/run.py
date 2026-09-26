"""Rebuild/export/check the offline slice, never an open Blender scene."""
import argparse
from datetime import datetime, timezone
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time

from paths import ROOT, DELIVERY, GENERATED


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["rebuild", "export", "verify", "render", "characters"])
    parser.add_argument("--name", help="New run directory name; existing runs are never reused")
    parser.add_argument("--blend", type=Path, default=DELIVERY / "canopy-approval-v003.blend")
    parser.add_argument("--blender", default=os.environ.get("BLENDER_BIN", "blender"))
    parser.add_argument("--render-characters", action="store_true",
                        help="Also render the four character smoke poses (characters command)")
    args = parser.parse_args()
    if args.render_characters and args.command != "characters":
        parser.error("--render-characters is only valid with characters")
    executable = shutil.which(args.blender)
    if executable is None:
        parser.error("Blender not found. Set BLENDER_BIN or pass --blender.")
    blend = args.blend.resolve()
    if args.command not in {"rebuild", "characters"} and not blend.is_file():
        parser.error(f"Blend not found: {blend}")
    name = args.name or f"{args.command}-{datetime.now(timezone.utc):%Y%m%dT%H%M%S}-{time.time_ns() % 1000000:06d}"
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", name):
        parser.error("--name must be a simple directory name")
    if GENERATED.is_symlink() or GENERATED.resolve() != GENERATED:
        parser.error("Refusing a symlinked generated directory")
    GENERATED.mkdir(exist_ok=True)
    output = GENERATED / name
    output.mkdir()  # Exclusive reservation; no --force.
    (output / ".canopy-run").touch(exist_ok=False)
    env = {**os.environ, "CANOPY_OUTPUT": str(output), "PYTHONDONTWRITEBYTECODE": "1"}
    if args.render_characters:
        env["CANOPY_RENDER_CHARACTERS"] = "1"
    source = Path(__file__).resolve().parent

    def blender(script, input_file=None, script_args=()):
        command = [executable, "--background", "--factory-startup", "--disable-autoexec"]
        if input_file:
            command.append(str(input_file))
        command += ["--python-exit-code", "1", "--python-expr",
                    f"import sys; sys.path.insert(0, {str(source)!r})",
                    "--python", str(source / script)]
        if script_args:
            command += ["--", *script_args]
        log = output / (script.replace("/", "-") + ("-gltf" if script_args else "") + ".log")
        print(f"Running {script} -> {log.relative_to(ROOT)}", flush=True)
        with log.open("x") as stream:
            result = subprocess.run(command, env=env, stdout=stream, stderr=subprocess.STDOUT)
        if result.returncode:
            print(log.read_text()[-12000:], file=sys.stderr)
            raise subprocess.CalledProcessError(result.returncode, command)

    def python(script):
        subprocess.run([sys.executable, str(source / script)], env=env, check=True)

    if args.command == "rebuild":
        blender("build_canopy.py")
        blender("finalize_canopy.py", output / "environment-source.blend")
        blend = output / "canopy-approval-v003.blend"
    if args.command in {"rebuild", "export", "verify"}:
        blender("verify_canopy.py", blend)
    if args.command in {"rebuild", "export"}:
        # Each exporter reopens the editable file; batching cannot leak into another export.
        blender("export_canopy.py", blend)
        blender("export_collision.py", blend)
        blender("export_cameras.py", blend)
        python("make_manifest.py")
    if args.command == "verify":
        subprocess.run([sys.executable, str(source / "verify_archive.py")], check=True)
    if args.command == "render":
        blender("render_suite.py", blend)
    if args.command == "characters":
        blender("character-smoke/smoke.py")
        blender("character-smoke/verify.py", output / "character-smoke/canopy-characters.blend")
        blender("character-smoke/verify.py", script_args=["gltf"])
        blender("character-smoke/integration-check.py")
    print(f"Completed {args.command}: {output.relative_to(ROOT)}", flush=True)


if __name__ == "__main__":
    main()
