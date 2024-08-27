from typing import Any, List
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
    type=VariableTypes.CODE,
    allowedValues=["python"],
    defaultValue="""# The inputs of the block are in the 'inputs' variable
print("inputs are", inputs)

# The output of the block can be set
# with the setOutput function
setOutput("hello world!")""",
)


class EnvironmentVariable(PluginVariable):
    """
    Extracts the allowed values from the loaded plugins
    """

    def toDict(self, minimal: bool = False):
        varDict = super().toDict(minimal)

        # Replace the allowedValues with the existing plugins
        from App import AppDelegate

        pluginList = AppDelegate().server.pluginManager.loadedPlugins

        varDict["allowedValues"] = [plugin.id for plugin in pluginList]

        return varDict


environmentVariable = EnvironmentVariable(
    name="Plugin environment",
    id="environment",
    description="Select a Plugin ID to use its dependencies within the code.",
    type=VariableTypes.STRING_LIST,
    defaultValue="Horus",
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

    # Get the code
    pythonCode = block.variables[codeVariable.id]

    # Generate a easy variable to access the inputs
    inputs = block.inputs[inputVariable.id]

    # Generate a easy variable to access the outputs
    def setOutput(value):
        block.setOutput(outputVariable.id, value)

    # Use the PluginDeps context
    from Server.PluginManager import PluginDeps

    # Get the environment
    pluginID = block.variables[environmentVariable.id]

    # Get the plugin path
    from App import AppDelegate

    pluginPath = None
    for p in AppDelegate().server.pluginManager.loadedPlugins:
        if p.id == pluginID:
            pluginPath = p._path
            break

    if pluginPath is None:
        raise Exception(f"Plugin with ID '{pluginID}' not found")

    with PluginDeps(pluginPath):
        exec(pythonCode)


# Create the block "Code"
pythonCodeBlock = PluginBlock(
    codeVariable.name,
    description=codeVariable.description,
    action=executePython,
    inputs=[inputVariable],
    variables=[environmentVariable, codeVariable],
    outputs=[outputVariable],
    id=codeVariable.id,
)
