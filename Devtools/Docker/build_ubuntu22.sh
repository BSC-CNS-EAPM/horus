echo "Starting the build process for Ubuntu 22.04"

# Source conda
. /opt/conda/etc/profile.d/conda.sh

# Remove the old node_modules
rm -rf node_modules

# Install npm requirements
npm install --legacy-peer-deps

# Fix parcel with yarn
npm install --legacy-peer-deps yarn@1.22.21
npx yarn

# Reinstall the conda environment
conda env remove -n horus_ubuntu22 -y
conda env create -f Devtools/Environment/conda_horus.yaml -n horus_ubuntu22

# Activate conda environment
conda activate horus_ubuntu22

# Update conda environment with Ubuntu-specific packages
python -m pip install pygobject==3.46.0 pycairo==1.25.1

# Generate the view
npm run buildparcel

# Build horus
npm run build

# Create the packages
npm run distribute

# Clean the environment
npm run clean-build