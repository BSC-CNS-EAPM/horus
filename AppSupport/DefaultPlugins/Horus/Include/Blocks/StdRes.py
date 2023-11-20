from HorusAPI import InputBlock, PluginVariable, VariableTypes

stdResidueVariable = PluginVariable(
    name="Standard residue",
    id="stdRes",
    description="Select a standard residue",
    type=VariableTypes.STDRES,
)

# Create the block "Hetero atom"
stdResBlock = InputBlock(
    "Standard residue",
    description="Select a Standard residue",
    action=None,
    variable=stdResidueVariable,
)
