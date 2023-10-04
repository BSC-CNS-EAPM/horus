"""
Ligand Preparation with Schrodinger Block

https://nbdsoftware.github.io/NBDSuite/user_guide/blocks/structure_processing/schrodinger_ligand_preparation.html
"""

from HorusAPI import PluginVariable, PluginBlock, VariableTypes

# Input
input_yaml = PluginVariable(
    name="Input file",
    id="input_yaml",
    description="The input file for the NBD Suite.",
    type=VariableTypes.FILE,
    allowedValues=["nbdinput"],
)

# Outputs
output_yaml = PluginVariable(
    name="Input file",
    id="output_yaml",
    description="The input file for the NBD Suite.",
    type=VariableTypes.FILE,
    allowedValues=["nbdinput"],
)


def generateLigPrepBlock(
    block: PluginBlock,
):  # pylint: disable=missing-function-docstring
    input_yaml_recived = block.inputs.get("input_yaml", None)

    if input_yaml_recived is None:
        raise Exception("No input file provided.")

    inputContents = yamlContent()

    # Append to the input yaml file the topology extractor block
    with open(input_yaml_recived, "a") as f:
        f.write(inputContents)

    print("Appended the Ligand Preparation block.")

    block.setOutput("output_yaml", input_yaml_recived)


ligPrepBlock = PluginBlock(
    name="LigPrep with Schrodinger",
    description="Processes the structures from the user's input Ligands adding hydrogen atoms, bond orders and protonation states using LigPrep from Schrodinger.",
    action=generateLigPrepBlock,
    inputs=[input_yaml],
    outputs=[output_yaml],
)


def yamlContent():
    return """
- block: schrodinger_ligand_preparation"""
