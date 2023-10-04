"""
Alphafold Structure Prediction Block

https://nbdsoftware.github.io/NBDSuite/user_guide/blocks/structure_prediction/structure_prediction.html
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

alphafold_model_preset = PluginVariable(
    name="AlphaFold model preset",
    id="alphafold_model_preset",
    description="Model preset for AlphaFold prediction.",
    type=VariableTypes.STRING_LIST,
    allowedValues=["monomer", "multimer"],
)

alphafold_max_template_date = PluginVariable(
    name="AlphaFold max template date",
    id="alphafold_max_template_date",
    description="Maximum template date for AlphaFold prediction must be in format YYYY-MM-DD.",
    type=VariableTypes.STRING,
)

# Outputs
output_yaml = PluginVariable(
    name="Input file",
    id="output_yaml",
    description="The input file for the NBD Suite.",
    type=VariableTypes.FILE,
    allowedValues=["nbdinput"],
)


def generateAlphafoldBlock(
    block: PluginBlock,
):  # pylint: disable=missing-function-docstring
    alphafold_model_preset = block.variables.get("alphafold_model_preset", None)
    alphafold_max_template_date = block.variables.get("alphafold_max_template_date", None)

    input_yaml_recived = block.inputs.get("input_yaml", None)

    if input_yaml_recived is None:
        raise Exception("No input file provided.")

    inputContents = yamlContent(alphafold_model_preset, alphafold_max_template_date)

    # Append to the input yaml file the topology extractor block
    with open(input_yaml_recived, "a") as f:
        f.write(inputContents)

    print("Appended the AlphaFold block.")

    block.setOutput("output_yaml", input_yaml_recived)


alphafoldBlock = PluginBlock(
    name="AlphaFold prediction",
    description="The Structure Prediction Block enables the user to predict the 3D structure of a protein using an input Sequence in FASTA format using AlphaFold.",
    action=generateAlphafoldBlock,
    inputs=[input_yaml],
    variables=[alphafold_model_preset, alphafold_max_template_date],
    outputs=[output_yaml],
)


def yamlContent(
    alphafold_model_preset,
    alphafold_max_template_date,
):
    return f"""
- block: alphafold_structure_generator
  options:
    alphafold_model_preset: {alphafold_model_preset}
    alphafold_max_template_date: {alphafold_max_template_date}"""
