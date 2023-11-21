#!/bin/bash
#SBATCH -J horus-server
#SBATCH --output=horus-server.out
#SBATCH --error=horus-server.out
#SBATCH --ntasks=4
#SBATCH --mem-per-cpu=1000
#SBATCH --nodes=1
#SBATCH --time=UNLIMITED


echo "Running Horus server in uncompiled, debug mode..."

# Load conda
source activate /home/nbdweb/.conda/envs/horus

# Activate the environment
conda activate horus

# Run the server
python Horus.py -d -s -p 8082 -h 0.0.0.0
