def slurmScript(name, cpus):
    return f"""#!/bin/bash
#SBATCH -J {name}-horus
#SBATCH --output={name}-horus%j.out
#SBATCH --error={name}-horus%j.err
#SBATCH --ntasks={cpus}
#SBATCH --mem-per-cpu=1000
#SBATCH --nodes=1
#SBATCH --time=01:00:00

## PELE
ml PELE
ml Schrodinger

## Rdock
ml rDock


## NBD Suite
source activate /shared/work/NBDSuite/envs/nbdsuite-0.0.1rc1

time python -m nbdsuite.main {name}.yaml

"""
