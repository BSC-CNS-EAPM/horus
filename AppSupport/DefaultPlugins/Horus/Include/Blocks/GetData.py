from HorusAPI import PluginVariable, PluginBlock, VariableTypes
import os


# Create a block that adds a given pdb to Mol*
def getData(block: PluginBlock):
    inputPathValue = block.inputs.get("path", None)
    destinationPathValue = block.variables.get("destinationPath", os.getcwd())

    if destinationPathValue == "":
        destinationPathValue = os.getcwd()

    if inputPathValue is None:
        raise Exception("No path provided.")

    print(f"Getting data from {inputPathValue} to {destinationPathValue}")

    folderName = os.path.basename(inputPathValue)

    finalPath = os.path.join(destinationPathValue, folderName)

    if not os.path.exists(destinationPathValue):
        os.makedirs(destinationPathValue)

    # Get the data
    block.remote.getData(inputPathValue, destinationPathValue)

    print(f"Data saved at current directory ({destinationPathValue})")


inputPath = PluginVariable(
    name="Path",
    id="path",
    description="The path in the remote to download the data from.",
    type=VariableTypes.STRING,
)

destinationPath = PluginVariable(
    name="Destination path",
    id="destinationPath",
    description="The path in the local machine to save the data to. (Default to current directory)",
    type=VariableTypes.STRING,
)

getDataBlock = PluginBlock(
    name="Get data",
    description="Transfer data from the remote to the local machine.",
    action=getData,
    inputs=[inputPath],
    variables=[destinationPath],
)
