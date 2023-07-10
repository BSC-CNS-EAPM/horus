from HorusAPI import (
    Plugin,
    PluginBlock,
    PluginVariable,
    VariableTypes,
    PluginPage,
)

plugin = Plugin(id="NBDSuite")

plugin.info = {
    "name": "NBDSuite",
    "description": "The NBDSuite plugin for Horus",
    "author": "Nostrum Biodiscovery",
    "version": "0.0.1",
    "dependencies": [
        "matplotlib",
        "nbdsuite",
        "pandas",
        "numpy",
        "scipy",
        "peleffy" 
    ]
}

# Define the variables for the Input Yaml block

cpus = PluginVariable(
    id="cpus",
    name="CPUs",
    description="The number of computation cores that NBDSuite will use in the run.",
    type=VariableTypes.INTEGER,
    defaultValue=1,
)

verbosity = PluginVariable(
    id="verbosity",
    name="Verbosity",
    description=" Defines the general verbosity level for the NBD Suite run.",
    type=VariableTypes.STRING_LIST,
    defaultValue="info",
    allowedValues=["info", "debug", "warning", "error", "critical"],
)


systemData = PluginVariable(
    id="systemData",
    name="System data",
    description="Path to a System PDB file. This should only contain the protein or" \
                "biological system. Can also be a list of PDB files or a string with" \
                "an asterisk wildcard representing a file pattern.",
    type=VariableTypes.STRING,
    defaultValue="",
)

ligandData = PluginVariable(
    id="ligandData",
    name="Ligand data",
    description="Path to a Ligand PDB file. This should only contain the ligand." \
                "Can also be a list of PDB or DF files, a string with an asterisk" \
                "wildcard representing a file pattern, or a list of SMILES tags.",
    type=VariableTypes.STRING,
    defaultValue="",
)

name = PluginVariable(
    id="name",
    name="Name",
    description="Pipeline name. It will determine the name of the folder where the" \
                "output of the NBD Suite simulation will be saved.",
    type=VariableTypes.STRING,
    defaultValue="NBDSuite",
)

static_name = PluginVariable(
    id="static_name",
    name="Static name",
    description="Private attribute of the model to define whether the output folder" \
                "of the NBD Suite must be static or can be indexed to avoid" \
                "overwriting an existing folder. Its default value is set to False" \
                "if a the default name is used for Pipeline. If it has a custom" \
                "value, static_name is set to True.",
    type=VariableTypes.BOOLEAN,
    defaultValue=False,
)

# Define the action for the Input Yaml block
def createYAML(block: PluginBlock):
    print("Creating YAML file...")


# Define the Input Yaml block
createYAMLBlock = PluginBlock(
    name="NBDSuite input",
    description="Creates a NBDSuite input file.",
    action=createYAML,
    variables=[cpus, verbosity, systemData, ligandData, name, static_name],
)


topology_extractor = PluginBlock(
    name="Topology extractor",
    description="Adds a topology extractor to the pipeline.",
    action=lambda block: print("Adding topology extractor..."),
    variables=[
        PluginVariable(
            id="check_topology",
            name="Check topology",
            description="Checks that residues with same name are consistent among all" \
                        "input structures.",
            type=VariableTypes.BOOLEAN,
            defaultValue=True,
        ),
        PluginVariable(
            id="explicit_h_in_smiles",
            name="Explicit H in SMILES",
            description="Whether the input molecule has explicit information about" \
                        "hydrogen atoms to be considered when the molecule is built.",
            type=VariableTypes.BOOLEAN,
            defaultValue=False,
        ),
        PluginVariable(
            id="remove_implicit_hydrogens",
            name="Remove implicit hydrogens",
            description="It removes implicit hydrogen atoms from input structures." \
                        "This strategy might solve some problems with wrong geometries"\
                        "in input structures. Implicit hydrogen atoms are selected by" \
                        "PDB atom name and are those that are not defining any" \
                        "variable protonation state.",
            type=VariableTypes.BOOLEAN,
            defaultValue=False,
        ),
        PluginVariable(
            id="fix_structures",
            name="Fix structures",
            description="Tries to fix any problem with input structures. If they have" \
                        "already been prepared carefully, this step can be skipped.",
            type=VariableTypes.BOOLEAN,
            defaultValue=True,
        ),
    ],
)

createYAMLBlock.addSubBlock(topology_extractor)

topology_fixer = PluginBlock(
    name="Topology fixer",
    description="Adds a topology fixer to the pipeline.",
    action=lambda block: print("Adding topology fixer..."),
    variables=[
        PluginVariable(
            id="drop_water",
            name="Drop water",
            description="When set to True, water molecules will be removed from" \
                        "topologies.",
            type=VariableTypes.BOOLEAN,
            defaultValue=True,
        ),
        PluginVariable(
            id="repair_heavy_atoms",
            name="Repair heavy atoms",
            description="When set to True, an attempt to solve problems on heavy" \
                        "atoms will be performed.",
            type=VariableTypes.BOOLEAN,
            defaultValue=True,
        ),
        PluginVariable(
            id="protonation_ph",
            name="Protonation pH",
            description="pH to consider when protonating topologies.",
            type=VariableTypes.INTEGER,
            defaultValue=7,
        ),
        PluginVariable(
            id="std_residues_to_drop",
            name="Standard residues to drop",
            description="List of standard residue names to remove from topology" \
                        "models.",
            type=VariableTypes.STRING,
            defaultValue=[],
        ),
        PluginVariable(
            id="het_residues_to_drop",
            name="Hetero residues to drop",
            description="List of non standard residue names to remove from topology"\
                        "model.",
            type=VariableTypes.STRING,
            defaultValue=[],
        ),
    ]
)

createYAMLBlock.addSubBlock(topology_fixer)

# Add the Input Yaml block to the plugin
plugin.addBlock(createYAMLBlock)

# Define the PELE results page
pelePage = PluginPage(
    name="PELE results",
    description="Analyse PELE results.",
    html="pele_results.html",
)

# Add the PELE results page to the plugin
plugin.addPage(pelePage)

# Define the PELE2 results page
pelePage2 = PluginPage(
    name="PELE2 results",
    description="Analyse PELE2 results.",
    html="pele_results.html",
)

# Add the PELE2 results page to the plugin
plugin.addPage(pelePage2)