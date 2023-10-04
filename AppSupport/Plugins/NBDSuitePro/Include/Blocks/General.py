from HorusAPI import PluginVariable, PluginBlock, VariableTypes, VariableGroup
import os
import random

# Inputs
complex_data_input = PluginVariable(
    name="Complex data",
    id="complex_data",
    description="Path to a Complex PDB file. This should contain \
    both the System and the Ligand.",
    type=VariableTypes.STRUCTURE,
)

complex_ligand_selection_input = PluginVariable(
    name="Ligand selection",
    id="complex_ligand_selection",
    description="The selection of the Ligand inside the Complex structure. \
    Must be of the form (X:Y), where X is the chain name and Y is the \
    residue. This parameter must also be specified if complex_data is specified.",
    type=VariableTypes.HETERORES,
)

system_data_input = PluginVariable(
    name="System data",
    id="system_data",
    description="Path to a System PDB file. This should contain \
    only the System.",
    type=VariableTypes.STRUCTURE,
)

ligand_data_input_file = PluginVariable(
    name="Ligand data file",
    id="ligand_data",
    description="Path to a Ligand PDB file. This should contain \
    only the Ligand.",
    type=VariableTypes.FILE,
    allowedValues=["pdb", "sdf", "smi", "smiles"],
)

ligand_data_structure = PluginVariable(
    name="Ligand data",
    id="ligand_data",
    description="The Ligand structure.",
    type=VariableTypes.STRUCTURE,
)

sequence_data_input = PluginVariable(
    name="Sequence data",
    id="sequence_data",
    description="Path to a Sequence .fasta file.",
    type=VariableTypes.FILE,
    allowedValues=["fasta", "FASTA"],
)

# Define the different input groups
ligandFileInput = VariableGroup(
    id="ligandFileInput",
    variables=[
        system_data_input,
        ligand_data_input_file,
    ],
)

ligandSelectionInput = VariableGroup(
    id="ligandSelectionInput",
    variables=[
        complex_data_input,
        complex_ligand_selection_input,
    ],
)

ligandStructureInput = VariableGroup(
    id="ligandStructureInput",
    variables=[
        system_data_input,
        ligand_data_structure,
    ],
)

sequenceInput = VariableGroup(
    id="sequenceInput",
    variables=[
        sequence_data_input,
    ],
)

# Variables
cpus_variable = PluginVariable(
    name="CPUs",
    id="cpus",
    description="Number of CPUs to use.",
    type=VariableTypes.INTEGER,
    defaultValue=4,
)

verbosity_variable = PluginVariable(
    name="Verbosity",
    id="verbosity",
    description="Verbosity level.",
    type=VariableTypes.STRING_LIST,
    defaultValue="info",
    allowedValues=["info", "debug", "warning", "error", "critical"],
)

working_directory_variable = PluginVariable(
    name="Working directory",
    id="working_directory",
    description="The working directory.",
    type=VariableTypes.STRING,
    defaultValue=".",
)

name_variable = PluginVariable(
    name="Simulation name",
    id="simulation_name",
    description="Name of the simulation.",
    type=VariableTypes.STRING,
    defaultValue="NBDSuiteInput",
)

static_name_variable = PluginVariable(
    name="Static name",
    id="static_name",
    description="Private attribute of the model to define whether the output folder \
    of the NBD Suite must be static or can be indexed to avoid overwriting an \
    existing folder.",
    type=VariableTypes.BOOLEAN,
    defaultValue=False,
)

seed_variable = PluginVariable(
    name="Seed",
    id="seed",
    description="Seed for NBD Suite's pseudo-random numbers generator for \
    reproducibility. When no seed is set, it will be initialized to a random number",
    type=VariableTypes.INTEGER,
    defaultValue=random.randint(0, 100000),
)

restart_variable = PluginVariable(
    name="Restart",
    id="restart",
    description="Whether to restart the simulation from a previous run.",
    type=VariableTypes.BOOLEAN,
    defaultValue=False,
)

# PELE Specific variables
pele_force_field = PluginVariable(
    name="PELE Forcefield",
    id="force_field",
    description="Forcefield to employ in the parameterization of non-standard residues.",
    type=VariableTypes.STRING_LIST,
    defaultValue="OPLS2005",
    allowedValues=["openff-2.0.0", "OPLS2005"],
)

pele_solvent = PluginVariable(
    name="PELE Solvent",
    id="solvent",
    description="Solvent to employ in the parameterization of non-standard residues.",
    type=VariableTypes.STRING_LIST,
    defaultValue="OBC",
    allowedValues=["OBC", "VDGBNP"],
)

pele_ligand_resolution = PluginVariable(
    name="PELE Ligand Resolution",
    id="ligand_resolution",
    description=" Defines the resolution in degrees to consider when sampling the different rotatable bonds of the Ligand during a PELE simulation.",
    type=VariableTypes.INTEGER,
    defaultValue=30,
)

# Outputs
output_yaml = PluginVariable(
    name="Input file",
    id="output_yaml",
    description="The input file for the NBD Suite.",
    type=VariableTypes.FILE,
    allowedValues=["nbdinput"],
)


def generateGeneralBlock(block: PluginBlock):
    cpus = block.variables.get("cpus", None)
    verbosity = block.variables.get("verbosity", None)
    working_directory = block.variables.get("working_directory", None)
    name = block.variables.get("simulation_name", None)
    static_name = block.variables.get("static_name", None)
    seed = block.variables.get("seed", None)

    pele_force_field = block.variables.get("force_field", None)
    pele_solvent = block.variables.get("solvent", None)
    pele_ligand_resolution = block.variables.get("ligand_resolution", None)

    if seed == "":
        seed = None

    restart = block.variables.get("restart", None)

    missing_variables = [
        var_name
        for var_name, var_value in locals().items()
        if var_value is None
        and var_name
        in ["cpus", "verbosity", "working_directory", "name", "static_name", "restart"]
    ]
    if missing_variables:
        raise Exception(f"Missing variables in the General block: {', '.join(missing_variables)}")

    inputContents = None
    if block.selectedInputGroup != "sequenceInput":
        system_data = block.inputs.get("system_data", None)
        ligand_data = block.inputs.get("ligand_data", None)
        # complex_data = block.inputs.get("complex_data", None)
        complex_ligand_selection = block.inputs.get("complex_ligand_selection", None)

        if system_data is None:
            raise Exception("No system data provided.")

        if ligand_data is None and complex_ligand_selection is None:
            raise Exception("No ligand data provided.")

        if ligand_data is not None and complex_ligand_selection is not None:
            raise Exception("Both ligand data and complex ligand selection provided.")

        if ligand_data is not None:
            inputContents = inputYAML(
                system_data,
                ligand_data,
                working_directory,
                name,
                static_name,
                cpus,
                verbosity,
                restart,
                seed,
                pele_force_field,
                pele_solvent,
                pele_ligand_resolution,
            )

        if complex_ligand_selection is not None:
            # From the complex_ligand_selection get the selection values
            complex_ligand_selection = complex_ligand_selection[0]
            chainID = complex_ligand_selection["chainID"]
            residue = complex_ligand_selection["residue"]
            complex_ligand_selection = f"{chainID}:{residue}"

            inputContents = complexInputYAML(
                system_data,
                complex_ligand_selection,
                working_directory,
                name,
                static_name,
                cpus,
                verbosity,
                restart,
                seed,
                pele_force_field,
                pele_solvent,
                pele_ligand_resolution,
            )
    else:
        sequence_data = block.inputs.get("sequence_data", None)

        if sequence_data is None:
            raise Exception("No sequence data provided.")

        inputContents = sequenceInputYAML(
            sequence_data,
            working_directory,
            name,
            static_name,
            cpus,
            verbosity,
            restart,
            seed,
            pele_force_field,
            pele_solvent,
            pele_ligand_resolution,
        )

    if inputContents is None:
        raise Exception("No input contents generated.")

    # Write the yaml
    # if os.path.exists(f"{name}.yaml"):
    #     qty = 1
    #     while os.path.exists(f"{name}_{qty}.yaml"):
    #         qty += 1
    #     name = f"{name}_{qty}"

    with open(f"{name}.yaml", "w") as f:
        f.write(inputContents)

    print("Generated the input yaml file.")

    # Set the output to the yaml file
    block.setOutput("output_yaml", f"{name}.yaml")


generalBlock = PluginBlock(
    name="General",
    description="General settings for the NBDSuite input.",
    action=generateGeneralBlock,
    variables=[
        cpus_variable,
        verbosity_variable,
        working_directory_variable,
        name_variable,
        restart_variable,
        static_name_variable,
        seed_variable,
        pele_force_field,
        pele_solvent,
        pele_ligand_resolution,
    ],
    inputGroups=[
        ligandFileInput,
        ligandSelectionInput,
        ligandStructureInput,
        sequenceInput,
    ],
    outputs=[output_yaml],
)


def inputYAML(
    system_data,
    ligand_data,
    working_directory,
    name,
    static_name,
    cpus,
    verbosity,
    restart,
    seed,
    pele_forcefield,
    pele_solvent,
    pele_ligand_resolution,
):
    return f"""system_data: {system_data}
ligand_data: {ligand_data}
working_directory: {working_directory}
name: {name}
static_name: {static_name}
cpus: {cpus}
verbosity: {verbosity}
restart: {restart}
seed: {seed}
pele_forcefield: {pele_forcefield}
pele_solvent: {pele_solvent}
pele_ligand_resolution: {pele_ligand_resolution}
pipeline:"""


def complexInputYAML(
    system_data,
    ligand_data,
    working_directory,
    name,
    static_name,
    cpus,
    verbosity,
    restart,
    seed,
    pele_forcefield,
    pele_solvent,
    pele_ligand_resolution,
):
    return f"""complex_data: {system_data}
complex_ligand_selection: {ligand_data}
working_directory: {working_directory}
name: {name}
static_name: {static_name}
cpus: {cpus}
verbosity: {verbosity}
restart: {restart}
seed: {seed}
pele_forcefield: {pele_forcefield}
pele_solvent: {pele_solvent}
pele_ligand_resolution: {pele_ligand_resolution}
pipeline:"""


def sequenceInputYAML(
    sequence_data,
    working_directory,
    name,
    static_name,
    cpus,
    verbosity,
    restart,
    seed,
    pele_forcefield,
    pele_solvent,
    pele_ligand_resolution,
):
    return f"""sequence_data: {sequence_data}
working_directory: {working_directory}
name: {name}
static_name: {static_name}
cpus: {cpus}
verbosity: {verbosity}
restart: {restart}
seed: {seed}
pele_forcefield: {pele_forcefield}
pele_solvent: {pele_solvent}
pele_ligand_resolution: {pele_ligand_resolution}
pipeline:"""
