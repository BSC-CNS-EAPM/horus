from HorusAPI import InputBlock, PluginVariable, VariableTypes

boxVariable = PluginVariable(
    name="Box",
    id="box",
    description="Select coordinates and size of a box",
    type=VariableTypes.BOX,
)

# Create the block "Hetero atom"
boxBlock = InputBlock(
    name="Box",
    id="box",
    description="Select coordinates and size of a box in a structure",
    action=None,
    variable=boxVariable,
    category="Structures"
)
