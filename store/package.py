"""Builds the files to upload to the Chrome Web Store into store/upload/.

Run from the repo root:  python store/package.py

  whatsapp-chat-export-<version>.zip  the extension itself (manifest, icons, src)
  store-images.zip                     every image in store/images/
"""
import json
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "store" / "upload"
OUT.mkdir(exist_ok=True)

manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
version = manifest["version"]


def write_zip(target, files):
    target.unlink(missing_ok=True)
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for path, name in files:
            archive.write(path, name)
    print(f"{target.relative_to(ROOT).as_posix()}  {len(files)} files  {target.stat().st_size / 1024:.0f} KB")


extension_files = [ROOT / "manifest.json"]
extension_files += sorted((ROOT / "icons").glob("*.png"))
extension_files += sorted(p for p in (ROOT / "src").rglob("*") if p.is_file())
write_zip(
    OUT / f"whatsapp-chat-export-{version}.zip",
    [(p, p.relative_to(ROOT).as_posix()) for p in extension_files],
)

images = sorted((ROOT / "store" / "images").glob("*.png"))
write_zip(OUT / "store-images.zip", [(p, p.name) for p in images])
