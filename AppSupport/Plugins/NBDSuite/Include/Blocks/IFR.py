"""
Module containing the IFR block for the NBDSuite plugin
"""

import os
from Utils import slurmScript
from HorusAPI import PluginVariable, SlurmBlock, VariableTypes, Extensions, VariableGroup

# ==========================#
# Variable inputs
# ==========================#

complexDataStruc = PluginVariable(
    name="Complex struc.",
    id="complexData",
    description="The PDB file path with the ligand docked.",
    type=VariableTypes.STRUCTURE,
)

compelxDataFile = PluginVariable(
    name="Complex file",
    id="complexData",
    description="The PDB file path with the ligand docked.",
    type=VariableTypes.FILE,
    allowedValues=["pdb"],
)

complexDataFolder = PluginVariable(
    name="Complex folder",
    id="complexData",
    description="The folder containing the PDB file with the ligand docked.",
    type=VariableTypes.FOLDER,
)

ligandSelectionHeteroRes = PluginVariable(
    name="Ligand residue",
    id="ligand_selection",
    description="The ligand selection hetero residue.",
    type=VariableTypes.HETERORES,
)

ligandSelectionString = PluginVariable(
    name="Ligand selection",
    id="ligand_selection",
    description="The ligand selection string.",
    type=VariableTypes.STRING,
)

# ==========================#
# Input groups
# ==========================#

complexDataStructureGroup = VariableGroup(
    id="complexDataStructure",
    name="Complex data",
    description="The complex data.",
    variables=[complexDataStruc, ligandSelectionHeteroRes],
)

complexDataFileGroup = VariableGroup(
    id="complexDataFile",
    name="Complex data",
    description="The complex data.",
    variables=[compelxDataFile, ligandSelectionString],
)

complexDataFolderGroup = VariableGroup(
    id="complexDataFolder",
    name="Complex data",
    description="The complex data.",
    variables=[complexDataFolder, ligandSelectionString],
)

# ==========================#
# Other variables
# ==========================#
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

peleFFIFR = PluginVariable(
    name="PELE force field",
    id="pele_force_field",
    description="PELE force field.",
    type=VariableTypes.STRING_LIST,
    defaultValue="openff-2.0.0",
    allowedValues=["openff-2.0.0", "openff-1.3.0", "OPLS2005"],
)

peleSolventIFR = PluginVariable(
    name="PELE solvent",
    id="pele_solvent",
    description="PELE solvent.",
    defaultValue="OBC",
    type=VariableTypes.STRING_LIST,
    allowedValues=["OBC", "VDGBNP"],
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


outputIFR = PluginVariable(
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

# Induced fit refinement
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


# Induced fit refinement submission of job
def inducedFitRefinement(block: SlurmBlock):  # pylint: disable=missing-function-docstring
    complexDataValue = block.inputs.get("complexData", None)

    if complexDataValue is None:
        raise Exception("No complex data provided.")

    complexDataValue = os.path.basename(complexDataValue)

    ligandSelection = block.inputs.get("ligand_selection", None)

    if ligandSelection is None:
        raise Exception("No ligand selection provided.")

    isComplex = False
    if block.selectedInputGroup == "complexDataStructure":
        # Parse the ligand selection
        chainID = ligandSelection[0]["chainID"]
        residue = ligandSelection[0]["residue"]
        ligandSelection = f"{chainID}:{residue}"
        isComplex = True

    if block.selectedInputGroup == "complexDataFile":
        isComplex = True

    cpus = int(block.variables.get("cpus", 2))
    if cpus < 2:
        raise Exception("CPUs must be greater than 1.")

    name = block.variables.get("simulation_name", "ifr")
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
    generalInput.isComplex = isComplex
    generalInput.systemDataInput = complexDataValue
    generalInput.ligandDataInput = ligandSelection
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

    from Utils import FlowInducedFitRefinementInput

    flowInducedFitRefinementInput = FlowInducedFitRefinementInput()
    flowInducedFitRefinementInput.forceFieldInput = forceField
    flowInducedFitRefinementInput.peleSolventInput = block.variables.get("pele_solvent", "OBC")
    flowInducedFitRefinementInput.stepsInput = steps
    flowInducedFitRefinementInput.epochsInput = epochs
    flowInducedFitRefinementInput.flexibleRegionRadiusInput = flexibleRegionRadius
    flowInducedFitRefinementInput.frozenRegionRadiusInput = frozenRegionRadius

    from Utils import NBDSuiteInputMerger

    merger = NBDSuiteInputMerger(
        blocks=[
            generalInput,
            topologyExtractorInput,
            topologyFixerInput,
            flowInducedFitRefinementInput,
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
    block.remote.sendData(complexDataValue, os.path.join(simRemoteDir, complexDataValue))

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

    # # Get the job ID
    # jobID = out.split(" ")[-1].strip()

    print(f"Simulation running with job ID {jobID}")

    # Get the results
    block.setOutput("path", simRemoteDir)


def finalAction(block: SlurmBlock):  # pylint: disable=missing-function-docstring
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
    if block.variables.get("openResultsOnFinish", True):
        Extensions().open("nbdsuite", "peleresults", {"path": resultPath})


# Define the block
inducedFitRefinementBlock = SlurmBlock(
    name="Induced fit refinement",
    description="Perform an induced fit refinement simulation over an already docked complex.",
    initialAction=inducedFitRefinement,
    finalAction=finalAction,
    variables=[
        openResultsOnFinish,
        nameIFR,
        cpusIFR,
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
        peleFFIFR,
        peleSolventIFR,
        peleStepsIFR,
        epochsIFR,
        flexibleRegionRadiusIFR,
        frozenRegionRadiusIFR,
        sideChainPredictionResolution,
        ligandResolution,
    ],
    inputGroups=[
        complexDataStructureGroup,
        complexDataFileGroup,
        complexDataFolderGroup,
    ],
    outputs=[outputIFR],
)
