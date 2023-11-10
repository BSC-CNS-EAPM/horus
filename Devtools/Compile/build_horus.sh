#!/bin/bash

# Build the frontend
npm run buildparcel

# Compile the python code
python Devtools/Compile/compile.py build_ext

# Bundle the app
pyinstaller Devtools/Compile/build.spec --noconfirm

# Build the horus API
npm run build-horusapi

