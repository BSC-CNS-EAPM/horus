import os

currentDir = os.getcwd()

# Main App script
entry_point = [os.path.join(currentDir, "Horus.py")]

# Exclude the Server and App folders
exclude_folders =[
    "App",
    "Server",
    "HorusPlugins"
]

# Include the Cython folder
cython_folder = os.path.join(currentDir, "build", "cython")

# Include the GUI folder
gui_folder = os.path.join(currentDir, "GUI")

datas = [(gui_folder, "GUI"), (cython_folder, ".")]

# Required modules
imports = ["webview", "flask", "requests", "nbdsuite"]

# Check that all the modules are installed in the environment
try:
    for module in imports:
        __import__(module)
except ImportError as e:
    print(f"Error importing module {module}: {e}. Cannot compile.")
    exit(1)


a = Analysis(
    entry_point,
    pathex=[],
    binaries=[],
    datas=datas,
    # Include the default libraries
    hiddenimports=imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    # Exclude the uncompiled Server and App files
    excludes=exclude_folders,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
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

macos_icon = os.path.join(currentDir, "Resources", "horus.icns")

app = BUNDLE(
    coll,
    name="Horus.app",
    icon=macos_icon,
    bundle_identifier="com.nostrumbiodiscovery.com",
)
