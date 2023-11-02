"""
Module containing the Rdock Docking block for the NBDSuite plugin
"""

import os
from Utils import slurmScript
from HorusAPI import PluginVariable, SlurmBlock, VariableTypes, VariableGroup

# ==========================#
# Variable inputs
# ==========================#
systemData = PluginVariable(
    name="Protein",
    id="system",
    description="The protein to dock the ligands into.",
    type=VariableTypes.STRUCTURE,
)

ligandSmiles = PluginVariable(
    name="Ligand SMILES",
    id="ligand",
    description="The ligand smiles to dock into the protein.",
    type=VariableTypes.SMILES,
)

ligandFile = PluginVariable(
    name="Ligand file",
    id="ligand",
    description="The ligand file to dock into the protein.",
    type=VariableTypes.FILE,
    allowedValues=["sdf", "smi"],
)

ligandFolder = PluginVariable(
    name="Ligand folder",
    id="ligand",
    description="The folder containing the ligands to dock into the protein.",
    type=VariableTypes.FOLDER,
)

dockingCenter = PluginVariable(
    name="Docking center",
    id="dockingCenter",
    description="Docking center.",
    type=VariableTypes.SPHERE,
)

# ==========================#
# Input groups
# ==========================#

ligandSmiGroup = VariableGroup(
    id="ligandSmiGroup",
    name="Ligand SMILES",
    description="Pass a ligand SMILES to dock into the protein.",
    variables=[systemData, ligandSmiles, dockingCenter],
)

ligandFileGroup = VariableGroup(
    id="ligandFileGroup",
    name="Ligand file",
    description="Pass a ligand file to dock into the protein.",
    variables=[systemData, ligandFile, dockingCenter],
)

ligandFolderGroup = VariableGroup(
    id="ligandFolderGroup",
    name="Ligand folder",
    description="Pass a folder containing ligand files to dock into the protein.",
    variables=[systemData, ligandFolder, dockingCenter],
)

# ==========================#
# Other variables
# ==========================#
cpusDocking = PluginVariable(
    name="CPUs",
    id="cpus",
    description="Number of CPUs to use.",
    type=VariableTypes.INTEGER,
    defaultValue=4,
)

nameDocking = PluginVariable(
    name="Simulation name",
    id="simulation_name",
    description="Name of the simulation.",
    type=VariableTypes.STRING,
    defaultValue="Docking",
)

staticName = PluginVariable(
    name="Static name",
    id="static_name",
    description="If true, the simulation name will not be changed if "
    + "another simulation with the same name exists.",
    type=VariableTypes.BOOLEAN,
    defaultValue=False,
)

verbosity = PluginVariable(
    name="Verbosity",
    id="verbosity",
    description="Verbosity of the simulation.",
    type=VariableTypes.STRING_LIST,
    defaultValue="INFO",
    allowedValues=["INFO", "DEBUG", "WARNING", "ERROR", "CRITICAL"],
)

outputIFD = PluginVariable(
    name="Simulation results",
    id="path",
    description="The folder containing the results.",
    type=VariableTypes.FOLDER,
)

outputDocking = PluginVariable(
    name="Simulation results",
    id="outputDocking",
    description="The folder containing the docked PDBs.",
    type=VariableTypes.FOLDER,
)

##############################
# Block's advanced variables #
##############################

# Topology extractor
checkTopology = PluginVariable(
    name="Check topology",
    id="check_topology",
    description="Check the topology of the system.",
    type=VariableTypes.BOOLEAN,
    defaultValue=True,
)

explicitHInSmiles = PluginVariable(
    name="Explicit H in smiles",
    id="explicit_h_in_smiles",
    description="Explicit H in smiles.",
    type=VariableTypes.BOOLEAN,
    defaultValue=False,
)

removeImplicitHydrogen = PluginVariable(
    name="Remove implicit hydrogen",
    id="remove_implicit_hydrogen",
    description="Remove implicit hydrogen.",
    type=VariableTypes.BOOLEAN,
    defaultValue=False,
)

fixStructures = PluginVariable(
    name="Fix structures",
    id="fix_structures",
    description="Fix structures.",
    type=VariableTypes.BOOLEAN,
    defaultValue=True,
)

assembleConformations = PluginVariable(
    name="Assemble conformations",
    id="assemble_conformations",
    description="Assemble conformations.",
    type=VariableTypes.BOOLEAN,
    defaultValue=True,
)

# Topology fixer
dropWater = PluginVariable(
    name="Drop water",
    id="drop_water",
    description="Drop water.",
    type=VariableTypes.BOOLEAN,
    defaultValue=True,
)

repairHeavyAtoms = PluginVariable(
    name="Repair heavy atoms",
    id="repair_heavy_atoms",
    description="Repair heavy atoms.",
    type=VariableTypes.BOOLEAN,
    defaultValue=True,
)

protonationPH = PluginVariable(
    name="Protonation pH",
    id="protonation_ph",
    description="Protonation pH.",
    type=VariableTypes.FLOAT,
    defaultValue=7.0,
)

hetResiduesToDrop = PluginVariable(
    name="HET residues to drop",
    id="het_residues_to_drop",
    description="HET residues to drop.",
    type=VariableTypes.HETERORES,
)

chainIDsToDrop = PluginVariable(
    name="Chain IDs to drop",
    id="chain_ids_to_drop",
    description="Chain IDs to drop.",
    type=VariableTypes.CHAIN,
)

fixSystems = PluginVariable(
    name="Fix systems",
    id="fix_systems",
    description="Fix systems.",
    type=VariableTypes.BOOLEAN,
    defaultValue=True,
)

fixLigands = PluginVariable(
    name="Fix ligands",
    id="fix_ligands",
    description="Fix ligands.",
    type=VariableTypes.BOOLEAN,
    defaultValue=False,
)

# Docking block
rdockIterations = PluginVariable(
    name="Runs number",
    id="rdockIterations",
    description="The number of docking runs to perform per ligand.",
    type=VariableTypes.INTEGER,
    defaultValue=1,
)


# Induced fit refinement submission of job
def dockingJob(block: SlurmBlock):  # pylint: disable=missing-function-docstring
    print("Starting docking block...")

    # Get the system info
    systemDataValue = block.inputs.get("system", None)

    if systemData is None:
        raise Exception("No protein structure provided.")

    systemDataValue = os.path.basename(systemDataValue)

    # Get the ligand info
    ligandDataValue = block.inputs.get("ligand", None)

    # If the input group is set to 'file' or 'folder', get the basename of the file
    if (
        block.selectedInputGroup == "ligandFileGroup"
        or block.selectedInputGroup == "ligandFolderGroup"
    ):
        ligandDataValue = os.path.basename(ligandDataValue)

    cpus = int(block.variables.get("cpus", 2))

    if cpus < 2:
        raise Exception("CPUs must be greater than 1.")

    name = block.variables.get("simulation_name", "ifd")

    # Sanitize the name (no spaces, no special characters...)
    name = "".join([c for c in name if c.isalpha() or c.isdigit() or c == "_"]).rstrip()

    block._updateVariables({"simulation_name": name})

    cpus = int(block.variables.get("cpus", 2))

    if cpus < 2:
        raise Exception("CPUs must be greater than 1.")

    print(f"Generating NBDSuite input files for {name}")

    from Utils import GeneralInput

    generalInput = GeneralInput()
    generalInput.systemDataInput = systemDataValue
    generalInput.ligandDataInput = ligandDataValue
    generalInput.nameInput = name
    generalInput.staticNameInput = block.variables.get("static_name", False)
    generalInput.cpusInput = cpus
    generalInput.verbosityInput = block.variables.get("verbosity", "INFO")

    from Utils import TopologyExtractorInput

    topologyExtractorInput = TopologyExtractorInput()
    topologyExtractorInput.checkTopologyInput = block.variables.get("check_topology", True)
    topologyExtractorInput.explicitHInSmilesInput = block.variables.get(
        "explicit_h_in_smiles", False
    )
    topologyExtractorInput.removeImplicitHydrogenInput = block.variables.get(
        "remove_implicit_hydrogen", False
    )
    topologyExtractorInput.fixStructuresInput = block.variables.get("fix_structures", True)
    topologyExtractorInput.assembleConformationsInput = block.variables.get(
        "assemble_conformations", True
    )

    from Utils import TopologyFixerInput

    topologyFixerInput = TopologyFixerInput()
    topologyFixerInput.dropWaterInput = block.variables.get("drop_water", True)
    topologyFixerInput.repairHeavyAtomsInput = block.variables.get("repair_heavy_atoms", True)
    topologyFixerInput.protonationPHInput = block.variables.get("protonation_ph", 7.0)

    hetResiduesToDropValue = block.variables.get("het_residues_to_drop", None)
    # Extract the "auth_comp_id" value from the
    # "het_res_to_drop" input and store it in a list
    if hetResiduesToDropValue is not None:
        hetResiduesToDropValue = [residue["auth_comp_id"] for residue in hetResiduesToDropValue]
    else:
        hetResiduesToDropValue = []

    chainIDsToDropValue = block.variables.get("std_residues_to_drop", None)

    if chainIDsToDropValue is not None:
        chainIDsToDropValue = [residue["chainID"] for residue in chainIDsToDropValue]
    else:
        chainIDsToDropValue = []

    topologyFixerInput.hetResiduesToDropInput = str(hetResiduesToDropValue)
    topologyFixerInput.chainIDsToDropInput = str(chainIDsToDropValue)

    topologyFixerInput.fixSystemsInput = block.variables.get("fix_systems", True)
    topologyFixerInput.fixLigandsInput = block.variables.get("fix_ligands", False)

    from Utils import RDockDockingBlockInput

    dockingBlockInput = RDockDockingBlockInput()
    dockingBlockInput.rdock_iterations = block.variables.get("rdockIterations", 1)
    dockingCenterValue = block.inputs.get("dockingCenter", None)

    if dockingCenterValue is None:
        raise Exception("No docking center provided.")

    dockingBlockInput.docking_radius = dockingCenterValue["radius"]
    dockingBlockInput.x = dockingCenterValue["center"]["x"]  # pylint: disable=invalid-name
    dockingBlockInput.y = dockingCenterValue["center"]["y"]  # pylint: disable=invalid-name
    dockingBlockInput.z = dockingCenterValue["center"]["z"]  # pylint: disable=invalid-name

    from Utils import NBDSuiteInputMerger

    merger = NBDSuiteInputMerger(
        blocks=[
            generalInput,
            topologyExtractorInput,
            topologyFixerInput,
            dockingBlockInput,
        ]
    )

    # Generate the input YAML
    with open(f"{name}.yaml", "w", encoding="utf-8") as file:
        file.write(merger.toYaml())

    simRemoteDir = os.path.join(block.remote.workDir, name)

    # Create the simulation folder in the remote
    block.remote.remoteCommand(f"mkdir -p -v {simRemoteDir}")

    print(f"Created simulation folder in the remote at {simRemoteDir}")
    print("Sending data to the remote...")

    # Send the complex data to the remote
    block.remote.sendData(systemDataValue, os.path.join(simRemoteDir, systemDataValue))

    # Send the ligand data to the remote if the input group was not set to 'SMILES'
    if block.selectedInputGroup != "ligandSmiGroup":
        block.remote.sendData(ligandDataValue, os.path.join(simRemoteDir, ligandDataValue))

    # Send the input YAML to the remote
    block.remote.sendData(f"{name}.yaml", os.path.join(simRemoteDir, f"{name}.yaml"))

    # Save the SLURM script
    with open(f"{name}.slurm", "w", encoding="utf-8") as file:
        file.write(slurmScript(name, cpus))

    scriptPath = os.path.join(simRemoteDir, f"{name}.slurm")

    # Send the SLURM script to the remote
    block.remote.sendData(f"{name}.slurm", scriptPath)

    print("Data sent to the remote.")
    print("Running the simulation...")

    # Run the simulation
    jobID = block.remote.submitJob(scriptPath)

    print(f"Simulation running with job ID {jobID}")


def finalAction(block: SlurmBlock):  # pylint: disable=missing-function-docstring
    print("Downloading results...")
    name = block.variables.get("simulation_name", "docking")
    simRemoteDir = os.path.join(block.remote.workDir, name)
    destPath = os.path.join(os.getcwd(), name)

    print("Destination path:", destPath)

    # Transfer the results from the remote
    block.remote.getData(simRemoteDir, destPath)

    print(f"Results transfered to the local machine at: {destPath}")

    ligandPoses = os.path.join(destPath, name, "3_rdock_docking", "system_1", "results")

    print(f"Setting output of block to the ligand poses: {ligandPoses}")

    # Set the output
    block.setOutput("outputDocking", ligandPoses)

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
        rdockIterations,
        staticName,
        verbosity,
        checkTopology,
        explicitHInSmiles,
        removeImplicitHydrogen,
        fixStructures,
        assembleConformations,
        dropWater,
        repairHeavyAtoms,
        protonationPH,
        hetResiduesToDrop,
        chainIDsToDrop,
        fixSystems,
        fixLigands,
    ],
    inputGroups=[ligandSmiGroup, ligandFileGroup, ligandFolderGroup],
    outputs=[outputDocking],
)
