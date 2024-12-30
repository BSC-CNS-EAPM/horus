"""
Load a trajectory in Mol*
"""

import os
from HorusAPI import PluginVariable, PluginBlock, VariableTypes, MolstarAPI


topologyVariable = PluginVariable(
    name="Topology",
    id="topology",
    description="The topology file.",
    type=VariableTypes.FILE,
    allowedValues=[
        "top",
        "psf",
        "prmtop",
        "mmcif",
        "cifCore",
        "pdb",
        "pdbqt",
        "gro",
        "xyz",
        "lammps_data",
        "lammps_traj_data",
        "mol",
        "sdf",
        "mol2",
    ],
)

coordinatesVariable = PluginVariable(
    name="Coordinates",
    id="coordinates",
    description="The coordinates file.",
    type=VariableTypes.FILE,
    allowedValues=["dcd", "xtc", "trr", "nctraj", "lammpstrj"],
)


def loadTrajectory(block: PluginBlock):

    topology = block.inputs.get("topology", None)

    if not topology:
        raise ValueError("No topology file provided")

    if not os.path.exists(topology):
        raise ValueError("Topology file does not exist")

    coordinates = block.inputs.get("coordinates", None)

    if not coordinates:
        raise ValueError("No coordinates file provided")

    if not os.path.exists(coordinates):
        raise ValueError("Coordinates file does not exist")

    MolstarAPI().loadTrajectory(topology, coordinates)


loadTrajectoryBlock = PluginBlock(
    name="Load trajectory",
    id="trajectory",
    description="Loads a trajectory in Mol* from topology and coordinates files.",
    action=loadTrajectory,
    inputs=[topologyVariable, coordinatesVariable],
    category="Structures",
)
