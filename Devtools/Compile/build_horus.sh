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

# Set the LD_LIBRARY_PATH so that Linux compilations use conda openssl instead of system wide
export LD_LIBRARY_PATH=$CONDA_PREFIX/lib

# Build the horus API
sh Devtools/Compile/build_horusapi.sh

# Compile the Horus code. If this fails, exit
python Devtools/Compile/compile.py build_ext

if [ $? -ne 0 ]; then
    echo "Compilation failed"
    exit 1
fi

# Bundle the app
pyinstaller Devtools/Compile/build.spec --noconfirm
