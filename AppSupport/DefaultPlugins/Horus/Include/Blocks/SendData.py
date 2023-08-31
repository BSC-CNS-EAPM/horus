from HorusAPI import PluginVariable, PluginBlock, VariableTypes, VariableGroup
import os


# Create a block that adds a given pdb to Mol*
def sendData(block: PluginBlock):

    print("Selected input group: " + block.selectedInputGroup)

    # Get the source path
    source = None
    if block.selectedInputGroup == "fileInputGroup":
        source = block.inputs.get("file", None)
        if source is None:
            raise Exception("No file provided.")
    elif block.selectedInputGroup == "folderInputGroup":
        source = block.inputs.get("folder", None)
        if source is None:
            raise Exception("No folder provided.")

    if source is None:
        raise Exception("No source provided.")
    
    if not os.path.exists(source):
        raise Exception("Source does not exist.")

    destinationPath = block.inputs.get("destination", None)

    if destinationPath is None:
        raise Exception("No destination provided.")

    print(f"Sending data from {source} to {destinationPath}")

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
    allowedValues=["*"]
)

inputFolder = PluginVariable(
    name="Folder",
    id="folder",
    description="A folder to send to the remote.",
    type=VariableTypes.FOLDER,
)

fileInputGroup = VariableGroup(
    id="fileInputGroup",
    variables=[inputFile, destination],
)

folderInputGroup = VariableGroup(
    id="folderInputGroup",
    variables=[inputFolder, destination],
)

sendDataBlock = PluginBlock(
    name="Send data",
    description="Send data from the local machine to the remote.",
    action=sendData,
    inputGroups=[fileInputGroup, folderInputGroup],
)
