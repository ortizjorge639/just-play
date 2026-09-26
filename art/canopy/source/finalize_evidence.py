"""Read-only checks of final video media; no raw frame sequences are required."""
import argparse
import json
from pathlib import Path
import subprocess

from paths import DELIVERY

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--assets", type=Path, default=DELIVERY)
args = parser.parse_args()
reports = {}
for name, frames, seconds in [
    ("ambient-phased.mp4", 144, 6), ("ambient-night-phased.mp4", 144, 6),
    ("character-actions.mp4", 192, 8),
]:
    path = args.assets / "browser" / name
    data = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0",
        "-show_entries", "stream=codec_name,width,height,nb_read_frames,duration,r_frame_rate",
        "-of", "json", str(path),
    ]))
    stream = data["streams"][0]
    assert int(stream["nb_read_frames"]) == frames and float(stream["duration"]) == seconds
    assert (stream["width"], stream["height"], stream["r_frame_rate"]) == (960, 640, "24/1")
    reports[name] = stream
print(json.dumps({"status": "passed", "media": reports, "runtime_fps_measured": False}, indent=2))
