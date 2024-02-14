#!/bin/bash

echo "Starting the build process for Rocky Linux 8"

# Source conda
. /opt/conda/etc/profile.d/conda.sh

# Remove the old node_modules
rm -rf node_modules

# Install npm requirements
npm install --legacy-peer-deps

# Use yarn to fix parceljs runtime
npm install --legacy-peer-deps yarn@1.22.21
npx yarn

# Reinstall the conda environment
conda env remove -n horus_rocky8 -y
conda env create -f Devtools/Environment/conda_horus.yaml -n horus_rocky8

# Activate conda environment
conda activate horus_rocky8

# Because on Rocky we are using QT,
# we need to install pywebview with the QT backend
python -m pip install pywebview[qt]==4.2.2

# Build horus
npm run build

# Create the packages
npm run distribute

# Clean the environment
npm run clean-build