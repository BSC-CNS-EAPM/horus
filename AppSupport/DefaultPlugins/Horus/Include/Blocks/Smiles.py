from HorusAPI import InputBlock, PluginVariable, VariableTypes

smilesVariable = PluginVariable(
    name="SMILES",
    id="smiles",
    description="Write SMILES",
    type=VariableTypes.SMILES,
)

# Create the block "Hetero smiles"
smilesBlock = InputBlock(
    name="SMILES",
    description="Write SMILES",
    action=None,
    variable=smilesVariable,
)
