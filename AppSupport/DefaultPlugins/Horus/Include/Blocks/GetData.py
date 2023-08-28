from HorusAPI import PluginVariable, PluginBlock, VariableTypes
import os


# Create a block that adds a given pdb to Mol*
def getData(block: PluginBlock):
    inputPath = block.inputs.get("path", None)

    if inputPath is None:
        raise Exception("No path provided.")

    print(f"Getting data from {inputPath}")

    folderName = os.path.basename(inputPath)

    finalPath = os.path.join(os.getcwd(), folderName)

    # Get the data
    block.remote.getData(inputPath, finalPath)

    print(f"Data saved at current directory ({finalPath})")


inputPath = PluginVariable(
    name="Path",
    id="path",
    description="The path in the remote to download the data from.",
    type=VariableTypes.STRING,
)

getDataBlock = PluginBlock(
    name="Get data",
    description="Transfer data from the remote to the local machine.",
    action=getData,
    inputs=[inputPath],
)
