#!/bin/bash


# Clean the environment
echo "Cleaning the environment"
npm run clean

# Initialize micromamba
echo "Initializing micromamba"
eval "$(micromamba shell hook --shell bash)"

echo "Testing Horus for Rocky Linux 8"

# Install node_modules requirements
echo "Installing frontend requirements"
npm i --legacy-peer-deps

# Reinstall the conda environment
echo "Reinstalling the conda environment"
micromamba env remove -n horus_test -y || true
micromamba env create -f Devtools/Environment/conda_horus.yaml -n horus_test

# Activate conda environment
micromamba activate horus_test

# Build the GUI
echo "Building the GUI"
npm run buildparcel

# Run the tests
echo "Running the tests"
npm run test