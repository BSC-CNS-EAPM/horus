from HorusAPI import InputBlock, PluginVariable, VariableTypes

heteroResidueVariable = PluginVariable(
    name="Hetero residue",
    id="heteroRes",
    description="Select a hetero residue",
    type=VariableTypes.HETERORES,
)

# Create the block "Hetero atom"
heteroResBlock = InputBlock(
    "Hetero residue",
    description="Select a hetero residue",
    action=None,
    variable=heteroResidueVariable,
)
