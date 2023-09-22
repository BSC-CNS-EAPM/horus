from HorusAPI import PluginVariable, SlurmBlock, VariableTypes, Extensions
from Utils import slurmScript
import os

ifrComplexdataInput = PluginVariable(
    name="Complex data",
    id="file",
    description="The PDB file path with the ligand docked.",
    type=VariableTypes.FILE,
    allowedValues=["pdb"],
)

complex_ligand_selection = PluginVariable(
    name="Ligand selection",
    id="ligand_selection",
    description="The ligand selection hetero residue.",
    type=VariableTypes.HETERORES,
)

cpusIFR = PluginVariable(
    name="CPUs",
    id="cpus",
    description="Number of CPUs to use.",
    type=VariableTypes.INTEGER,
    defaultValue=4,
)

nameIFR = PluginVariable(
    name="Simulation name",
    id="simulation_name",
    description="Name of the simulation.",
    type=VariableTypes.STRING,
    defaultValue="ifr",
)

flexibleRegionRadiusIFR = PluginVariable(
    name="Flexible region radius",
    id="flexible_region_radius",
    description="Radius of the flexible region.",
    type=VariableTypes.FLOAT,
    defaultValue=10.0,
)

frozenRegionRadiusIFR = PluginVariable(
    name="Frozen region radius",
    id="frozen_region_radius",
    description="Radius of the frozen region.",
    type=VariableTypes.FLOAT,
    defaultValue=15.0,
)

peleFFIRF = PluginVariable(
    name="PELE force field",
    id="pele_force_field",
    description="PELE force field.",
    type=VariableTypes.STRING_LIST,
    defaultValue="openff-2.0.0",
    allowedValues=["openff-2.0.0", "openff-1.3.0"],
)

peleStepsIFR = PluginVariable(
    name="PELE steps",
    id="pele_steps",
    description="PELE steps.",
    type=VariableTypes.INTEGER,
    defaultValue=5,
)

epochsIFR = PluginVariable(
    name="Epochs",
    id="epochs",
    description="PELE epochs.",
    type=VariableTypes.INTEGER,
    defaultValue=1,
)

outputIFR = PluginVariable(
    name="Simulation results",
    id="path",
    description="The folder containing the results.",
    type=VariableTypes.FOLDER,
)


# Induced fit refinement submission of job
def inducedFitRefinement(block: SlurmBlock):
    complex_data = block.inputs.get("file", None)

    if complex_data is None:
        raise Exception("No complex data provided.")

    complex_data_filename = os.path.basename(complex_data)
    complex_ligand_selection = block.inputs.get("ligand_selection", None)

    # Parse the ligand selection
    if complex_ligand_selection is not None:
        chainID = complex_ligand_selection[0]["chainID"]
        residue = complex_ligand_selection[0]["residue"]
        complex_ligand_selection = f"{chainID}:{residue}"

    cpus = block.variables.get("cpus", 1)

    cpus = int(cpus)

    if cpus < 2:
        raise Exception("CPUs must be greater than 1.")

    name = block.variables.get("simulation_name", "ifr")
    flexible_region_radius = block.variables.get("flexible_region_radius", 10.0)
    frozen_region_radius = block.variables.get("frozen_region_radius", 15.0)
    pele_force_field = block.variables.get("pele_force_field", "OPLS2005")
    pele_steps = block.variables.get("pele_steps", 5)
    epochs = block.variables.get("epochs", 1)

    if isinstance(pele_force_field, list):
        pele_force_field = pele_force_field[0]

    print("Generating NBDSuite input files...")

    inputFileContents = inputYAML(
        complex_data_filename,
        complex_ligand_selection,
        name,
        cpus,
        pele_force_field,
        pele_steps,
        epochs,
        flexible_region_radius,
        frozen_region_radius,
    )

    # Generate the input YAML
    with open(f"{name}.yaml", "w") as f:
        f.write(inputFileContents)

    simRemoteDir = os.path.join(block.remote.workDir, name)

    # Create the simulation folder in the remote
    block.remote.remoteCommand(f"mkdir -p -v {simRemoteDir}")

    print(f"Created simulation folder in the remote at {simRemoteDir}")
    print("Sending data to the remote...")
    # Send the complex data to the remote
    block.remote.sendData(complex_data, os.path.join(simRemoteDir, complex_data_filename))

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

    # # Get the job ID
    # jobID = out.split(" ")[-1].strip()

    print(f"Simulation running with job ID {jobID}")

    # Get the results
    block.setOutput("path", simRemoteDir)


def finalAction(block: SlurmBlock):
    name = block.variables.get("simulation_name", "ifr")
    simRemoteDir = os.path.join(block.remote.workDir, name)

    print("IFR calculation finished, downloading results...")

    destPath = os.path.join(os.getcwd(), name)

    # Transfer the results from the remote
    block.remote.getData(simRemoteDir, destPath)

    print(f"Results transfered to the local machine at: {destPath}")

    print("Setting output of block to the results directory...")
    # Set the output
    block.setOutput("path", destPath)

    # Open the results
    print("Opening results...")

    # Result path is the yaml input file
    resultPath = os.path.join(destPath, f"{name}.yaml")
    Extensions().open("nbdsuite", "peleresults", {"path": resultPath})


# Define the block
inducedFitRefinementBlock = SlurmBlock(
    name="Induced fit refinement",
    description="Perform an induced fit refinement simulation",
    initialAction=inducedFitRefinement,
    finalAction=finalAction,
    variables=[
        cpusIFR,
        nameIFR,
        flexibleRegionRadiusIFR,
        frozenRegionRadiusIFR,
        peleFFIRF,
        peleStepsIFR,
        epochsIFR,
    ],
    inputs=[ifrComplexdataInput, complex_ligand_selection],
    outputs=[outputIFR],
)


def inputYAML(
    complex_data_filename,
    complex_ligand_selection,
    name,
    cpus,
    pele_force_field,
    pele_steps,
    epochs,
    flexible_region_radius,
    frozen_region_radius,
):
    return f"""
complex_data: {complex_data_filename}
complex_ligand_selection: {complex_ligand_selection}
working_directory: .
name: {name}
static_name: true
cpus: {cpus}
verbosity: info
restart: false
pele_solvent: OBC
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
    het_residues_to_drop: []
    fix_systems: true
    fix_ligands: true
- flow: induced_fit_refinement
  options:
    pele_forcefield: {pele_force_field}
    pele_steps: {pele_steps}
    adaptive_epochs: {epochs}
    flexible_region_radius: {flexible_region_radius}
    frozen_region_radius: {frozen_region_radius}
"""
