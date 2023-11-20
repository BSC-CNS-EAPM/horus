from HorusAPI import InputBlock, PluginVariable, VariableTypes

heteroResidueVariable = PluginVariable(
    name="Hetero residue",
    id="heteroRes",
    description="Select an hetero residue",
    type=VariableTypes.HETERORES,
)

# Create the block "Hetero atom"
heteroResBlock = InputBlock(
    "Hetero residue",
    description="Select an hetero residue",
    action=None,
    variable=heteroResidueVariable,
)
