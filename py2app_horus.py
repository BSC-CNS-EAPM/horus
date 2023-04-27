"""
This is an example of py2app setup.py script for freezing your pywebview
application

Usage:
    python setup.py py2app
"""

import os
from setuptools import setup


def tree(src):
    return [
        (root, map(lambda f: os.path.join(root, f), files))
        for (root, dirs, files) in os.walk(os.path.normpath(src))
        if "__pycache__" not in root
    ]


ENTRY_POINT = ["main.py"]

DATA_FILES = tree("Gui") + tree("Server")

print("Data files: ", DATA_FILES)

OPTIONS = {
    "argv_emulation": False,
    "strip": True,
    "iconfile": "Resources/horus.icns",  # uncomment to include an icon
    "includes": ["WebKit", "Foundation", "webview"],
}

setup(
    app=ENTRY_POINT,
    data_files=DATA_FILES,
    options={"py2app": OPTIONS},
    setup_requires=["py2app"],
)
