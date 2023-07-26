import os
import imp
import shutil

currentDir = os.getcwd()

# Main App script
entry_point = [os.path.join(currentDir, "Horus.py")]

# Exclude the Server and App folders
exclude_folders = ["App", "Server", "HorusAPI"]

# Include the Cython folder
cython_folder = os.path.join(currentDir, "build", "cython")

# Include the GUI folder
gui_folder = os.path.join(currentDir, "GUI")

# Include the default plugins folder
default_plugins_folder = os.path.join(currentDir, "AppSupport", "DefaultPlugins")

# Delete any config folder in the AppSupport/Plugins/<pluginname>/ folder
# Iterate over all the folders in AppSupport/Plugins
for plugin in os.listdir(default_plugins_folder):
    # List all the files in the plugin folder
    plugin_folder = os.path.join(default_plugins_folder, plugin)
    # Check that the folder exists and its a dir
    if not os.path.exists(plugin_folder) or not os.path.isdir(plugin_folder):
        continue
    for file in os.listdir(plugin_folder):
        # If the file is a folder and is called config, delete it
        if os.path.isdir(os.path.join(plugin_folder, file)) and file == "config":
            shutil.rmtree(os.path.join(plugin_folder, file))

datas = [
    (gui_folder, "GUI"),
    (cython_folder, "."),
    (default_plugins_folder, "DefaultPlugins"),
]

# Required modules
imports = ["webview", "flask", "requests"]

# Add all the submodules required by flask_socketio
imports += [
    "flask_socketio",
    "engineio.async_drivers.eventlet",
    "eventlet",
    "eventlet.hubs.epolls",
    "eventlet.hubs.kqueue",
    "eventlet.hubs.selects",
    "dns",
    "dns.dnssec",
    "dns.e164",
    "dns.namedict",
    "dns.tsigkeyring",
    "dns.update",
    "dns.version",
    "dns.zone",
    "dns.asyncbackend",
    "dns.asyncresolver",
    "dns.asyncquery",
    "dns.versioned",
]

# # Try to use pyqt
# try:
#     imp.find_module("pyside6")
#     print("Using PySide for build")
#     imports += ["pyside6"]
# except ImportError:
#     print("PyQT5 not found")
#     sys.exit(1)


# # ===========================
# # IMPORTANT
# # ===========================
# # Remember to import the
# # dependencies of the default
# # plugins
# # ===========================
# nbdsuite_deps = [
#     "nbdsuite",
#     "nbdsuite.utils",
#     "nbdsuite.utils.helpers",
#     "nbdsuite.utils.helpers.common",
#     "Bio",
#     "Bio.PDB",
#     "pandas",
#     "yaml",
#     "biopython",
#     "adaptivepele",
#     "mdtraj",
#     "pydantic",
# ]

# imports += nbdsuite_deps

# Check that all the modules are installed in the environment
currentModule = ""
try:
    for module in imports:
        currentModule = module
        imp.find_module(module)
except ImportError as e:
    try:
        __import__(currentModule)
    except ImportError:
        print(f"Error importing module: {e}. Cannot compile.")
        exit(1)


# Compile the app
a = Analysis(  # noqa # type: ignore
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
pyz = PYZ(a.pure, a.zipped_data, cipher=None)  # noqa # type: ignore

exe = EXE(  # noqa # type: ignore
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
coll = COLLECT(  # noqa # type: ignore
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

app = BUNDLE(  # noqa # type: ignore
    coll,
    name="Horus.app",
    icon=macos_icon,
    bundle_identifier="com.nostrumbiodiscovery.com",
)
