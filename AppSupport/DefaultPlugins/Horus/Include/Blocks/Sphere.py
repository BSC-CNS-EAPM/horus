from HorusAPI import InputBlock, PluginVariable, VariableTypes

sphereVariable = PluginVariable(
    name="Sphere",
    id="sphere",
    description="Select coordinates and radius of a sphere",
    type=VariableTypes.SPHERE,
)

# Create the block "Hetero atom"
sphereBlock = InputBlock(
    "Sphere coordinates",
    description="Select coordinates and radius of a sphere in a structure",
    action=None,
    variable=sphereVariable,
)
