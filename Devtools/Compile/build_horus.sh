#!/bin/bash

# WARNING:
# In this script, the frontend is assumed compiled
# In order to compile the frontend, run the following command:
# npm run buildparcel

# Check if the GUI folder exists
if [ ! -d "GUI" ]; then
    echo "GUI folder not found. Please build the frontend first."
    exit 1
fi

# Build the horus API
sh Devtools/Compile/build_horusapi.sh

# Compile the Horus code
python Devtools/Compile/compile.py build_ext

# Bundle the app
pyinstaller Devtools/Compile/build.spec --noconfirm
