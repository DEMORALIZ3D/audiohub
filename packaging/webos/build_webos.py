#!/usr/bin/env python3
"""
LG webOS IPK Package Builder for Audiohub TV
Packages backend/frontend_dist into a standard .ipk file (ar archive with control.tar.gz & data.tar.gz)
"""
import io
import os
import shutil
import tarfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DIST_DIR = ROOT / "backend" / "frontend_dist"
OUTPUT_DIR = ROOT / "backend" / "data" / "downloads"
WEBOS_DIR = ROOT / "packaging" / "webos"

APP_ID = "com.audiohub.music.tv"
VERSION = "1.0.0"

def create_ar_header(filename: str, size: int, timestamp: int = None, mode: int = 0o100644) -> bytes:
    if timestamp is None:
        timestamp = int(time.time())
    header = io.BytesIO()
    name_field = f"{filename:<16}"[:16].encode("ascii")
    time_field = f"{timestamp:<12}"[:12].encode("ascii")
    owner_field = f"0     "[:6].encode("ascii")
    group_field = f"0     "[:6].encode("ascii")
    mode_field = f"{mode:o}".ljust(8)[:8].encode("ascii")
    size_field = f"{size:<10}"[:10].encode("ascii")
    magic = b"`\n"
    header.write(name_field)
    header.write(time_field)
    header.write(owner_field)
    header.write(group_field)
    header.write(mode_field)
    header.write(size_field)
    header.write(magic)
    return header.getvalue()

import tempfile

def build_ipk():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as stage_str:
        temp_stage = Path(stage_str)
        print("1. Preparing webOS application assets...")
        shutil.copytree(DIST_DIR, temp_stage, dirs_exist_ok=True)
        shutil.copy2(WEBOS_DIR / "appinfo.json", temp_stage / "appinfo.json")

        icon_src = ROOT / "frontend" / "public" / "icon.svg"
        shutil.copy2(icon_src, temp_stage / "icon.png")
        shutil.copy2(icon_src, temp_stage / "largeIcon.png")

        # 1. debian-binary
        debian_binary_bytes = b"2.0\n"

        # 2. control.tar.gz
        print("2. Generating control.tar.gz...")
        control_content = (
            f"Package: {APP_ID}\n"
            f"Version: {VERSION}\n"
            f"Section: misc\n"
            f"Priority: optional\n"
            f"Architecture: all\n"
            f"Maintainer: Audiohub <maintainer@audiohub.local>\n"
            f"Description: Audiohub - homelab entertainment for LG webOS TV\n"
        ).encode("utf-8")

        control_tar_io = io.BytesIO()
        with tarfile.open(fileobj=control_tar_io, mode="w:gz") as tar:
            ti = tarfile.TarInfo(name="./control")
            ti.size = len(control_content)
            ti.mode = 0o644
            ti.mtime = int(time.time())
            tar.addfile(ti, io.BytesIO(control_content))
        control_tar_bytes = control_tar_io.getvalue()

        # 3. data.tar.gz
        print("3. Generating data.tar.gz (packaging application files)...")
        data_tar_io = io.BytesIO()
        target_prefix = f"./usr/palm/applications/{APP_ID}"
        with tarfile.open(fileobj=data_tar_io, mode="w:gz") as tar:
            for file in temp_stage.rglob("*"):
                if file.is_file():
                    rel = file.relative_to(temp_stage)
                    arcname = f"{target_prefix}/{rel.as_posix()}"
                    tar.add(file, arcname=arcname)
        data_tar_bytes = data_tar_io.getvalue()

        # 4. Assemble .ipk (ar archive)
        target_ipk = OUTPUT_DIR / f"audiohub_{VERSION}_all.ipk"
        print(f"4. Assembling ar container -> {target_ipk}")
        with open(target_ipk, "wb") as f:
            f.write(b"!<arch>\n")

            # Member 1: debian-binary
            f.write(create_ar_header("debian-binary", len(debian_binary_bytes)))
            f.write(debian_binary_bytes)
            if len(debian_binary_bytes) % 2 != 0:
                f.write(b"\n")

            # Member 2: control.tar.gz
            f.write(create_ar_header("control.tar.gz", len(control_tar_bytes)))
            f.write(control_tar_bytes)
            if len(control_tar_bytes) % 2 != 0:
                f.write(b"\n")

            # Member 3: data.tar.gz
            f.write(create_ar_header("data.tar.gz", len(data_tar_bytes)))
            f.write(data_tar_bytes)
            if len(data_tar_bytes) % 2 != 0:
                f.write(b"\n")

        # Also make generic aliases for clean downloads
        shutil.copy2(target_ipk, OUTPUT_DIR / "audiohub.ipk")
        shutil.copy2(target_ipk, OUTPUT_DIR / "azify.ipk")

        size_mb = target_ipk.stat().st_size / (1024 * 1024)
        print(f"[SUCCESS] LG webOS TV package built: {target_ipk} ({size_mb:.2f} MB)")
        print(f"[SUCCESS] Alias created: {OUTPUT_DIR / 'audiohub.ipk'}")

    print("1. Preparing webOS application assets...")
    shutil.copytree(DIST_DIR, temp_stage, dirs_exist_ok=True)
    shutil.copy2(WEBOS_DIR / "appinfo.json", temp_stage / "appinfo.json")

    icon_src = ROOT / "frontend" / "public" / "icon.svg"
    shutil.copy2(icon_src, temp_stage / "icon.png")
    shutil.copy2(icon_src, temp_stage / "largeIcon.png")

    # 1. debian-binary
    debian_binary_bytes = b"2.0\n"

    # 2. control.tar.gz
    print("2. Generating control.tar.gz...")
    control_content = (
        f"Package: {APP_ID}\n"
        f"Version: {VERSION}\n"
        f"Section: misc\n"
        f"Priority: optional\n"
        f"Architecture: all\n"
        f"Maintainer: Audiohub <maintainer@audiohub.local>\n"
        f"Description: Audiohub - homelab entertainment for LG webOS TV\n"
    ).encode("utf-8")

    control_tar_io = io.BytesIO()
    with tarfile.open(fileobj=control_tar_io, mode="w:gz") as tar:
        ti = tarfile.TarInfo(name="./control")
        ti.size = len(control_content)
        ti.mode = 0o644
        ti.mtime = int(time.time())
        tar.addfile(ti, io.BytesIO(control_content))
    control_tar_bytes = control_tar_io.getvalue()

    # 3. data.tar.gz
    print("3. Generating data.tar.gz (packaging application files)...")
    data_tar_io = io.BytesIO()
    target_prefix = f"./usr/palm/applications/{APP_ID}"
    with tarfile.open(fileobj=data_tar_io, mode="w:gz") as tar:
        for file in temp_stage.rglob("*"):
            if file.is_file():
                rel = file.relative_to(temp_stage)
                arcname = f"{target_prefix}/{rel.as_posix()}"
                tar.add(file, arcname=arcname)
    data_tar_bytes = data_tar_io.getvalue()

    # 4. Assemble .ipk (ar archive)
    target_ipk = OUTPUT_DIR / f"audiohub_{VERSION}_all.ipk"
    print(f"4. Assembling ar container -> {target_ipk}")
    with open(target_ipk, "wb") as f:
        f.write(b"!<arch>\n")

        # Member 1: debian-binary
        f.write(create_ar_header("debian-binary", len(debian_binary_bytes)))
        f.write(debian_binary_bytes)
        if len(debian_binary_bytes) % 2 != 0:
            f.write(b"\n")

        # Member 2: control.tar.gz
        f.write(create_ar_header("control.tar.gz", len(control_tar_bytes)))
        f.write(control_tar_bytes)
        if len(control_tar_bytes) % 2 != 0:
            f.write(b"\n")

        # Member 3: data.tar.gz
        f.write(create_ar_header("data.tar.gz", len(data_tar_bytes)))
        f.write(data_tar_bytes)
        if len(data_tar_bytes) % 2 != 0:
            f.write(b"\n")

    # Also make generic aliases for clean downloads
    shutil.copy2(target_ipk, OUTPUT_DIR / "audiohub.ipk")
    shutil.copy2(target_ipk, OUTPUT_DIR / "azify.ipk")

    shutil.rmtree(temp_stage, ignore_errors=True)
    size_mb = target_ipk.stat().st_size / (1024 * 1024)
    print(f"[SUCCESS] LG webOS TV package built: {target_ipk} ({size_mb:.2f} MB)")
    print(f"[SUCCESS] Alias created: {OUTPUT_DIR / 'audiohub.ipk'}")

if __name__ == "__main__":
    build_ipk()
