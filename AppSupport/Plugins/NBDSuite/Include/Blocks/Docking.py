from HorusAPI import PluginVariable, SlurmBlock, VariableTypes
from Utils import slurmScript
import os

dockingProtein = PluginVariable(
    name="Protein",
    id="system",
    description="The protein to dock the ligands into.",
    type=VariableTypes.STRUCTURE,
)

ligandSmiles = PluginVariable(
    name="Ligand SMILES",
    id="ligand_smiles",
    description="The ligand to be docked",
    type=VariableTypes.SMILES,
)

cpusDocking = PluginVariable(
    name="CPUs",
    id="cpus",
    description="Number of CPUs to use.",
    type=VariableTypes.INTEGER,
    defaultValue=4,
)

dockingCenter = PluginVariable(
    name="Docking center",
    id="docking_center",
    description="The docking center.",
    type=VariableTypes.SPHERE,
)

nameDocking = PluginVariable(
    name="Simulation name",
    id="simulation_name",
    description="Name of the simulation.",
    type=VariableTypes.STRING,
    defaultValue="Docking",
)

runs_number = PluginVariable(
    name="Runs number",
    id="runs_number",
    description="The number of docking runs to perform per ligand.",
    type=VariableTypes.INTEGER,
    defaultValue=1,
)

drop_heteroatoms = PluginVariable(
    name="Drop heteroatoms",
    id="drop_heteroatoms",
    description="Whether to drop heteroatoms from the protein.",
    type=VariableTypes.HETERORES,
)

outputDocking = PluginVariable(
    name="Simulation results",
    id="output_docking",
    description="The folder containing the docked PDBs.",
    type=VariableTypes.FOLDER,
)


# Induced fit refinement submission of job
def dockingJob(block: SlurmBlock):
    print("Starting docking block...")
    # Get the input protein
    system = block.inputs.get("system", None)

    if system is None:
        raise Exception("No system data provided.")

    system_data_filename = os.path.basename(system)

    # Get the input ligand
    smiles = block.inputs.get("ligand_smiles", None)

    if isinstance(smiles, list):
        smiles = smiles[0]

    if smiles is None:
        raise Exception("No ligand data provided.")

    # Crete a file with the contents of the smile
    ligand_data_filename = "ligand.smi"
    with open(ligand_data_filename, "w") as f:
        f.write(smiles)

    # Get the docking center
    dockingSphere = block.inputs.get("docking_center", None)

    if dockingSphere is None:
        raise Exception("No docking center provided.")

    cpus = int(block.variables.get("cpus", 2))

    if cpus < 2:
        raise Exception("CPUs must be greater than 1.")

    name = block.variables.get("simulation_name", "docking")
    runs_number = int(block.variables.get("runs_number", 10))

    drop_hetero = block.variables.get("drop_heteroatoms", [])

    if drop_hetero is None:
        drop_hetero = []

    # Get the 'auth_comp_id' from the drop_heteroatoms
    drop_hetero = [hetero["auth_comp_id"] for hetero in drop_hetero]

    print("Generating NBDSuite input files...")

    radius = dockingSphere["radius"]
    x = dockingSphere["center"]["x"]
    y = dockingSphere["center"]["y"]
    z = dockingSphere["center"]["z"]

    inputFileContents = inputYAML(
        system_data_filename,
        ligand_data_filename,
        name,
        cpus,
        drop_hetero,
        runs_number,
        x,
        y,
        z,
        radius,
    )

    # Generate the input YAML
    with open(f"{name}.yaml", "w") as f:
        f.write(inputFileContents)

    simRemoteDir = os.path.join(block.remote.horusDir, name)

    # Create the simulation folder in the remote
    block.remote.remoteCommand(f"mkdir -p -v {simRemoteDir}")

    print(f"Created simulation folder in the remote at {simRemoteDir}")
    print("Sending data to the remote...")

    # Send the complex data to the remote
    block.remote.sendData(system, os.path.join(simRemoteDir, system_data_filename))

    # Send the ligand data to the remote
    block.remote.sendData(
        ligand_data_filename, os.path.join(simRemoteDir, ligand_data_filename)
    )

    # Send the input YAML to the remote
    block.remote.sendData(f"{name}.yaml", os.path.join(simRemoteDir, f"{name}.yaml"))

    # Save the SLURM script
    with open(f"{name}.slurm", "w") as f:
        f.write(slurmScript(name, cpus))

    scriptPath = os.path.join(simRemoteDir, f"{name}.slurm")

    # Send the SLURM script to the remote
    block.remote.sendData(f"{name}.slurm", scriptPath)

    print("Data sent to the remote.")
    print("Running the simulation...")

    # Run the simulation
    jobID = block.remote.submitJob(scriptPath)

    print(f"Simulation running with job ID {jobID}")


def finalAction(block: SlurmBlock):
    print("Downloading results...")
    name = block.variables.get("simulation_name", "docking")
    simRemoteDir = os.path.join(block.remote.horusDir, name)
    destPath = os.path.join(os.getcwd(), name)

    print("Destination path:", destPath)

    # Transfer the results from the remote
    block.remote.getData(simRemoteDir, destPath)

    print(f"Results transfered to the local machine at: {destPath}")

    ligandPoses = os.path.join(destPath, name, "3_rdock_docking", "system_1", "results")

    print(f"Setting output of block to the ligand poses: {ligandPoses}")

    # Set the output
    block.setOutput("output_docking", ligandPoses)

    print("Done.")


# Define the block
dockingBlock = SlurmBlock(
    name="Protein-ligand docking",
    description="Dock a ligand into a protein using the NBDSuite.",
    initialAction=dockingJob,
    finalAction=finalAction,
    variables=[
        cpusDocking,
        nameDocking,
        runs_number,
        drop_heteroatoms,
    ],
    inputs=[dockingProtein, ligandSmiles, dockingCenter],
    outputs=[outputDocking],
)


def inputYAML(
    system_data,
    ligand_data,
    name,
    cpus,
    drop_hetero,
    runs_number,
    x,
    y,
    z,
    docking_radius,
):
    return f"""
system_data: {system_data}
ligand_data: {ligand_data}
name: {name}
static_name: true
cpus: {cpus}
verbosity: info
restart: false
pipeline:
- block: topology_extractor
  options:
    check_topology: true
    explicit_h_in_smiles: false
    remove_implicit_hydrogen: false
    fix_structures: true
    assemble_conformations: true
- block: topology_fixer
  options:
    drop_water: true
    repair_heavy_atoms: true
    protonation_ph: 7.0
    fix_systems: true
    fix_ligands: true
    het_residues_to_drop: {drop_hetero}
- block: rdock_docking
  options:
    docking_center: [{x}, {y}, {z}]
    docking_radius: {docking_radius}
"""
