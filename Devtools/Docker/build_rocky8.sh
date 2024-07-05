#!/bin/bash

# Clean the environment
echo "Cleaning the environment"
bun run clean

# Initialize micromamba
echo "Initializing micromamba"
eval "$(micromamba shell hook --shell bash)"

echo "Starting the build process for Rocky Linux 8"

# Install node_modules requirements
echo "Installing frontend requirements"
bun i --no-save

# Fix parcel with npm
echo "Fixing parcel"
npm i --save-dev --legacy-peer-deps --save-exact parcel@2.12.0

# Reinstall the conda environment
echo "Reinstalling the conda environment"
set +e
micromamba env remove -n horus_rocky8 -y
set -e
micromamba env create -f Devtools/Environment/conda_horus.yaml -n horus_rocky8

# Activate conda environment
micromamba activate horus_rocky8

# Because on Rocky we are using QT,
# we need to install pywebview with the QT backend
python -m pip install pywebview[qt]==5.0.5

# Build horus
echo "Building horus"
bun run build

# Create the packages
echo "Creating the packages"
bun run distribute

# Clean the environment
echo "Cleaning the environment"
bun run clean