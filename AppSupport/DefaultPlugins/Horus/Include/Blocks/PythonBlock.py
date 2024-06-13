from HorusAPI import PluginBlock, PluginVariable, VariableTypes


inputVariable = PluginVariable(
    name="Input",
    id="input",
    description="Variables to be used in the code. Can be accessed with the 'inputs' variable. For example: print(inputs)",
    type=VariableTypes.ANY,
)

codeVariable = PluginVariable(
    name="Code",
    id="code",
    description="Write a Python script",
    type=VariableTypes.PYTHON,
)

outputVariable = PluginVariable(
    name="Output",
    id="output",
    description="The output of the code. Can be setted with the 'setOutput' function. For example: setOutput(my_value)",
    type=VariableTypes.ANY,
)


def executePython(block: PluginBlock):
    """
    Converts a string into a Python script and runs it
    """

    pythonCode = block.variables[codeVariable.id]

    # Generate a easy variable to access the inputs
    inputs = block.inputs[inputVariable.id]

    # Generate a easy variable to access the outputs
    def setOutput(value):
        block.setOutput(outputVariable.id, value)

    exec(pythonCode)


# Create the block "Code"
pythonCodeBlock = PluginBlock(
    codeVariable.name,
    description=codeVariable.description,
    action=executePython,
    inputs=[inputVariable],
    variables=[codeVariable],
    outputs=[outputVariable],
    id=codeVariable.id,
)
