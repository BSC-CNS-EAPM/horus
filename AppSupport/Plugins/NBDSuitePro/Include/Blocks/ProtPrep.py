"""
Protein Preparation with Schrodinger Block

https://nbdsoftware.github.io/NBDSuite/user_guide/blocks/structure_processing/schrodinger_protein_preparation.html
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


def generateProtPrepBlock(
    block: PluginBlock,
):  # pylint: disable=missing-function-docstring
    input_yaml_recived = block.inputs.get("input_yaml", None)

    if input_yaml_recived is None:
        raise Exception("No input file provided.")

    inputContents = yamlContent()

    # Append to the input yaml file the protein prep block
    with open(input_yaml_recived, "a") as f:
        f.write(inputContents)

    print("Appended the Protein Preparation block.")

    block.setOutput("output_yaml", input_yaml_recived)


protPrepBlock = PluginBlock(
    name="ProtPrep with Schrodinger",
    description="Processes the structures from the user's input Systems and Complexes adding hydrogen atoms, fixing standard residues and heavy atoms and removing waters.",
    action=generateProtPrepBlock,
    inputs=[input_yaml],
    outputs=[output_yaml],
)


def yamlContent():
    return """
- block: schrodinger_protein_preparation"""
