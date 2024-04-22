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

# Clean the build folder using the singularity image
echo "Running bun run clean-all using Node from Rocky image..."
singularity exec --bind .:/app docker://chdominguez/horus_rocky bun run clean-all

# Build Horus for Rocky Linux 8
echo "Building Horus for Rocky Linux 8..."
singularity run --bind .:/app docker://chdominguez/horus_rocky
echo "Finished building Horus for Rocky Linux 8"

# Clean the compiled files
echo "Running bun run clean-build using Node from Rocky image..."
singularity exec --bind .:/app docker://chdominguez/horus_rocky bun run clean-build

# Build for Ubuntu 22.04
echo "Building Horus for Ubuntu 22.04..."
singularity run --bind .:/app docker://chdominguez/horus_ubuntu
echo "Finished building Horus for Ubuntu 22.04"

# Clean the compiled files
echo "Running bun run clean-build using Node from Rocky image..."
singularity exec --bind .:/app docker://chdominguez/horus_ubuntu bun run clean-build

# Build for Ubuntu 14.04
echo "Building Horus on Ubuntu 14.04 (Universal linux, no-pywebview)..."
singularity run --bind .:/app docker://chdominguez/horus_universal
echo "Finished building Horus for Ubuntu 14.04"

# Build for CentOS 7
echo "Building Horus on CentOS 7 (no-pywebview)..."
singularity run --bind .:/app docker://chdominguez/horus_centos
echo "Finished building Horus for CentOS 7"

echo "\n"
echo "==============================================="
echo "Finished building Horus for all Linux platforms"
echo "==============================================="
