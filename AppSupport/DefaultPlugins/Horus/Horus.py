from HorusAPI import (
    Plugin,
    PluginBlock,
    PluginVariable,
    VariableTypes,
    TempFile,
    MolstarAPI,
)
import os
import time

plugin = Plugin(id="horus")

structureVariable = PluginVariable(
    name="Structure",
    id="structure",
    description="Select a molecular structure from Mol*",
    type=VariableTypes.STRUCTURE,
)

savenameVariable = PluginVariable(
    name="Save name",
    id="savename",
    description="Name of the file to save the structure",
    type=VariableTypes.STRING,
    defaultValue="structure",
)


def CIFtoPDB(cifFile: str, pdbFile: str):
    from Bio.PDB.MMCIFParser import MMCIFParser
    from Bio.PDB import PDBIO

    pdbfile = pdbFile or cifFile.replace(".cif", ".pdb")

    # Not sure why biopython needs this to read a cif file
    strucid = cifFile[:4] if len(cifFile) > 4 else "1xxx"

    # Read file
    parser = MMCIFParser()
    structure = parser.get_structure(strucid, cifFile)

    # Write PDB
    io = PDBIO()
    io.set_structure(structure)

    io.save(pdbfile)


def saveStructure(block: PluginBlock):
    """
    Saves a Mol* structure to a PDB file
    """

    structure = block.variables.get("structure", None)

    if structure is None or structure == "":
        raise Exception("No structure provided.")

    isCif = structure.get("type", None) == "cif"
    dataStructure = structure.get("structure", None)
    name = structure.get("name", None)

    # Get the filename
    filename = block.variables.get("savename", None)
    if filename is None:
        raise Exception("No structure name provided.")
    filename = str(filename) + ".pdb"

    if isCif:
        try:
            # Write the CIF to a temporary file
            ciftmp = TempFile("cift.cif")
            ciftmp.write(dataStructure)

            # Create an empty PDB file
            pdbtmp = TempFile("pdbt.pdb")

            # Convert the CIF to PDB
            CIFtoPDB(ciftmp.path, pdbtmp.path)
        except Exception as e:
            raise Exception("Error converting CIF to PDB:", e)
    else:
        pdbtmp = TempFile("pdbt.pdb")
        pdbtmp.write(dataStructure)

    # Save the data into the file
    with open(filename, "w") as f:
        f.write(pdbtmp.read())

    print(f"Saved {name} to {filename}")

    block.setOutput("file", filename)


# Define the output variable for the PDB file generated
outputPDB = PluginVariable(
    name="File",
    id="file",
    description="The PDB file generated",
    type=VariableTypes.FILE,
)

# Create the block "Structure"
strucBlock = PluginBlock(
    "Structure",
    description="Get a structure from the visualizer",
    action=saveStructure,
    variables=[structureVariable, savenameVariable],
    outputs=[outputPDB],
)

# Add the block to the plugin
plugin.addBlock(strucBlock)

fileVariable = PluginVariable(
    name="File",
    id="file",
    description="Select a file",
    type=VariableTypes.FILE,
)

fileSelectOutput = PluginVariable(
    name="File",
    id="file",
    description="The path of the selected file",
    type=VariableTypes.FILE,
)


def selectFile(block: PluginBlock):
    """
    Selects a file
    """

    # Get the file
    path = block.variables.get("file", None)

    if path is None:
        raise Exception("No file provided.")

    if isinstance(path, list):
        path = path[0]

    print("Passed file:", path)

    block.setOutput("file", path)


# Create the block "File"
fileBlock = PluginBlock(
    "File",
    description="Select a single file",
    action=selectFile,
    variables=[fileVariable],
    outputs=[fileSelectOutput],
)

# Add the block to the plugin
plugin.addBlock(fileBlock)

folderVariable = PluginVariable(
    name="Folder",
    id="folder",
    description="Select a folder",
    type=VariableTypes.FOLDER,
)

folderOutput = PluginVariable(
    name="Folder",
    id="folder",
    description="The path of the selected folder",
    type=VariableTypes.FOLDER,
)

# Create the block "Folder"
folderBlock = PluginBlock(
    "Folder",
    description="Select a folder",
    action=None,
    variables=[folderVariable],
    outputs=[folderOutput],
)

# Add the block to the plugin
plugin.addBlock(folderBlock)


class NoPDBFileException(Exception):
    pass


# Create a block that adds a given pdb to Mol*
def addPDB(block: PluginBlock):
    """
    Adds a PDB file to Mol*
    """

    def addToMolstar(f: str):
        extension = f.split(".")[-1]
        if extension != "pdb":
            raise NoPDBFileException("Input is not a PDB file.")

        # Read the file
        with open(f, "r") as fopen:
            pdb = fopen.read()

        filename = f.split("/")[-1]

        print(f"Adding {filename} to Mol*")

        # Create the structure
        MolstarAPI().addPDB(pdb, filename)

    # Get the file
    path = block.inputs.get("file", None)

    if path is not None:
        addToMolstar(path)
        return

    path = block.inputs.get("folder", None)

    if path is not None:
        if not os.path.isdir(path):
            raise Exception("Input is not a folder.")

        filelist = os.listdir(path)
        pdb_found = False

        for f in filelist:
            try:
                addToMolstar(f)
                pdb_found = True
            except NoPDBFileException:
                pass

        if not pdb_found:
            raise Exception("No PDB found in the folder.")

        return

    raise Exception("No input provided.")


visualizePDBinput = PluginVariable(
    name="File",
    id="file",
    description="The PDB file to visualize.",
    type=VariableTypes.FILE,
)

visualizePDBfolder = PluginVariable(
    name="Folder",
    id="folder",
    description="The folder containing the PDB files to visualize.",
    type=VariableTypes.FOLDER,
)

addPDBBlock = PluginBlock(
    name="Visualize PDB",
    description="Adds a PDB to Mol* from a file or all PDBs from a folder path",
    action=addPDB,
    variables=[],
    inputs=[visualizePDBinput, visualizePDBfolder],
    outputs=[],
)

plugin.addBlock(addPDBBlock)

commandVariable = PluginVariable(
    name="Command",
    id="command",
    description="The command to execute",
    type=VariableTypes.STRING,
)


# Create a test block for ClusterAPI
def customCommand(block: PluginBlock):
    command = block.variables.get("command", None)
    block.remote.remoteCommand(command)


customCommandBlock = PluginBlock(
    name="Remote command",
    description="Executes a command on the remote server",
    action=customCommand,
    variables=[commandVariable],
)

plugin.addBlock(customCommandBlock)

# Create a block that transfers a file to the remote server
fileTransferVariable = PluginVariable(
    name="File",
    id="file",
    description="The file to transfer",
    type=VariableTypes.FILE,
)

folderTransferVariable = PluginVariable(
    name="Folder",
    id="folder",
    description="The folder to transfer",
    type=VariableTypes.FOLDER,
)

destinationVariable = PluginVariable(
    name="Destination",
    id="destination",
    description="The destination path",
    type=VariableTypes.STRING,
)

outputPathTransferSent = PluginVariable(
    name="Path",
    id="file",
    description="The path of the file transferred",
    type=VariableTypes.FILE,
)


def sendData(block: PluginBlock):
    file = block.inputs.get("file", None)
    folder = block.inputs.get("folder", None)
    destination = block.variables.get("destination", None)

    if file:
        if isinstance(file, list):
            file = file[0]
        block.remote.sendData(file, destination)
    elif folder:
        block.remote.sendData(folder, destination)
    else:
        raise Exception("No input provided.")

    print(f"Sent {file or folder} to {destination}")

    block.setOutput("file", destination)


sendDataBlock = PluginBlock(
    name="Send data",
    description="Transfer data to the remote server",
    action=sendData,
    variables=[destinationVariable],
    inputs=[fileTransferVariable, folderTransferVariable],
    outputs=[outputPathTransferSent],
)

plugin.addBlock(sendDataBlock)

# Create a block that transfers a file from the remote server
fileGetVariable = PluginVariable(
    name="Path",
    id="path",
    description="The path to transfer",
    type=VariableTypes.STRING,
)

outputPathGet = PluginVariable(
    name="Path",
    id="path",
    description="The path where the data was transferred",
    type=VariableTypes.FOLDER,
)


def getData(block: PluginBlock):
    # The output path is the current working directory
    outputPath = os.getcwd()

    inputPath = block.inputs.get("path", None)

    # Debug
    inputPath = "/home/cdominguez/.horus/KRAS"

    if inputPath is None:
        raise Exception("No input provided.")

    name = os.path.basename(inputPath)
    parentFolder = os.path.dirname(inputPath)

    compressName = f"{name}.tar.gz"

    # Compress the files to be transferred
    block.remote.remoteCommand(
        f"cd {parentFolder} && tar -czf {compressName} {name}"
    )

    compressPath = os.path.join(parentFolder, compressName)

    # Add to the output path the name of the file
    outputPath = os.path.join(outputPath, f"{name}.tar.gz")

    print(f"Transferring {compressPath} into {outputPath}")
    block.remote.getData(compressPath, outputPath)

    print(f"Downloaded {inputPath} into {outputPath}")

    # Remove the compressed file
    block.remote.remoteCommand(f"rm {name}.tar.gz")

    block.setOutput("path", outputPath)


getDataBlock = PluginBlock(
    name="Get data",
    description="Transfer data from the remote server",
    action=getData,
    variables=[],
    inputs=[fileGetVariable],
    outputs=[outputPathGet],
)

plugin.addBlock(getDataBlock)


def debugFunction(block: PluginBlock):
    print("Executing debug function")
    count = 0
    while count < 5:
        print(f"Debugging... {count}")
        count += 1
        time.sleep(1)


# Debug block
debugBlock = PluginBlock(
    name="Debug",
    description="Debug block",
    action=debugFunction,
    variables=[],
    inputs=[],
    outputs=[],
)

plugin.addBlock(debugBlock)
