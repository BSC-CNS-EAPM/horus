"""
Topology Selector block

https://nbdsoftware.github.io/NBDSuite/user_guide/blocks/structure_selection/topology_selector.html
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

topologies_to_enable = PluginVariable(
    name="Top. to enable",
    id="top_to_enable",
    description="The topologies to enable.",
    type=VariableTypes.LIST,
)

topologies_to_disable = PluginVariable(
    name="Top. to disable",
    id="top_to_disable",
    description="The topologies to disable.",
    type=VariableTypes.LIST,
)

selection_filter = PluginVariable(
    name="Selection filter",
    id="selection_filter",
    description="The filtering criterion to apply to select/unselect topology elements.",
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


def generateTopologySelectorBlock(
    block: PluginBlock,
):  # pylint: disable=missing-function-docstring
    top_to_enable = block.variables.get("top_to_enable", None)
    top_to_disable = block.variables.get("top_to_disable", None)
    selection_filter = block.variables.get("selection_filter", None)

    input_yaml_recived = block.inputs.get("input_yaml", None)

    if input_yaml_recived is None:
        raise Exception("No input file provided.")

    inputContents = yamlContent(top_to_enable, top_to_disable, selection_filter)

    # Append to the input yaml file the topology extractor block
    with open(input_yaml_recived, "a") as f:
        f.write(inputContents)

    print("Appended the topology selector block.")

    block.setOutput("output_yaml", input_yaml_recived)


topologySelectorBlock = PluginBlock(
    name="Topology Selector",
    description="Enables or disables topologies. Disabled topologies will be ignored by the next blocks in the pipeline.",
    action=generateTopologySelectorBlock,
    inputs=[input_yaml],
    variables=[topologies_to_enable, topologies_to_disable, selection_filter],
    outputs=[output_yaml],
)


def yamlContent(
    top_to_enable,
    top_to_disable,
    selection_filter,
):
    return f"""
- block: topology_selector
  options:
    topologies_to_enable: {top_to_enable}
    topologies_to_disable: {top_to_disable}
    selection_filter: {selection_filter}"""
