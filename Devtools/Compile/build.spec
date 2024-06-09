"""
PyInstaller build script for Horus
"""

import os
import imp  # pylint: disable=deprecated-module
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
with open(app_info_file, "r", encoding="utf-8") as f:
    for line in f:
        if "=" in line:
            key, value = line.split("=")
            APP_INFO[key.strip()] = value.strip()

# Set the version the same as the HorusAPI version
sys.path.append(currentDir)
import HorusAPI  # pylint: disable=wrong-import-position

version = HorusAPI.__version__
# If long_version does not contain "release"
# use the branch name as the version (with commit hash)
if "release" not in version:
    real_version = version.split("-")[0]
    branch = "-".join(version.split("-")[1:])
    # Add the branch name to the version with .dev
    version = f"{real_version}.dev0+{branch}"
else:
    # Remove the "release" word from the version
    version = version.split("-")[0]

# Replace any underscores with hyphens
version = version.replace("_", "-")

APP_INFO["APP_VERSION"] = version

# Update the Horus plugin version to the same as the HorusAPI version
with open("AppSupport/DefaultPlugins/Horus/plugin.meta", "r", encoding="utf-8") as f:
    pluginMetaHorusBackup = f.readlines()

with open("AppSupport/DefaultPlugins/Horus/plugin.meta", "w", encoding="utf-8") as f:
    for line in pluginMetaHorusBackup:
        if "version" in line:
            f.write(f'\t"version": "{version}",\n')
        else:
            f.write(line)

# Default settings
default_settings = os.path.join(currentDir, "App", "default_settings.json")

datas = [
    (gui_folder, "GUI"),
    (cython_folder, "."),
    (default_plugins_folder, "DefaultPlugins"),
    (app_info_file, "."),
    (default_settings, "."),
]

# Include the HorusAPI built folder. If no files are found, exit with error
builtAPIpath = os.path.join(currentDir, "HorusAPI", "build")

# Search for a folder that starts with "lib."
builtAPIfolder = None
for folder in os.listdir(builtAPIpath):
    if folder.startswith("lib."):
        builtAPIfolder = os.path.join(builtAPIpath, folder, "HorusAPI")
        break

if builtAPIfolder is None or not os.path.exists(builtAPIfolder):
    print("Error: No built HorusAPI found. Cannot compile.")
    sys.exit(1)

# Include the built HorusAPI folder
datas.append((builtAPIfolder, "HorusAPI"))

# Required modules
imports = [
    "werkzeug.utils",
    "webview",
    "flask",
    "requests",
    "fabric",
    "flask_session",
    "multiprocess",
    "pathvalidate",
    "molviewspec",
    "sqlalchemy",
    "secrets",
    "smtplib",
    "ssl",
]

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

# Modules required for flask_session and webapp mode
imports += [
    "flask_login",
    "email",
    "email.mime",
    "email.mime.text",
    "email.mime.*",
    "apscheduler",
]

# Import biopython for the Horus default plugin
imports += ["Bio", "Bio.PDB", "numpy", "scipy", "scipy.spatial"]

# Imports that are not included by default but needed
imports += [
    "cmath",  # Needed for NBDSuite
    "syscolors",  # Needed for NBDSuite
    "xdrlib",  # Needed for AdaptivePELE (NBDSuite)
    "fileinput",  # Needed for BSC Plugins
    "logging.config",  # Needed for BSC Plugins
    "colorsys",  # Needed for BSC Plugins
    "cProfile",  # Needed for BSC Plugins
    "timeit",  # Needed for BSC Plugins
    "zope",  # Needed for BSC Plugins
    "zope.interface",  # Needed for BSC Plugins
    "zope.interface.adapter",  # Needed for BSC Plugins
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

# Runtime hook in order to fix macOS thread security
runtime_hooks = ["Devtools/Compile/macos-hook.py"]

# Compile the app
a = Analysis(  # type: ignore pylint: disable=undefined-variable
    entry_point,
    pathex=[],
    binaries=binaries,
    datas=datas,
    # Include the default libraries
    hiddenimports=imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=runtime_hooks,
    # Exclude the uncompiled Server and App files
    excludes=exclude_folders,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)  # type: ignore pylint: disable=undefined-variable

exe = EXE(  # type: ignore pylint: disable=undefined-variable
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
coll = COLLECT(  # type: ignore pylint: disable=undefined-variable
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
with open(
    os.path.join(currentDir, "dist", APP_INFO["NAME"], "APP_INFO"), "w", encoding="utf-8"
) as f:
    for key, value in APP_INFO.items():
        f.write(f"{key} = {value}\n")

macos_icon = os.path.join(currentDir, "Resources", "horus.icns")

app = BUNDLE(  # type: ignore pylint: disable=undefined-variable
    coll,
    name=f"{APP_INFO['NAME']}.app",
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
    with open(bundleInfo, "w", encoding="utf-8") as f:
        for key, value in APP_INFO.items():
            f.write(f"{key} = {value}\n")

# If we are on Linux, copy the icon to the dist/Horus folder
if sys.platform == "linux":
    shutil.copy(macos_icon, os.path.join(currentDir, "dist", f"{APP_INFO['NAME']}", "horus.icns"))


# Restore the original plugin.meta file
with open("AppSupport/DefaultPlugins/Horus/plugin.meta", "w", encoding="utf-8") as f:
    for line in pluginMetaHorusBackup:
        f.write(line)
