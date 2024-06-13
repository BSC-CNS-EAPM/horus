from HorusAPI import PluginBlock, PluginVariable, VariableTypes

input1 = PluginVariable(
    name="First input",
    id="input_1",
    description="The first input to be merged.",
    type=VariableTypes.ANY,
)

input2 = PluginVariable(
    name="Second input",
    id="input_2",
    description="The second input to be merged.",
    type=VariableTypes.ANY,
)

outputVariable = PluginVariable(
    name="Merged output",
    id="output",
    description="A list containing the merged values.",
    type=VariableTypes.ANY,
)


def mergeValues(block: PluginBlock):
    """
    Will get the values of the inputs and merge them into a list.
    """

    input1Value = block.inputs[input1.id]
    input2Value = block.inputs[input2.id]

    if isinstance(input1Value, list) and isinstance(input2Value, list):
        outputVariableValue = input1Value + input2Value
    elif isinstance(input1Value, list) and not isinstance(input2Value, list):
        outputVariableValue = input1Value + [input2Value]
    elif not isinstance(input1Value, list) and isinstance(input2Value, list):
        outputVariableValue = [input1Value] + input2Value
    else:
        outputVariableValue = [input1Value, input2Value]

    block.setOutput(outputVariable.id, outputVariableValue)


# Create the block "Hetero atom"
mergeVariablesBlock = PluginBlock(
    "Merge variables",
    description="Merge the values of the input variables into a list. If any of the inputs is a list, the values will be merged inside that list instead of generating a list of lists.",
    action=mergeValues,
    inputs=[input1, input2],
    outputs=[outputVariable],
    id="merge_variables_block",
)
