from HorusAPI import PluginVariable, PluginBlock, VariableTypes
import os


# Create a block that adds a given pdb to Mol*
def sendData(block: PluginBlock):
    source = block.inputs.get("file", None)

    if source is None:
        source = block.inputs.get("folder", None)

    if source is None:
        raise Exception("No file or folder provided.")

    destinationPath = block.inputs.get("destination", None)

    if destinationPath is None:
        raise Exception("No destination provided.")

    print(f"Sending data from {source}")

    # Send the data
    block.remote.sendData(source, destinationPath)

    print(f"Data saved at: {destinationPath}")


destination = PluginVariable(
    name="Destination",
    id="destination",
    description="The destination path in the remote",
    type=VariableTypes.STRING,
)

inputFile = PluginVariable(
    name="File",
    id="file",
    description="A single file to send to the remote.",
    type=VariableTypes.FILE,
)

inputFolder = PluginVariable(
    name="Folder",
    id="folder",
    description="A folder to send to the remote.",
    type=VariableTypes.FOLDER,
)

sendDataBlock = PluginBlock(
    name="Send data",
    description="Send data from the local machine to the remote.",
    action=sendData,
    inputs=[destination, inputFile, inputFolder],
)
