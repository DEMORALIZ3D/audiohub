#!/usr/bin/env python3
"""
Tizen TV Direct Deployer for AudioHub
Uses Docker Tizen CLI container to sign and push the app directly to a Samsung Smart TV.
"""
import os
import sys
import subprocess
from pathlib import Path
from build_tizen import prepare_stage, TIZEN_DIR, ROOT

TV_IP = os.getenv("TIZEN_TV_IP", "192.168.1.50")
TV_PORT = os.getenv("TIZEN_TV_PORT", "26101")
TV_TARGET_NAME = os.getenv("TIZEN_TV_TARGET", "")

def run_command(cmd, check=True):
    print(f"\n[RUN] {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    res = subprocess.run(cmd, shell=isinstance(cmd, str), capture_output=True, text=True)
    if res.stdout:
        print(res.stdout)
    if res.stderr:
        print(res.stderr, file=sys.stderr)
    if check and res.returncode != 0:
        raise RuntimeError(f"Command failed with code {res.returncode}")
    return res

def main():
    tv_target = f"{TV_IP}:{TV_PORT}"
    print(f"=== AudioHub TV Deployer -> Samsung TV at {tv_target} ===")

    # 1. Prepare stage
    stage_path = prepare_stage()
    out_dir = TIZEN_DIR / "output"
    out_dir.mkdir(parents=True, exist_ok=True)

    # 2. Package and Sign using Docker Tizen CLI
    print("\n2. Packaging and signing WGT package with Tizen CLI...")
    # Map TIZEN_DIR to /workspace
    pkg_cmd = [
        "docker", "run", "--rm",
        "-v", f"{TIZEN_DIR.resolve()}:/workspace",
        "-w", "/workspace",
        "vitalets/tizen-webos-sdk",
        "bash", "-c",
        "tizen package -t wgt -s dev -o /workspace/output -- /workspace/stage"
    ]
    run_command(pkg_cmd)

    # Find the generated .wgt file in output
    wgt_files = list(out_dir.glob("*.wgt"))
    if not wgt_files:
        raise FileNotFoundError(f"No .wgt file found in {out_dir}")
    wgt_file = wgt_files[0]
    print(f"\n[SUCCESS] Signed package created: {wgt_file.name} ({wgt_file.stat().st_size / 1024:.1f} KB)")

    # 3. Connect SDB to TV and install
    print(f"\n3. Connecting SDB to TV ({tv_target}) and installing...")
    target_flag = f"-t {TV_TARGET_NAME}" if TV_TARGET_NAME else ""
    install_cmd = [
        "docker", "run", "--rm", "--net=host",
        "-v", f"{out_dir.resolve()}:/workspace/output",
        "-w", "/workspace/output",
        "vitalets/tizen-webos-sdk",
        "bash", "-c",
        f"sdb connect {tv_target} && tizen install -n {wgt_file.name} {target_flag}".strip()
    ]
    res = run_command(install_cmd, check=False)
    if res.returncode == 0:
        print("\n[SUCCESS] AudioHub successfully installed on Samsung Smart TV!")
        # 4. Attempt launch
        print("\n4. Launching Audiohub on TV...")
        launch_cmd = [
            "docker", "run", "--rm", "--net=host",
            "vitalets/tizen-webos-sdk",
            "bash", "-c",
            f"sdb connect {tv_target} && tizen run -p Audiohub01.Audiohub {target_flag}".strip()
        ]
        run_command(launch_cmd, check=False)
    else:
        print(f"\n[WARNING] Installation exited with code {res.returncode}. Review output above.")

if __name__ == "__main__":
    main()
