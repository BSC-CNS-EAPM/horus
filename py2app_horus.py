import os
from setuptools import setup
import shutil


def tree(src):
    return [
        (root, map(lambda f: os.path.join(root, f), files))
        for (root, dirs, files) in os.walk(os.path.normpath(src))
        if "__pycache__" not in root
    ]


def soFiles(src):
    return [
        (root, map(lambda f: os.path.join(root, f), files))
        for (root, dirs, files) in os.walk(os.path.normpath(src))
        if "__pycache__" not in root and root.endswith(".so")
    ]


ENTRY_POINT = ["Horus.py"]

DATA_FILES = tree("Gui") + soFiles("Build")

OPTIONS = {
    "argv_emulation": False,
    "strip": True,
    "iconfile": "Resources/horus.icns",
    "includes": ["WebKit", "Foundation", "webview"],
    # "excludes": ["PyQt5", "PySide6", "PyInstaller"],
    "excludes": ["PyInstaller", "PySide6"],
}

setup(
    app=ENTRY_POINT,
    data_files=DATA_FILES,
    options={"py2app": OPTIONS},
    setup_requires=["py2app"],
)


# Remove the build folder
shutil.rmtree("build")
