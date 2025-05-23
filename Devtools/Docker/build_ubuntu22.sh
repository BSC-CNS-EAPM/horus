#!/bin/bash

# Clean the environment
echo "Cleaning the environment"
npm run clean

# Initialize micromamba
echo "Initializing micromamba"
eval "$(micromamba shell hook --shell bash)"

echo "Starting the build process for Ubuntu 22.04"

# Install node_modules requirements
echo "Installing frontend requirements"
npm i --legacy-peer-deps

# Reinstall the conda environment
echo "Reinstalling the conda environment"
micromamba env remove -n horus_ubuntu22 -y
micromamba env create -f Devtools/Environment/conda_horus.yaml -n horus_ubuntu22

# Activate conda environment
micromamba activate horus_ubuntu22

# Update conda environment with Ubuntu-specific packages
python -m pip install pygobject==3.46.0 pycairo==1.25.1

# Build horus
echo "Building horus"
npm run build

# Create the packages
echo "Creating the packages"
npm run distribute

# Clean the environment
echo "Cleaning the environment"
npm run clean