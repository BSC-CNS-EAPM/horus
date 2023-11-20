from HorusAPI import PluginVariable, PluginBlock, VariableTypes

inputVariable = PluginVariable(
    name="Input",
    id="input",
    description="The variable to print.",
    type=VariableTypes.ANY,
)

customMessage = PluginVariable(
    name="Custom message",
    id="custom_message",
    description="The custom message to print before the variable.",
    type=VariableTypes.STRING,
    defaultValue="Received variable: ",
)

printBlockPlacedID = PluginVariable(
    name="Print block placed ID",
    id="print_block_placed_id",
    description="Wether to print the placedID of this block.",
    type=VariableTypes.BOOLEAN,
)

outputVariable = PluginVariable(
    name="Output",
    id="output",
    description="The variable to print.",
    type=VariableTypes.ANY,
)


# Create a block that prints a given variable
def printVariable(block: PluginBlock):
    inputVariableValue = block.inputs.get("input", None)

    if block.variables.get("print_block_placed_id", False):
        print("Placed ID: " + str(block._placedID))

    customMessageValue = block.variables.get("custom_message", "Received variable: ")

    if inputVariableValue is None:
        raise Exception("No input provided.")

    print(customMessageValue + str(inputVariableValue))

    block.setOutput("output", inputVariableValue)


printBlock = PluginBlock(
    name="Print variable",
    description="Prints a given variable.",
    action=printVariable,
    inputs=[inputVariable],
    variables=[customMessage, printBlockPlacedID],
    outputs=[outputVariable],
)
