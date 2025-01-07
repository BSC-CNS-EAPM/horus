#!/bin/bash

# Clean the environment
echo "Cleaning the environment"
npm run clean

# Initialize micromamba
echo "Initializing micromamba"
eval "$(micromamba shell hook --shell bash)"

echo "Starting the build process for Rocky Linux 8"

# Reinstall the conda environment
echo "Reinstalling the conda environment"
set +e
micromamba env remove -n horus_rocky8 -y || true
set -e
micromamba env create -f Devtools/Environment/conda_horus.yaml -n horus_rocky8

# Activate conda environment
micromamba activate horus_rocky8

# Because on Rocky we are using QT,
# we need to install pywebview with the QT backend
python -m pip install pywebview[qt]==5.0.5

# Build horus
echo "Building horus"
source Devtools/Compile/build_horus.sh

# Create the packages
echo "Creating the packages"
npm run distribute

# Clean the environment
echo "Cleaning the environment"
npm run clean