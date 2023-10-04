"""
Topology truncator block 

https://nbdsoftware.github.io/NBDSuite/user_guide/blocks/structure_processing/topology_truncator.html
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

# Variables
flexible_region_radius = PluginVariable(
    name="Flexible region radius",
    id="flexible_region_radius",
    description="The radius to define the spherical region where residues will be included and kept flexible in the model. "
    + "The center of the sphere is set to the center of mass of the Ligand. In case that frozen_region_radius is set "
    + "and flexible_region_radius is not, the later will be set to: "
    + "flexible_region_radius = frozen_region_radius - 5.0",
    type=VariableTypes.FLOAT,
    defaultValue=7.0,
)

frozen_region_radius = PluginVariable(
    name="Frozen region radius",
    id="frozen_region_radius",
    description="The radius to define the spherical region where residues will be included but kept frozen in the model. "
    + "The center of the sphere is set to the center of mass of the Ligand. In case that flexible_region_radius is set and "
    + "frozen_region_radius is not, the later will be set to: "
    + "frozen_region_radius = flexible_region_radius + 5.0",
    type=VariableTypes.FLOAT,
    defaultValue=12.0,
)

# Outputs
output_yaml = PluginVariable(
    name="Input file",
    id="output_yaml",
    description="The input file for the NBD Suite.",
    type=VariableTypes.FILE,
    allowedValues=["nbdinput"],
)


def generateTopologyTruncator(block: PluginBlock):
    flexible_region_radius = block.variables.get("flexible_region_radius", None)
    frozen_region_radius = block.variables.get("frozen_region_radius", None)

    inputContents = yamlContent(
        flexible_region_radius,
        frozen_region_radius,
    )

    input_yaml_recived = block.inputs.get("input_yaml", None)

    if input_yaml_recived is None:
        raise Exception("No input yaml file provided. Have you run the general block?")

    # Append to the input yaml file the topology extractor block
    with open(input_yaml_recived, "a") as f:
        f.write(inputContents)

    print("Appended the topology truncator block.")

    block.setOutput("output_yaml", input_yaml_recived)


topologyTruncatorBlock = PluginBlock(
    name="Topology Truncator",
    description="Given a specific protein cavity, it shrinks the structural model by excluding the most distant residues and freezing those that are between the excluded region and the region of interest.",
    action=generateTopologyTruncator,
    variables=[
        flexible_region_radius,
        frozen_region_radius,
    ],
    inputs=[input_yaml],
    outputs=[output_yaml],
)


def yamlContent(
    flexible_region_radius,
    frozen_region_radius,
):
    return f"""
- block: topology_truncator
    options:
        flexible_region_radius: {flexible_region_radius}
        frozen_region_radius: {frozen_region_radius}"""
