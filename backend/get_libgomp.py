"""
Downloads the Linux (x86_64) OpenMP runtime, libgomp.so.1, from Debian and
saves it as native_libs/libgomp.so.1 next to this script.

Why: LightGBM needs libgomp.so.1, and Vercel's Python runtime does not ship it.
app.py loads this bundled copy before importing lightgbm.

Run it once from the backend folder (needs internet, works on Windows too):

    python get_libgomp.py
"""

import io
import re
import struct
import sys
import tarfile
import urllib.request
from pathlib import Path

POOL = "https://deb.debian.org/debian/pool/main/g/gcc-12/"
OUT_DIR = Path(__file__).parent / "native_libs"
OUT_FILE = OUT_DIR / "libgomp.so.1"


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=120) as r:
        return r.read()


def find_deb_name() -> str:
    listing = fetch(POOL).decode("utf-8", "replace")
    names = sorted(set(re.findall(r"libgomp1_[0-9][^\"<>\s]*_amd64\.deb", listing)))
    if not names:
        raise SystemExit(f"Could not find a libgomp1 package at {POOL}")
    return names[-1]


def read_ar(blob: bytes):
    """Yield (name, bytes) for each member of an 'ar' archive (a .deb is one)."""
    if blob[:8] != b"!<arch>\n":
        raise ValueError("Not a .deb file")
    pos = 8
    while pos + 60 <= len(blob):
        header = blob[pos : pos + 60]
        name = header[:16].decode("ascii", "replace").strip().rstrip("/")
        size = int(header[48:58].decode("ascii").strip())
        pos += 60
        yield name, blob[pos : pos + size]
        pos += size + (size % 2)


def extract_libgomp(deb_bytes: bytes) -> bytes:
    for name, data in read_ar(deb_bytes):
        if not name.startswith("data.tar"):
            continue
        if name.endswith(".zst"):
            raise SystemExit("This package uses zstd compression, which Python cannot read.")
        with tarfile.open(fileobj=io.BytesIO(data), mode="r:*") as tar:
            for member in tar.getmembers():
                # libgomp.so.1 itself is only a symlink; the real file is libgomp.so.1.0.0
                if member.isfile() and member.name.endswith("libgomp.so.1.0.0"):
                    return tar.extractfile(member).read()
    raise SystemExit("libgomp.so.1.0.0 was not found inside the package")


def check_elf_x86_64(blob: bytes) -> None:
    if blob[:4] != b"\x7fELF":
        raise SystemExit("Extracted file is not a Linux library")
    machine = struct.unpack_from("<H", blob, 18)[0]
    if machine != 0x3E:
        raise SystemExit(f"Wrong CPU type in extracted file (machine={machine:#x}), expected x86_64")


def main() -> None:
    deb_name = find_deb_name()
    print("Downloading", deb_name)
    lib = extract_libgomp(fetch(POOL + deb_name))
    check_elf_x86_64(lib)
    OUT_DIR.mkdir(exist_ok=True)
    OUT_FILE.write_bytes(lib)
    print(f"Saved {OUT_FILE} ({len(lib):,} bytes)")


if __name__ == "__main__":
    sys.exit(main())
