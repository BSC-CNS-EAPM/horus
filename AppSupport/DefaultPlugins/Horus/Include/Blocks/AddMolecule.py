"""
Visualize Molecule block
"""

import os
import shutil
from HorusAPI import PluginVariable, PluginBlock, VariableTypes, MolstarAPI, VariableGroup

from typing import Union


class NoMoleculeFileException(Exception):
    """
    Exception raised when the input is not a Molecule file.
    """


def addToMolstar(filePath: str):
    """
    Adds the given Molecule file to Mol*
    """

    # Send molecule to molstar encoded in hex

    print(f"Adding {filePath} to Mol*")

    MolstarAPI().addMolecule(filePath)


# Create a block that adds a given Molecule to Mol*
def addMolecule(block: PluginBlock):
    """
    Adds a Molecule file to Mol*
    """
    if block.selectedInputGroup == "fileInputGroup":
        # Get the file
        path = block.inputs.get("file", None)

        if path is not None:
            if block.remote.name != "Local":
                # Download the file
                print("Downloading file from remote...")

                remoteTmpMolecule = ".tmp_" + os.path.basename(path)

                block.remote.getData(path, remoteTmpMolecule)

                addToMolstar(remoteTmpMolecule)

                # Delete the file
                os.remove(remoteTmpMolecule)
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
                    remoteTmpMolecule = ".temp_remote_Molecule_folder"
                    downloadedPath = os.path.join(os.getcwd(), remoteTmpMolecule)
                    finalPath = block.remote.getData(path, downloadedPath)
                    path = finalPath

                if not os.path.isdir(path):
                    raise Exception("Input is not a folder.")

                moleculeFound = False

                for root, dirs, files in os.walk(path):
                    for f in files:
                        try:
                            moleculeFullPath = os.path.join(root, f)
                            addToMolstar(moleculeFullPath)
                            moleculeFound = True
                        except NoMoleculeFileException:
                            pass

                if not moleculeFound:
                    raise Exception("No Molecule found in the folder.")
                else:
                    return
    finally:
        if downloadedPath is not None:
            # Delete the folder
            shutil.rmtree(downloadedPath)

    raise Exception("No input provided.")


visualizeMoleculeinput = PluginVariable(
    name="File",
    id="file",
    description="The structure file to visualize.",
    type=VariableTypes.FILE,
    allowedValues=["*"],
)

visualizeMoleculefolder = PluginVariable(
    name="Folder",
    id="folder",
    description="The folder containing the structure files to visualize.",
    type=VariableTypes.FOLDER,
)

visualizeMoleculefolderGroup = VariableGroup(
    id="folderInputGroup",
    name="Folder",
    description="A folder containing structure files to visualize.",
    variables=[visualizeMoleculefolder],
)

visualizeMoleculefileGroup = VariableGroup(
    id="fileInputGroup",
    name="File",
    description="A structure file to visualize.",
    variables=[visualizeMoleculeinput],
)

addMoleculeBlock = PluginBlock(
    name="Visualize structure",
    id="visualize_pdb",
    description="Adds a structure to Mol* from a file or all structures from a folder path.",
    action=addMolecule,
    inputGroups=[visualizeMoleculefileGroup, visualizeMoleculefolderGroup],
)
