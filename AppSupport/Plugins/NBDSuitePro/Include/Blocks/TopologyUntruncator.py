"""
Topology untruncator block 

https://nbdsoftware.github.io/NBDSuite/user_guide/blocks/structure_processing/topology_untruncator.html
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


def generateTopologyUntruncator(block: PluginBlock):
    inputContents = yamlContent()

    input_yaml_recived = block.inputs.get("input_yaml", None)

    if input_yaml_recived is None:
        raise Exception("No input yaml file provided. Have you run the general block?")

    # Append to the input yaml file the topology extractor block
    with open(input_yaml_recived, "a") as f:
        f.write(inputContents)

    print("Appended the topology untruncator block.")

    block.setOutput("output_yaml", input_yaml_recived)


topologyUntruncatorBlock = PluginBlock(
    name="Topology Untruncator",
    description="When the block topology_truncator was previously defined in the pipeline to optimize resources during a specific block, the topology_untruncator block includes the truncated residues keeping the changes applied on the flexible residues during the protocol specified.",
    action=generateTopologyUntruncator,
    inputs=[input_yaml],
    outputs=[output_yaml],
)


def yamlContent():
    return f"""
- block: topology_untruncator"""
