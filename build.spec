# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

# Include in the datas the .so files present in the build/cython directory
import os

datas = [("GUI", "GUI")]
# for file in os.listdir("build/cython"):
#     # Linux and macOS
#     if file.endswith(".so"):
#         datas.append((os.path.join("build/cython", file), "."))
#     # Windows
#     if file.endswith(".dll"):
#         datas.append((os.path.join("build/cython", file), "."))


a = Analysis(
    ["Horus.py"],
    pathex=[],
    binaries=[],
    datas=datas,
    # Include the default libraries
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    # Exclude the uncompiled Server and App files
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="Horus",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="Horus",
)
app = BUNDLE(
    coll,
    name="Horus.app",
    icon="Resources/horus.icns",
    bundle_identifier="com.nostrumbiodiscovery.com",
)
