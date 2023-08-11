#!/bin/bash
#SBATCH -J multiplatform-horus-build
#SBATCH --output=horus-build.%j.out
#SBATCH --error=horus-build.%j.out
#SBATCH --ntasks=8
#SBATCH --mem-per-cpu=1000
#SBATCH --nodes=1
#SBATCH --time=01:00:00

# Build singularity images
echo "Building Rocky Linux 8 image..."
singularity build Devtools/Singularity/rocky.sif Devtools/Singularity/rocky.yml
echo "Finished building Rocky Linux 8 image"

echo "Building Ubuntu 22.04 image..."
singularity build Devtools/Singularity/ubuntu.sif Devtools/Singularity/ubuntu.yml
echo "Finished building Ubuntu 22.04 image"

# Clean the build folder using the singularity image
echo "Running npm run clean-all using Node from Rocky image..."
singularity exec --bind .:/ Devtools/Singularity/rocky.sif npm run clean-all

# Build Horus for Rocky Linux 8
echo "Building Horus for Rocky Linux 8..."
singularity run --bind .:/ Devtools/Singularity/rocky.sif
echo "Finished building Horus for Rocky Linux 8"

# Clean the compiled files
echo "Running npm run clean-all using Node from Rocky image..."
singularity exec --bind .:/ Devtools/Singularity/rocky.sif npm run clean-build


# Build for Ubuntu 20.04
echo "Building Horus for Ubuntu 20.04..."
singularity run --bind .:/ Devtools/Singularity/ubuntu.sif
echo "Finished building Horus for Ubuntu 20.04"
