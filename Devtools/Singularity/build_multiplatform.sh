#!/bin/bash
#SBATCH -J multiplatform-horus-build
#SBATCH --output=horus-build.%j.out
#SBATCH --error=horus-build.%j.out
#SBATCH --ntasks=4
#SBATCH --mem-per-cpu=1000
#SBATCH --nodes=1
#SBATCH --time=01:00:00
#SBATCH --qos=short
#SBATCH --partition=short

# Build singularity images
echo "Building Rocky Linux 8 image..."
singularity build Devtools/Singularity/rocky8.sif Devtools/Singularity/rocky8.yml
echo "Finished building Rocky Linux 8 image"

echo "Building Ubuntu 22.04 image..."
singularity build Devtools/Singularity/ubuntu22.sif Devtools/Singularity/ubuntu22.yml
echo "Finished building Ubuntu 22.04 image"

echo "Building Ubuntu 14.04 image..."
singularity build Devtools/Singularity/ubuntu14.sif Devtools/Singularity/ubuntu14.yml
echo "Finished building Ubuntu 14.04 image"

# Clean the build folder using the singularity image
echo "Running npm run clean-all using Node from Rocky image..."
singularity exec --bind .:/ Devtools/Singularity/rocky8.sif npm run clean-all

# Build Horus for Rocky Linux 8
echo "Building Horus for Rocky Linux 8..."
singularity run --bind .:/ Devtools/Singularity/rocky8.sif
echo "Finished building Horus for Rocky Linux 8"

# Clean the compiled files
echo "Running npm run clean-build using Node from Rocky image..."
singularity exec --bind .:/ Devtools/Singularity/rocky8.sif npm run clean-build

# Build for Ubuntu 22.04
echo "Building Horus for Ubuntu 22.04..."
singularity run --bind .:/ Devtools/Singularity/ubuntu22.sif
echo "Finished building Horus for Ubuntu 22.04"

# Clean the compiled files
echo "Running npm run clean-build using Node from Rocky image..."
singularity exec --bind .:/ Devtools/Singularity/rocky8.sif npm run clean-build

# Build for Ubuntu 14.04
echo "Building Horus on Ubuntu 14.04 (Universal linux, no-gui)..."
singularity run --bind .:/ Devtools/Singularity/ubuntu14.sif
echo "Finished building Horus for Ubuntu 14.04"

echo "\n"
echo "==============================================="
echo "Finished building Horus for all Linux platforms"
echo "==============================================="
