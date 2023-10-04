"""
Topology Retriever block

https://nbdsoftware.github.io/NBDSuite/user_guide/blocks/structure_selection/topology_retriever.html
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

restore_original_names = PluginVariable(
    name="Rest. orig. names",
    id="restore_original_names",
    description="When set to True, topologies will be renamed back to their original name.",
    type=VariableTypes.BOOLEAN,
)

group_by_enabled_disabled = PluginVariable(
    name="Group by enabled/disabled",
    id="group_by_enabled_disabled",
    description="When set to True, topologies will be grouped according to whether they have been enabled or disabled by previous.",
    type=VariableTypes.BOOLEAN,
)

group_by_toplogy = PluginVariable(
    name="Group by topology",
    id="selection_filter",
    description="When set to True, conformations will be grouped according to the topology they belong to.",
    type=VariableTypes.BOOLEAN,
)

# Outputs
output_yaml = PluginVariable(
    name="Input file",
    id="output_yaml",
    description="The input file for the NBD Suite.",
    type=VariableTypes.FILE,
    allowedValues=["nbdinput"],
)


def generateTopologyRetrieverBlock(
    block: PluginBlock,
):  # pylint: disable=missing-function-docstring
    restore_original_names = block.variables.get("restore_original_names", None)
    group_by_enabled_disabled = block.variables.get("group_by_enabled_disabled", None)
    group_by_toplogy = block.variables.get("group_by_toplogy", None)

    input_yaml_recived = block.inputs.get("input_yaml", None)

    if input_yaml_recived is None:
        raise Exception("No input file provided.")

    inputContents = yamlContent(
        restore_original_names, group_by_enabled_disabled, group_by_toplogy
    )

    # Append to the input yaml file the topology extractor block
    with open(input_yaml_recived, "a") as f:
        f.write(inputContents)

    print("Appended the topology retriever block.")

    block.setOutput("output_yaml", input_yaml_recived)


topologyRetrieverBlock = PluginBlock(
    name="Topology Retriever",
    description="Retrieves current topologies found in the pipeline.",
    action=generateTopologyRetrieverBlock,
    inputs=[input_yaml],
    variables=[restore_original_names, group_by_enabled_disabled, group_by_toplogy],
    outputs=[output_yaml],
)


def yamlContent(
    restore_original_names,
    group_by_enabled_disabled,
    group_by_toplogy,
):
    return f"""
- block: topology_retriever
  options:
    restore_original_names: {restore_original_names}
    group_by_enabled_disabled: {group_by_enabled_disabled}
    group_by_topology: {group_by_toplogy}"""
