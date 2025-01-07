import shutil
import sys
import os

# Get the pip folder entirely, not just the executable
from PyInstaller.utils.hooks import collect_submodules

hiddenimports = collect_submodules("pip")

# Remopve hiddenimports that cannot be found (that end with __)
hiddenimports = [h for h in hiddenimports if not h.endswith("__")]

pip_dist_path = None
for d in sys.path:
    if d.endswith("site-packages"):
        pip_dist_path = d

if pip_dist_path is None:
    raise Exception("Could not find pip dist path")

pip_dist_path = os.path.join(pip_dist_path, "pip")

a = Analysis(  # type: ignore
    [shutil.which("pip")],
    pathex=[],
    binaries=[],
    datas=[(pip_dist_path, "pip")],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)  # type: ignore

exe = EXE(  # type: ignore
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="pip",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(  # type: ignore
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="pip",
)
