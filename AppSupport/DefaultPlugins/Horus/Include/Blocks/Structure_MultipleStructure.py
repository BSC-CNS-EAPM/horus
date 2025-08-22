import os
import shutil

from HorusAPI import (
    PluginVariable,
    VariableTypes,
    InputBlock,
    structureToFile,
    multipleStructuresToFolder,
)

# Multiple Structure Variables
multipleStructureVariable = PluginVariable(
    name="Structure",
    id="multipleStructures",
    description="Select one or more structures from Mol*.",
    type=VariableTypes.MULTIPLE_STRUCTURE,
)

multipleStructureVariableOutput = PluginVariable(
    name="Structures folder",
    id="multipleStructureOutput",
    description="Folder path to the selected molecule(s)",
    type=VariableTypes.FOLDER,
)

# Structure Variables
structureVariable = PluginVariable(
    name="Structure",
    id="structure",
    description="Select one structure from Mol*.",
    type=VariableTypes.STRUCTURE,
)

structureVariableOutput = PluginVariable(
    name="Structure file",
    id="structureOutput",
    description="File path to the selected molecule.",
    type=VariableTypes.FILE,
    allowedValues=["*"],
)


def saveAction(structure: dict, filePathToWrite: str) -> str:
    """
    Save one structure in the correct format.
    """

    # Get the contents earlier and check if they exist
    fileContents = structure.get("fileContents")

    if fileContents is None:
        raise Exception(f"File for structure {filePathToWrite} is empty")

    if "bcif" == filePathToWrite.split(".")[-1]:
        with open(filePathToWrite, "wb") as ff:
            # If file is bcif convert from type Uint8arr to binary file
            newFileBytes = map(int, fileContents.split(","))
            ff.write(bytes(newFileBytes))
    else:
        with open(filePathToWrite, "w", encoding="utf-8") as ff:
            # If file isn't a bcif write directly
            ff.write(fileContents)

    print(f"Saved {filePathToWrite} to flow folder")

    if not os.path.exists(filePathToWrite):
        raise Exception(f"The file {filePathToWrite} wasn't generated correctly.")

    return filePathToWrite


def saveStructure(block: InputBlock):
    """
    Save one Mol* structure into a file
    """
    structure = block.variables.get("structure", None)  # [0] Uncoment if type = list (Christian)

    if structure is None:
        raise Exception("No structure provided.")

    # Save structure
    filePathToWrite = structureToFile(structure)

    block.setOutput(structureVariableOutput.id, filePathToWrite)


def saveMultipleStructureAction(block: InputBlock):
    """
    Save more than one Mol* structure into a file
    """

    structureList = block.variables.get("multipleStructures", None)
    if structureList is None:
        raise Exception("No structure provided.")

    directory = f"Structures_block_{block._placedID}"

    # Remove if directory already exists
    if os.path.exists(directory):
        shutil.rmtree(directory)

    os.mkdir(directory)

    # for structure in structureList:
    #     name = structure.get("label", None)

    #     # Formats come without the "." for the extension
    #     format = "." + structure.get("format")

    #     if name is None or format is None:
    #         raise Exception("Structure not loaded correctly")

    #     if not name.endswith(format):
    #         name += format

    #     name = sanitize_filepath(name)

    #     # Parse the filepath to write.
    #     filePathToWrite = os.path.join(directory, name)

    #     # Save structure
    #     saveAction(structure, filePathToWrite)

    multipleStructuresToFolder(structureList, directory)

    block.setOutput(multipleStructureVariableOutput.id, directory)


# Create the block "Structure"
strucBlock = InputBlock(
    "Structure",
    id="structure",
    description="Get one structure from the visualizer as a file.",
    action=saveStructure,
    variable=structureVariable,
    output=structureVariableOutput,
    category="Structures",
)


# Create the block "Multiple Structures"
multStrucBlock = InputBlock(
    "Multiple structures",
    id="multiple_structures",
    description="Save one or more structures from the visualizer into a folder.",
    action=saveMultipleStructureAction,
    variable=multipleStructureVariable,
    output=multipleStructureVariableOutput,
    category="Structures",
)
