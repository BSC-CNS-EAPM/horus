from HorusAPI import InputBlock, PluginVariable, VariableTypes

smilesVariable = PluginVariable(
    name="SMILES",
    id="smiles",
    description="Write SMILES",
    type=VariableTypes.SMILES,
)

smilesOutput = PluginVariable(
    name="SMILES",
    id="smiles_output",
    description="Write SMILES",
    type=VariableTypes.SMILES,
)


def parseSmiles(block: InputBlock):
    """
    Extracts only the "smi" part of the SMILES object
    """

    smiles = block.inputs[smilesVariable.id]

    smilesList = None
    if smiles is None:
        print("WARNING: No SMILES provided.")
    else:
        smilesList = []
        for s in smiles:
            smilesList.append(s["smi"])

    block.setOutput(smilesOutput.id, smilesList)


# Create the block "Hetero smiles"
smilesBlock = InputBlock(
    name="SMILES",
    description="Select 2D molecules as SMILES",
    action=parseSmiles,
    variable=smilesVariable,
    output=smilesOutput,
    id="smiles",
)
