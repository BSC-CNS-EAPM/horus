"""
Conformation Selector block

https://nbdsoftware.github.io/NBDSuite/user_guide/blocks/structure_selection/conformation_selector.html
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

conformations_to_enable = PluginVariable(
    name="Conformations to enable",
    id="conformations_to_enable",
    description="The conformations to enable.",
    type=VariableTypes.LIST,
)

conformations_to_disable = PluginVariable(
    name="Conformations to disable",
    id="conformations_to_disable",
    description="The conformations to disable.",
    type=VariableTypes.LIST,
)

selection_filter = PluginVariable(
    name="Selection filter",
    id="selection_filter",
    description="The filtering criterion to apply to select/unselect topology elements.",
    type=VariableTypes.LIST,
)

# Outputs
output_yaml = PluginVariable(
    name="Input file",
    id="output_yaml",
    description="The input file for the NBD Suite.",
    type=VariableTypes.FILE,
    allowedValues=["nbdinput"],
)


def generateConformationSelectorBlock(
    block: PluginBlock,
):  # pylint: disable=missing-function-docstring
    conformations_to_enable = block.variables.get("conformations_to_enable", None)
    conformations_to_disable = block.variables.get("conformations_to_disable", None)
    selection_filter = block.variables.get("selection_filter", None)

    input_yaml_recived = block.inputs.get("input_yaml", None)

    if input_yaml_recived is None:
        raise Exception("No input file provided.")

    inputContents = yamlContent(
        conformations_to_enable, conformations_to_disable, selection_filter
    )

    # Append to the input yaml file the topology extractor block
    with open(input_yaml_recived, "a") as f:
        f.write(inputContents)

    print("Appended the confromation selector block.")

    block.setOutput("output_yaml", input_yaml_recived)


conformationSelectorBlock = PluginBlock(
    name="Conformation Selector",
    description="Enables and disables specific Protein, Complex and Ligand conformations.",
    action=generateConformationSelectorBlock,
    inputs=[input_yaml],
    variables=[conformations_to_enable, conformations_to_disable, selection_filter],
    outputs=[output_yaml],
)


def yamlContent(
    conformations_to_enable,
    conformations_to_disable,
    selection_filter,
):
    return f"""
- block: topology_retriever
  options:
    conformations_to_enable: {conformations_to_enable}
    conformations_to_disable: {conformations_to_disable}
    selection_filter: {selection_filter}"""
