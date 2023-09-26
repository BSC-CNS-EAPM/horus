"""
Module containing the IFD block for the NBDSuite plugin
"""

import os
from Utils import slurmScript
from HorusAPI import PluginVariable, SlurmBlock, VariableTypes, Extensions, VariableGroup

# ==========================#
# Variable inputs
# ==========================#
systemData = PluginVariable(
    name="Protein",
    id="protein",
    description="The protein structure to dock the ligands into.",
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
    variables=[systemData, ligandSmiles, dockingCenter],
)

ligandFileGroup = VariableGroup(
    id="ligandFileGroup",
    variables=[systemData, ligandFile, dockingCenter],
)

ligandFolderGroup = VariableGroup(
    id="ligandFolderGroup",
    variables=[systemData, ligandFolder, dockingCenter],
)

# ==========================#
# Other variables
# ==========================#
cpusIFD = PluginVariable(
    name="CPUs",
    id="cpus",
    description="Number of CPUs to use.",
    type=VariableTypes.INTEGER,
    defaultValue=4,
)

nameIFD = PluginVariable(
    name="Simulation name",
    id="simulation_name",
    description="Name of the simulation.",
    type=VariableTypes.STRING,
    defaultValue="ifd",
)

flexibleRegionRadiusIFD = PluginVariable(
    name="Flexible region radius",
    id="flexible_region_radius",
    description="Radius of the flexible region.",
    type=VariableTypes.FLOAT,
    defaultValue=10.0,
)

frozenRegionRadiusIFD = PluginVariable(
    name="Frozen region radius",
    id="frozen_region_radius",
    description="Radius of the frozen region.",
    type=VariableTypes.FLOAT,
    defaultValue=15.0,
)

peleFFIFD = PluginVariable(
    name="PELE force field",
    id="pele_force_field",
    description="PELE force field.",
    type=VariableTypes.STRING_LIST,
    defaultValue="openff-2.0.0",
    allowedValues=["openff-2.0.0", "openff-1.3.0", "OPLS2005"],
)

peleStepsIFD = PluginVariable(
    name="PELE steps",
    id="pele_steps",
    description="PELE steps.",
    type=VariableTypes.INTEGER,
    defaultValue=5,
)

epochsIFD = PluginVariable(
    name="Epochs",
    id="epochs",
    description="PELE epochs.",
    type=VariableTypes.INTEGER,
    defaultValue=1,
)

openResultsOnFinish = PluginVariable(
    name="Open results on finish",
    id="openResultsOnFinish",
    description="Open the results extension automatically on finish.",
    type=VariableTypes.BOOLEAN,
    defaultValue=True,
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

# Induced fit docking
rdockIterations = PluginVariable(
    name="RDock iterations",
    id="rdock_iterations",
    description="RDock iterations.",
    type=VariableTypes.INTEGER,
    defaultValue=50,
)

sideChainPredictionResolution = PluginVariable(
    name="Side chain prediction resolution",
    id="pele_side_chain_prediction_resolution",
    description="Side chain prediction resolution.",
    type=VariableTypes.INTEGER,
    defaultValue=40,
)

ligandResolution = PluginVariable(
    name="Ligand resolution",
    id="pele_ligand_resolution",
    description="Ligand resolution.",
    type=VariableTypes.INTEGER,
    defaultValue=40,
)


# Block's initial action
def initialInducedFitDocking(block: SlurmBlock):  # pylint: disable=missing-function-docstring
    systemDataValue = block.inputs.get("protein", None)

    if systemData is None:
        raise Exception("No protein structure provided for IFD.")

    systemDataFilename = os.path.basename(systemDataValue)

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
    flexibleRegionRadius = block.variables.get("flexible_region_radius", 10.0)
    frozenRegionRadius = block.variables.get("frozen_region_radius", 15.0)
    forceField = block.variables.get("pele_force_field", "OPLS2005")
    steps = block.variables.get("pele_steps", 5)
    epochs = block.variables.get("epochs", 1)

    if isinstance(forceField, list):
        forceField = forceField[0]

    print("Generating NBDSuite input files...")

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

    hetResiduesToDropValue = block.inputs.get("het_residues_to_drop", None)
    # Extract the "auth_comp_id" value from the
    # "het_res_to_drop" input and store it in a list
    if hetResiduesToDropValue is not None:
        hetResiduesToDropValue = [residue["auth_comp_id"] for residue in hetResiduesToDropValue]
    else:
        hetResiduesToDropValue = []

    chainIDsToDropValue = block.inputs.get("std_residues_to_drop", None)

    if chainIDsToDropValue is not None:
        chainIDsToDropValue = [residue["chainID"] for residue in chainIDsToDropValue]
    else:
        chainIDsToDropValue = []

    topologyFixerInput.hetResiduesToDropInput = str(hetResiduesToDropValue)
    topologyFixerInput.chainIDsToDropInput = str(chainIDsToDropValue)

    topologyFixerInput.fixSystemsInput = block.variables.get("fix_systems", True)
    topologyFixerInput.fixLigandsInput = block.variables.get("fix_ligands", False)

    dockingCenterValue = block.inputs.get("dockingCenter", None)
    radius = dockingCenterValue["radius"]
    x = dockingCenterValue["center"]["x"]  # pylint: disable=invalid-name
    y = dockingCenterValue["center"]["y"]  # pylint: disable=invalid-name
    z = dockingCenterValue["center"]["z"]  # pylint: disable=invalid-name

    from Utils import FlowInducedFitDockingInput

    inducedFitDockingInput = FlowInducedFitDockingInput()
    inducedFitDockingInput.dockingCenterInput = f"[{x}, {y}, {z}]"
    inducedFitDockingInput.dockingRadiusInput = radius

    inducedFitDockingInput.ligandResolutionInput = block.variables.get(
        "pele_ligand_resolution", 40
    )
    inducedFitDockingInput.sideChainPredictionResolutionInput = block.variables.get(
        "pele_side_chain_prediction_resolution", 40
    )

    inducedFitDockingInput.forceFieldInput = forceField
    inducedFitDockingInput.stepsInput = steps
    inducedFitDockingInput.epochsInput = epochs
    inducedFitDockingInput.flexibleRegionRadiusIFDInput = flexibleRegionRadius
    inducedFitDockingInput.frozenRegionRadiusIFDInput = frozenRegionRadius
    inducedFitDockingInput.rdockIterationsInput = block.variables.get("rdock_iterations", 50)

    from Utils import NBDSuiteInputMerger

    merger = NBDSuiteInputMerger(
        blocks=[
            generalInput,
            topologyExtractorInput,
            topologyFixerInput,
            inducedFitDockingInput,
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
    # Send the system data to the remote
    block.remote.sendData(systemDataValue, os.path.join(simRemoteDir, systemDataFilename))

    # Send the ligand data to the remote
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

    print(f"Simulation running with job ID {jobID}. Waiting for it to finish...")


# Block's final action
def finalAction(block: SlurmBlock):  # pylint: disable=missing-function-docstring
    name = block.variables.get("simulation_name", "ifd")
    simRemoteDir = os.path.join(block.remote.workDir, name)

    print("IFD calculation finished, downloading results...")

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
    if block.variables.get("openResultsOnFinish", True):
        Extensions().open("nbdsuite", "peleresults", {"path": resultPath})


# Define the block
inducedFitDockingBlock = SlurmBlock(
    name="Induced fit docking",
    description="Perform an induced fit docking simulation",
    initialAction=initialInducedFitDocking,
    finalAction=finalAction,
    variables=[
        openResultsOnFinish,
        nameIFD,
        cpusIFD,
        verbosity,
        staticName,
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
        peleFFIFD,
        peleStepsIFD,
        epochsIFD,
        flexibleRegionRadiusIFD,
        frozenRegionRadiusIFD,
        rdockIterations,
        sideChainPredictionResolution,
        ligandResolution,
    ],
    inputGroups=[ligandSmiGroup, ligandFileGroup, ligandFolderGroup],
    outputs=[outputIFD],
)
