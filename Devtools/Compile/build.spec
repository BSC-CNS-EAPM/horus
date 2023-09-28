import os
import imp
import shutil
import sys

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

# .env file
app_info_file = os.path.join(currentDir, "App", "APP_INFO")

# Open the APP INFO file and load as a dict
APP_INFO = {}
with open(app_info_file, "r") as f:
    for line in f:
        if "=" in line:
            key, value = line.split("=")
            APP_INFO[key.strip()] = value.strip()

# Set the version the same as the HorusAPI version
sys.path.append(currentDir)
import HorusAPI

version = HorusAPI.__version__

if "release" not in version:
    real_version = version.split("-")[0]
    branch = "-".join(version.split("-")[1:])
    # Add the branch name to the version with .dev
    version = f"{real_version}.dev0+{branch}"
else:
    # Remove the "release" word from the version
    version = version.split("-")[0]

APP_INFO["APP_VERSION"] = version

# Default settings
default_settings = os.path.join(currentDir, "App", "default_settings.json")

datas = [
    (gui_folder, "GUI"),
    (cython_folder, "."),
    (default_plugins_folder, "DefaultPlugins"),
    (app_info_file, "."),
    (default_settings, "."),
]

# Required modules
imports = ["webview", "flask", "requests", "fabric"]

# Add all the submodules required by flask_socketio
imports += [
    "flask_socketio",
    "flask_cors",
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

# Import biopython for the Horus default plugin
imports += ["Bio", "Bio.PDB"]

# Imports that are not included by default but needed
imports += [
    "cmath",  # Needed for NBDSuite
    "syscolors",  # Needed for NBDSuite
    "xdrlib",  # Needed for AdaptivePELE (NBDSuite)
]

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
        sys.exit(1)

# If we are on el8 linux, include QT5 libraries
# Execute a 'uname -a' and check if the output contains 'el8'
if ".el8." in os.popen("uname -a").read():
    imports += [
        "PyQt5",
        "PyQt5.QtCore",
        "PyQt5.QtGui",
        "PyQt5.QtWidgets",
        "PyQt5.QtWebEngineWidgets",
        "PyQt5.QtWebChannel",
    ]

binaries = []

debug = False

# Compile the app
a = Analysis(  # noqa # type: ignore
    entry_point,
    pathex=[],
    binaries=binaries,
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
    name=APP_INFO["NAME"],
    debug=debug,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=debug,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    version=APP_INFO["APP_VERSION"],
)
coll = COLLECT(  # noqa # type: ignore
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name=APP_INFO["NAME"],
)

# Replace the APP_INFO inside the created app for the updated one
with open(os.path.join(currentDir, "dist", APP_INFO["NAME"], "APP_INFO"), "w") as f:
    for key, value in APP_INFO.items():
        f.write(f"{key} = {value}\n")

macos_icon = os.path.join(currentDir, "Resources", "horus.icns")

app = BUNDLE(  # noqa # type: ignore
    coll,
    name="Horus.app",
    icon=macos_icon,
    bundle_identifier=APP_INFO["BUNDLE_IDENTIFIER"],
    version=APP_INFO["APP_VERSION"],
)


# If we are on macOS, replace also the APP_INFO inside the .app
# Replace the APP_INFO inside the created app for the updated one
if sys.platform == "darwin":
    bundleInfo = os.path.join(
        currentDir, "dist", f"{APP_INFO['NAME']}.app", "Contents", "MacOS", "APP_INFO"
    )
    with open(bundleInfo, "w") as f:
        for key, value in APP_INFO.items():
            f.write(f"{key} = {value}\n")
