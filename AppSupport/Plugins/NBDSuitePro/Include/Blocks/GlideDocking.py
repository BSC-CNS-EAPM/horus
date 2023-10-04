"""
Glide Docking Block

https://nbdsoftware.github.io/NBDSuite/user_guide/blocks/site_docking/glide_docking.html
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

glide_method = PluginVariable(
    name="Glide method",
    id="glide_method",
    description="The docking method to be used with Glide.",
    type=VariableTypes.STRING_LIST,
    allowedValues=["confgen"],
)

glide_precision = PluginVariable(
    name="Glide precision",
    id="glide_precision",
    description="The precision to be used with Glide.",
    type=VariableTypes.STRING_LIST,
    allowedValues=["SP", "XP"],
)

docking_center = PluginVariable(
    name="Docking center",
    id="docking_center",
    description="The center and radius of the cavity where Ligands will be docked.",
    type=VariableTypes.SPHERE,
)

docking_center_asl = PluginVariable(
    name="Docking center ASL",
    id="docking_center_asl",
    description="Reference ligand ASL selection for Glide docking.",
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


def generateGlideDockingBlock(
    block: PluginBlock,
):  # pylint: disable=missing-function-docstring
    glide_method = block.variables.get("glide_method", None)
    glide_precision = block.variables.get("glide_precision", None)
    docking_center = block.inputs.get("docking_center", None)
    docking_center_asl = block.variables.get("docking_center_asl", None)

    docking_radius = docking_center["radius"]
    docking_center = docking_center["center"]
    docking_center = f'[{docking_center["x"]}, {docking_center["y"]}, {docking_center["z"]}]'

    input_yaml_recived = block.inputs.get("input_yaml", None)

    if input_yaml_recived is None:
        raise Exception("No input file provided.")

    inputContents = yamlContent(
        glide_method,
        glide_precision,
        docking_center,
        docking_radius,
        docking_center_asl,
    )

    # Append to the input yaml file the topology extractor block
    with open(input_yaml_recived, "a") as f:
        f.write(inputContents)

    print("Appended the Glide Docking block.")

    block.setOutput("output_yaml", input_yaml_recived)


glideDockingBlock = PluginBlock(
    name="Glide Docking",
    description="It docks input Ligands on the Systems and Complexes that have been supplied using Glide.",
    action=generateGlideDockingBlock,
    inputs=[input_yaml, docking_center],
    variables=[
        glide_method,
        glide_precision,
        docking_center_asl,
    ],
    outputs=[output_yaml],
)


def yamlContent(
    glide_method,
    glide_precision,
    docking_center,
    docking_radius,
    docking_center_asl,
):
    return f"""
- block: glide_docking
  options:
    glide_method: {glide_method}
    glide_precision: {glide_precision}
    docking_center: {docking_center}
    docking_radius: {docking_radius}
    docking_center_asl: {docking_center_asl}"""
