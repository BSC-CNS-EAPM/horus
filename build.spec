import os

cython_folder = os.path.join("build", "cython")

datas = [("GUI", "GUI"), (cython_folder, ".")]

a = Analysis(
    ["Horus.py"],
    pathex=[],
    binaries=[],
    datas=datas,
    # Include the default libraries
    hiddenimports=["webview", "flask", "requests"],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    # Exclude the uncompiled Server and App files
    excludes=["Server", "App"],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=None)

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
