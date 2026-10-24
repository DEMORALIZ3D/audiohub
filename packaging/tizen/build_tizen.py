#!/usr/bin/env python3
"""
Tizen WGT Package Builder for Audiohub TV
Creates a turnkey .wgt package from backend/frontend_dist
"""
import os
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DIST_DIR = ROOT / "backend" / "frontend_dist"
OUTPUT_DIR = ROOT / "backend" / "data" / "downloads"
TIZEN_DIR = ROOT / "packaging" / "tizen"

STAGE_DIR = TIZEN_DIR / "stage"

def prepare_stage():
    if STAGE_DIR.exists():
        shutil.rmtree(STAGE_DIR)
    STAGE_DIR.mkdir(parents=True, exist_ok=True)
    print("1. Copying frontend_dist assets to stage...")
    shutil.copytree(DIST_DIR, STAGE_DIR, dirs_exist_ok=True)

    print("2. Injecting config.xml and Tizen TV remote key registration...")
    shutil.copy2(TIZEN_DIR / "config.xml", STAGE_DIR / "config.xml")
    shutil.copy2(TIZEN_DIR / "tizenKeys.js", STAGE_DIR / "tizenKeys.js")

    index_file = STAGE_DIR / "index.html"
    if index_file.exists():
        content = index_file.read_text(encoding="utf-8")
        injections = """
    <script>
      // TV Debug & Error Catcher banner
      window.onerror = function(msg, url, line, col, err) {
        var banner = document.getElementById('audiohub-tv-error');
        if (!banner) {
          banner = document.createElement('div');
          banner.id = 'audiohub-tv-error';
          banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:rgba(220,38,38,0.92);color:white;padding:16px;z-index:999999;font-family:monospace;font-size:16px;white-space:pre-wrap;';
          document.body ? document.body.appendChild(banner) : document.documentElement.appendChild(banner);
        }
        banner.textContent = 'TV JS Error: ' + msg + ' (' + (url||'').split('/').pop() + ':' + line + ')';
      };
    </script>
    <script src="tizenKeys.js"></script>"""
        if "tizenKeys.js" not in content:
            content = content.replace("</head>", f"{injections}\n</head>")
            index_file.write_text(content, encoding="utf-8")

    icon_src = TIZEN_DIR / "icon.png"
    if icon_src.exists():
        shutil.copy2(icon_src, STAGE_DIR / "icon.png")
    print(f"Stage ready at {STAGE_DIR}")
    return STAGE_DIR

def build_wgt():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    stage = prepare_stage()
    target_wgt = OUTPUT_DIR / "audiohub.wgt"
    print(f"3. Compressing W3C widget package -> {target_wgt}")
    with zipfile.ZipFile(target_wgt, "w", zipfile.ZIP_DEFLATED) as z:
        for file in stage.rglob("*"):
            if file.is_file():
                rel = file.relative_to(stage)
                z.write(file, arcname=str(rel))

    shutil.copy2(target_wgt, OUTPUT_DIR / "azify.wgt")
    size_mb = target_wgt.stat().st_size / (1024 * 1024)
    print(f"[SUCCESS] Samsung Tizen package built: {target_wgt} ({size_mb:.2f} MB)")
    print(f"[SUCCESS] Alias created: {OUTPUT_DIR / 'azify.wgt'}")

if __name__ == "__main__":
    build_wgt()
