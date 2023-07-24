from HorusAPI import (
    Plugin,
    PluginBlock,
    PluginVariable,
    VariableTypes,
    TempFile,
    MolstarAPI,
)
from Bio.PDB.MMCIFParser import MMCIFParser
from Bio.PDB import PDBIO
import os
import typing as t

plugin = Plugin(id="horus")

plugin.info = {
    "name": "Horus",
    "description": "Base plugin for Horus",
    "author": "Horus",
    "version": "0.0.1",
}

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
    description="Get a structure from the visualizer.",
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


# Create the block "File"
fileBlock = PluginBlock(
    "File",
    description="Select a single file",
    action=None,
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
