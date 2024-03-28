"""
Visualize PDB block
"""

import os
import shutil
from HorusAPI import PluginVariable, PluginBlock, VariableTypes, MolstarAPI, VariableGroup

from typing import Union


class NoPDBFileException(Exception):
    """
    Exception raised when the input is not a PDB file.
    """


def addToMolstar(f: str):
    """
    Adds the given PDB file to Mol*
    """
    if isinstance(f, list):
        f = f[0]

    extension = f.split(".")[-1]
    if extension != "pdb":
        raise NoPDBFileException("Input is not a PDB file.")

    # Read the file
    with open(f, "r", encoding="utf-8") as fopen:
        pdb = fopen.read()

    filename = f.split("/")[-1]

    print(f"Adding {filename} to Mol*")

    # Create the structure
    MolstarAPI().addPDB(pdb, filename)


# Create a block that adds a given pdb to Mol*
def addPDB(block: PluginBlock):
    """
    Adds a PDB file to Mol*
    """

    if block.selectedInputGroup == "fileInputGroup":
        # Get the file
        path = block.inputs.get("file", None)

        if path is not None:
            if block.remote.name != "Local":
                # Download the file
                print("Downloading file from remote...")
                remoteTmpPDB = "temp_remote.pdb"
                block.remote.getData(path, remoteTmpPDB)

                addToMolstar(remoteTmpPDB)

                # Delete the file
                os.remove(remoteTmpPDB)
            else:
                addToMolstar(path)

            return

    downloadedPath: Union[str, None] = None
    try:
        if block.selectedInputGroup == "folderInputGroup":
            # Get the folder
            path = block.inputs.get("folder", None)

            if path is not None:
                if block.remote.name != "Local":
                    # Download the folder
                    print("Downloading folder from remote...")
                    remoteTmpPDB = "temp_remote_pdb_folder"
                    downloadedPath = os.path.join(os.getcwd(), remoteTmpPDB)
                    finalPath = block.remote.getData(path, downloadedPath)
                    path = finalPath

                if not os.path.isdir(path):
                    raise Exception("Input is not a folder.")

                pdbFound = False

                for root, dirs, files in os.walk(path):
                    for f in files:
                        try:
                            pdbFullPath = os.path.join(root, f)
                            addToMolstar(pdbFullPath)
                            pdbFound = True
                        except NoPDBFileException:
                            pass

                if not pdbFound:
                    raise Exception("No PDB found in the folder.")
                else:
                    return
    finally:
        if downloadedPath is not None:
            # Delete the folder
            shutil.rmtree(downloadedPath)

    raise Exception("No input provided.")


visualizePDBinput = PluginVariable(
    name="File",
    id="file",
    description="The PDB file to visualize.",
    type=VariableTypes.FILE,
    allowedValues=["pdb"],
)

visualizePDBfolder = PluginVariable(
    name="Folder",
    id="folder",
    description="The folder containing the PDB files to visualize.",
    type=VariableTypes.FOLDER,
)

visualizePDBfolderGroup = VariableGroup(
    id="folderInputGroup",
    name="Folder",
    description="Pass a folder containing PDB files to visualize.",
    variables=[visualizePDBfolder],
)

visualizePDBfileGroup = VariableGroup(
    id="fileInputGroup",
    name="File",
    description="Pass a PDB file to visualize.",
    variables=[visualizePDBinput],
)

addPDBBlock = PluginBlock(
    name="Visualize PDB",
    description="Adds a PDB to Mol* from a file or all PDBs from a folder path",
    action=addPDB,
    inputGroups=[visualizePDBfileGroup, visualizePDBfolderGroup],
    id="visualize_pdb",
)
