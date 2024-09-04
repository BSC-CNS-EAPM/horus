#!/bin/bash

# Make sure the GUI folder is present
if [ ! -d "GUI" ]; then
    echo "GUI folder not found. Please run 'bun run buildparcel' first from a compatible system."
    exit 1
fi

# Clean the environment
echo "Cleaning the environment"
sh Devtools/clean.sh

# Initialize micromamba
echo "Initializing micromamba"
eval "$(micromamba shell hook --shell bash)"

echo "Starting the build process for Ubuntu 14.04"

# Reinstall the conda environment
echo "Reinstalling the conda environment"
micromamba env remove -n horus_ubuntu14 -y || true
micromamba env create -f Devtools/Environment/conda_horus.yaml -n horus_ubuntu14

# Activate conda environment
micromamba activate horus_ubuntu14

# Build horus
sh Devtools/Compile/build_horus.sh

# Create the packages
sh Devtools/Package/linux.sh

# Clean the environment
rm -rf build