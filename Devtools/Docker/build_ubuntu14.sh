echo "Starting the build process for Ubuntu 14.04"

# Source conda
. /opt/conda/etc/profile.d/conda.sh

# Make sure the GUI folder is present
if [ ! -d "GUI" ]; then
    echo "GUI folder not found. Please run 'npm run buildparcel' first from a compatible system."
    exit 1
fi

# Reinstall the conda environment
conda env remove -n horus_ubuntu14 -y
conda env create -f Devtools/Environment/conda_horus.yaml -n horus_ubuntu14

# Activate conda environment
conda activate horus_ubuntu14

# Build horus
sh Devtools/Compile/build_horus.sh

# Create the packages
sh Devtools/Package/linux.sh

# Clean the environment
rm -rf build