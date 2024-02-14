#!/bin/bash

echo "Starting the test process for Rocky Linux 8"

# Source conda
. /opt/conda/etc/profile.d/conda.sh

# Reinstall the conda environment
conda env remove -n horus_test -y
conda env create -f Devtools/Environment/conda_horus.yaml -n horus_test

# Activate conda environment
conda activate horus_test

# Run the tests
npm run test