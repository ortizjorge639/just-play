import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from paths import GENERATED, DELIVERY, output_root, fresh_path, write_json
from verify_archive import verify


class ArchiveTests(unittest.TestCase):
    def test_immutable_delivery_and_exports(self):
        report = verify()
        self.assertEqual(report["immutable_files_checked"], 64)
        self.assertEqual(report["exports"], 9)

    def test_unowned_and_delivered_output_refused(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "source/run.py"):
                output_root()
        with patch.dict(os.environ, {"CANOPY_OUTPUT": str(DELIVERY)}):
            with self.assertRaises(ValueError):
                output_root()

    def test_exclusive_writes_and_symlink_escape(self):
        GENERATED.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=GENERATED, prefix="path-test-") as directory:
            root = Path(directory)
            with patch.dict(os.environ, {"CANOPY_OUTPUT": directory}):
                with self.assertRaises(ValueError):
                    output_root()
                (root / ".canopy-run").touch()
                write_json(root / "report.json", {"status": "passed"})
                with self.assertRaises(FileExistsError):
                    write_json(root / "report.json", {"status": "changed"})
                with self.assertRaises(FileExistsError):
                    fresh_path(root / "../outside.json")
                (root / "escape").symlink_to(DELIVERY, target_is_directory=True)
                with self.assertRaises(FileExistsError):
                    fresh_path(root / "escape/new.json")

    def test_direct_builder_cannot_mutate_without_owned_output(self):
        result = subprocess.run(
            [sys.executable, str(Path(__file__).parent / "make_manifest.py")],
            env={key: value for key, value in os.environ.items() if key != "CANOPY_OUTPUT"},
            capture_output=True, text=True,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Use source/run.py", result.stderr)


if __name__ == "__main__":
    unittest.main()
