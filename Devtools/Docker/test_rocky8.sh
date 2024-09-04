#!/bin/bash


# Clean the environment
echo "Cleaning the environment"
bun run clean

# Initialize micromamba
echo "Initializing micromamba"
eval "$(micromamba shell hook --shell bash)"

echo "Testing Horus for Rocky Linux 8"

# Install node_modules requirements
echo "Installing frontend requirements"
bun i --no-save

# Fix parcel with npm
echo "Fixing parcel"
npm i --save-dev --legacy-peer-deps --save-exact parcel@2.12.0

# Reinstall the conda environment
echo "Reinstalling the conda environment"
micromamba env remove -n horus_test -y || true
micromamba env create -f Devtools/Environment/conda_horus.yaml -n horus_test

# Activate conda environment
micromamba activate horus_test

# Build the GUI
echo "Building the GUI"
bun run buildparcel

# Run the tests
echo "Running the tests"
bun run test