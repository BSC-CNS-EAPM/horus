from HorusAPI import InputBlock, PluginVariable, VariableTypes

residueVariable = PluginVariable(
    name="Residue",
    id="residue",
    description="Select any residue",
    type=VariableTypes.RESIDUE,
)

# Create the block "Hetero atom"
residueBlock = InputBlock(
    "Residue",
    description="Select any residue",
    action=None,
    variable=residueVariable,
    id="residue",
)
