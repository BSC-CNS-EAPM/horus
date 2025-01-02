from HorusAPI import InputBlock, PluginVariable, VariableTypes

objectVariable = PluginVariable(
    name="Object",
    id="object",
    description="Write a JSON object.",
    type=VariableTypes.OBJECT,
)


def verifyJSON(block: InputBlock):
    """
    Verify that the input value is a correct JSON
    """

    inputValue = block.variables[objectVariable.id]

    if not isinstance(inputValue, dict):
        raise ValueError(
            "The input value is not a JSON object. This means it is not a valid JSON. Recived: "
            + str(inputValue)
        )

    block.setOutput(objectVariable.id, inputValue)


# Create the block "Hetero atom"
objectBlock = InputBlock(
    objectVariable.name,
    description=objectVariable.description,
    action=verifyJSON,
    variable=objectVariable,
    id=objectVariable.id,
    category="Code",
)
