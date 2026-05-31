#!/usr/bin/env python3
"""
update_logo.py — Embed mielelogic_logo.png as base64 in all frontend JS files.

Usage:
    python update_logo.py

Run this whenever the logo PNG changes. It updates the _ML_LOGO constant
in panel.js and mielelogic-booking-card.js automatically.
"""

import base64
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
LOGO_PATH  = SCRIPT_DIR / "custom_components" / "mielelogic" / "frontend" / "mielelogic_logo.png"

JS_FILES = [
    SCRIPT_DIR / "custom_components" / "mielelogic" / "frontend" / "panel.js",
    SCRIPT_DIR / "custom_components" / "mielelogic" / "frontend" / "mielelogic-booking-card.js",
]

PATTERN = re.compile(r'(const _ML_LOGO\s*=\s*)"data:image/png;base64,[^"]*"')


def main():
    if not LOGO_PATH.exists():
        print(f"ERROR: Logo not found at {LOGO_PATH}")
        sys.exit(1)

    b64 = base64.b64encode(LOGO_PATH.read_bytes()).decode()
    data_uri = f"data:image/png;base64,{b64}"
    print(f"Logo: {LOGO_PATH.name} ({len(b64):,} chars base64)")

    updated = 0
    for js_path in JS_FILES:
        if not js_path.exists():
            print(f"  SKIP  {js_path.name} (not found)")
            continue

        original = js_path.read_text(encoding="utf-8")

        if not PATTERN.search(original):
            print(f"  SKIP  {js_path.name} (no _ML_LOGO constant found)")
            continue

        new_content = PATTERN.sub(rf'\1"{data_uri}"', original)

        if new_content == original:
            print(f"  OK    {js_path.name} (already up to date)")
        else:
            js_path.write_text(new_content, encoding="utf-8")
            print(f"  UPDATED {js_path.name}")
            updated += 1

    print(f"\nDone — {updated} file(s) updated.")


if __name__ == "__main__":
    main()
