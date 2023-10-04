"""
rDock Docking Block

https://nbdsoftware.github.io/NBDSuite/user_guide/blocks/site_docking/rdock_docking.html
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

docking_center = PluginVariable(
    name="Docking center",
    id="docking_center",
    description="The center and radius of the cavity where Ligands will be docked.",
    type=VariableTypes.SPHERE,
)

max_conformations_to_take = PluginVariable(
    name="Max conformations to take",
    id="max_conformations_to_take",
    description="The number of maximum number of conformations to take for each ligand that is docked with rDock.",
    type=VariableTypes.INTEGER,
    defaultValue=5,
)

rdock_iterations = PluginVariable(
    name="rDock iterations",
    id="rdock_iterations",
    description="The number of docking iterations to perform per Ligand.",
    type=VariableTypes.INTEGER,
    defaultValue=50,
)

rdock_scoring_function = PluginVariable(
    name="rDock scoring function",
    id="rdock_scoring_function",
    description="The scoring function to use with rDock.",
    type=VariableTypes.INTEGER_LIST,
    allowedValues=[3, 5],
    defaultValue=3,
)

# Outputs
output_yaml = PluginVariable(
    name="Input file",
    id="output_yaml",
    description="The input file for the NBD Suite.",
    type=VariableTypes.FILE,
    allowedValues=["nbdinput"],
)


def generaterDockDockingBlock(
    block: PluginBlock,
):  # pylint: disable=missing-function-docstring
    docking_center = block.inputs.get("docking_center", None)
    max_conformations_to_take = block.variables.get("max_conformations_to_take", None)
    rdock_iterations = block.variables.get("rdock_iterations", None)
    rdock_scoring_function = block.variables.get("rdock_scoring_function", None)

    docking_radius = docking_center["radius"]
    docking_center = docking_center["center"]
    docking_center = f'[{docking_center["x"]}, {docking_center["y"]}, {docking_center["z"]}]'

    input_yaml_recived = block.inputs.get("input_yaml", None)

    if input_yaml_recived is None:
        raise Exception("No input file provided.")

    inputContents = yamlContent(
        docking_center,
        docking_radius,
        max_conformations_to_take,
        rdock_iterations,
        rdock_scoring_function,
    )

    # Append to the input yaml file the topology extractor block
    with open(input_yaml_recived, "a") as f:
        f.write(inputContents)

    print("Appended the rDock Docking block.")

    block.setOutput("output_yaml", input_yaml_recived)


rdockDockingBlock = PluginBlock(
    name="rDock Docking",
    description="Dock ligands with rDock.",
    action=generaterDockDockingBlock,
    inputs=[input_yaml, docking_center],
    variables=[
        max_conformations_to_take,
        rdock_iterations,
        rdock_scoring_function,
    ],
    outputs=[output_yaml],
)


def yamlContent(
    docking_center,
    docking_radius,
    max_conformations_to_take,
    rdock_iterations,
    rdock_scoring_function,
):
    return f"""
- block: rdock_docking
  options:
      docking_center: {docking_center}
      docking_radius: {docking_radius}
      max_conformations_to_take: {max_conformations_to_take}
      rdock_iterations: {rdock_iterations}
      rdock_scoring_function: {rdock_scoring_function}"""
