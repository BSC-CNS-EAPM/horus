#!/bin/bash

# Build the frontend
npm run buildparcel

# Compile the python code
python Devtools/Compile/compile.py build_ext

# Bundle the app
pyinstaller Devtools/Compile/build.spec --noconfirm

# Compile the NBDSuite frontend
npm run parcel-nbdsuite

# Build the NBDsuite plugin
npm run build-nbdsuite-plugin

# Build the horus API
npm run build-horusapi

