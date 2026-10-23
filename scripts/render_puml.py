#!/usr/bin/env python3
"""
PlantUML Diagram Converter
Converts .puml files to SVG and PNG formats using either local plantuml or the official plantuml service.
"""

import sys
import os
import zlib
import time
import urllib.request
import urllib.error
from pathlib import Path


def encode64pin(b: int) -> str:
    if b < 10:
        return chr(48 + b)
    b -= 10
    if b < 26:
        return chr(65 + b)
    b -= 26
    if b < 26:
        return chr(97 + b)
    b -= 26
    if b == 0:
        return '-'
    if b == 1:
        return '_'
    return '?'


def append3bytes(b1: int, b2: int, b3: int) -> str:
    c1 = b1 >> 2
    c2 = ((b1 & 0x3) << 4) | (b2 >> 4)
    c3 = ((b2 & 0xF) << 2) | (b3 >> 6)
    c4 = b3 & 0x3F
    return (
        encode64pin(c1 & 0x3F)
        + encode64pin(c2 & 0x3F)
        + encode64pin(c3 & 0x3F)
        + encode64pin(c4 & 0x3F)
    )


def encode_plantuml(text: str) -> str:
    """Encode PlantUML text into URL-safe base64-like representation."""
    utf8_bytes = text.encode('utf-8')
    zlibbed = zlib.compress(utf8_bytes, level=9)
    deflated = zlibbed[2:-4]  # strip zlib header and adler32
    res = []
    i = 0
    length = len(deflated)
    while i < length:
        b1 = deflated[i]
        b2 = deflated[i + 1] if i + 1 < length else 0
        b3 = deflated[i + 2] if i + 2 < length else 0
        res.append(append3bytes(b1, b2, b3))
        i += 3
    return "".join(res)


def render_puml_file(puml_path: Path, output_dir: Path, formats=('svg', 'png')) -> bool:
    """Render a single .puml file to specified image formats."""
    text = puml_path.read_text(encoding='utf-8')
    encoded = encode_plantuml(text)
    stem = puml_path.stem
    output_dir.mkdir(parents=True, exist_ok=True)

    success = True
    for fmt in formats:
        out_file = output_dir / f"{stem}.{fmt}"
        url = f"https://www.plantuml.com/plantuml/{fmt}/{encoded}"
        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PlantUML-Renderer/1.0',
                'Accept': '*/*',
            }
        )

        retries = 3
        done = False
        while retries > 0 and not done:
            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = resp.read()
                    out_file.write_bytes(data)
                    print(f"  [OK] Generated {out_file.name} ({len(data)} bytes)")
                    done = True
            except Exception as e:
                retries -= 1
                if retries > 0:
                    time.sleep(1.5)
                else:
                    print(f"  [ERR] Failed {out_file.name}: {e}")
                    success = False
    return success


def main():
    if len(sys.argv) < 2:
        print("Usage: python render_puml.py <puml_file_or_dir> [output_dir]")
        sys.exit(1)

    target = Path(sys.argv[1])
    out_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("docs/diagrams/images")

    if target.is_file():
        puml_files = [target]
    elif target.is_dir():
        puml_files = sorted(list(target.glob("*.puml")))
    else:
        print(f"Target not found: {target}")
        sys.exit(1)

    print(f"Found {len(puml_files)} .puml file(s) to render into {out_dir}:")
    all_ok = True
    for p in puml_files:
        print(f"Rendering {p.name}...")
        ok = render_puml_file(p, out_dir, formats=('svg', 'png'))
        if not ok:
            all_ok = False

    if all_ok:
        print("All diagrams rendered successfully!")
    else:
        print("Some diagrams encountered errors during rendering.")


if __name__ == "__main__":
    main()
