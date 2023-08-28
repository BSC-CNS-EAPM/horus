from HorusAPI import PluginVariable, PluginBlock, VariableTypes

# Input
input_yaml = PluginVariable(
    name="Input file",
    id="input_yaml",
    description="The input file for the NBD Suite.",
    type=VariableTypes.FILE,
    allowedValues=["yaml"],
)

# Variables
check_topology_variable = PluginVariable(
    name="Check topology",
    id="check_topology",
    description="Checks that residues with same name are \
    consistent among all input structures.",
    type=VariableTypes.BOOLEAN,
    defaultValue=True,
)

explicit_h_in_smiles_variable = PluginVariable(
    name="Explicit H in SMILES",
    id="explicit_h_in_smiles",
    description=" Whether the input molecule has explicit information about \
    hydrogen atoms to be considered when the molecule is built.",
    type=VariableTypes.BOOLEAN,
    defaultValue=False,
)

remove_implicit_hydrogen_variable = PluginVariable(
    name="Remove implicit hydrogen",
    id="remove_implicit_hydrogen",
    description=" It removes implicit hydrogen atoms from input structures. \
    This strategy might solve some problems with wrong geometries in input structures.\
    Implicit hydrogen atoms are selected by PDB atom name and are those that are not \
    defining any variable protonation state.",
    type=VariableTypes.BOOLEAN,
    defaultValue=False,
)

fix_structures_variable = PluginVariable(
    name="Fix structures",
    id="fix_structures",
    description="Tries to fix any problem with input structures.\
    If they have already been prepared carefully, this step can be skipped.",
    type=VariableTypes.BOOLEAN,
    defaultValue=True,
)

assemble_conformations_variable = PluginVariable(
    name="Assemble conformations",
    id="assemble_conformations",
    description="Assembles conformations for ligands and complexes.",
    type=VariableTypes.BOOLEAN,
    defaultValue=True,
)

# Outputs
output_yaml = PluginVariable(
    name="Input file",
    id="output_yaml",
    description="The input file for the NBD Suite.",
    type=VariableTypes.FILE,
    allowedValues=["yaml"],
)


def generateTopologyExtractorBlock(block: PluginBlock):
    check_topology = block.variables.get("check_topology", None)
    explicit_h_in_smiles = block.variables.get("explicit_h_in_smiles", None)
    remove_implicit_hydrogen = block.variables.get("remove_implicit_hydrogen", None)
    fix_structures = block.variables.get("fix_structures", None)
    assemble_conformations = block.variables.get("assemble_conformations", None)

    if [
        check_topology,
        explicit_h_in_smiles,
        remove_implicit_hydrogen,
        fix_structures,
        assemble_conformations,
    ].count(None) > 0:
        raise Exception("Missing variables in the Topology Extractor block.")

    inputContents = yamlContent(
        check_topology,
        explicit_h_in_smiles,
        remove_implicit_hydrogen,
        fix_structures,
        assemble_conformations,
    )

    input_yaml_recived = block.inputs.get("input_yaml", None)

    if input_yaml_recived is None:
        raise Exception("No input yaml file provided. Have you run the general block?")

    # Append to the input yaml file the topology extractor block
    with open(input_yaml_recived, "a") as f:
        f.write(inputContents)

    print("Appended the topology extractor block.")

    block.setOutput("output_yaml", input_yaml_recived)


topologyExtractorBlock = PluginBlock(
    name="Topology Extractor",
    description="Extracts the topology of the ligand and protein.",
    action=generateTopologyExtractorBlock,
    variables=[
        check_topology_variable,
        explicit_h_in_smiles_variable,
        remove_implicit_hydrogen_variable,
        fix_structures_variable,
        assemble_conformations_variable,
    ],
    inputs=[input_yaml],
    outputs=[output_yaml],
)


def yamlContent(
    check_topology,
    explicit_h_in_smiles,
    remove_implicit_hydrogen,
    fix_structures,
    assemble_conformations,
):
    return f"""
- block: topology_extractor
  options:
    check_topology: {check_topology}
    explicit_h_in_smiles: {explicit_h_in_smiles}
    remove_implicit_hydrogen: {remove_implicit_hydrogen}
    fix_structures: {fix_structures}
    assemble_conformations: {assemble_conformations}"""
