"""
Utilities for the NBDSuitePro plugin.
"""


class SlurmProScript:
    """
    Generate the SLURM script for the simulation.
    """

    name: str = "horusJob"
    """
    The name of the Slurm job
    """

    cpus: int = 2
    """
    The number of cpus to use (default: 2)
    """

    mem: int = 1000
    """
    The memory to use per cpu in MB (default: 1000)
    """

    qos: str = "normal"
    """
    The qos to use (default: normal)
    """

    partition: str = "defq"
    """
    The partition to use (default: defq)
    """

    nodes: int = 1
    """
    The number of nodes to use (default: 1)
    """

    time: str = "01:00:00"
    """
    The time to use in hh:mm:ss (default: 01:00:00)
    """

    modules: list[str] = []
    """
    A list of modules to load (default: [])
    """

    suiteEnvPath: str = "/shared/work/NBDSuite/envs/nbdsuite-0.0.1rc1"
    """
    The path to the python environment where the NBDSuite is installed
    """

    def __init__(self):
        pass

    def getScript(self):
        # Parse modules
        modules = "\n".join([f"ml {module}" for module in self.modules])

        return f"""#!/bin/bash
#SBATCH -J {self.name}-horus
#SBATCH --output={self.name}-horus%j.out
#SBATCH --error={self.name}-horus%j.err
#SBATCH --ntasks={self.cpus}
#SBATCH --mem-per-cpu={self.mem}
#SBATCH --qos={self.qos}
#SBATCH --partition={self.partition}
#SBATCH --nodes={self.nodes}
#SBATCH --time={self.time}

## Modules
{modules}


## NBDSuite
source activate {self.suiteEnvPath}

python -u -m nbdsuite.main {self.name}.yaml

"""
