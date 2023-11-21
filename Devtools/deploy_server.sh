#!/bin/bash
#SBATCH -J horus-server
#SBATCH --output=horus-server.out
#SBATCH --error=horus-server.out
#SBATCH --ntasks=4
#SBATCH --mem-per-cpu=1000
#SBATCH --nodes=1
#SBATCH --time=UNLIMITED

echo "Running Horus server in production mode..."

# Run the server
./dist/Horus/Horus --server --port 8080 --host 0.0.0.0