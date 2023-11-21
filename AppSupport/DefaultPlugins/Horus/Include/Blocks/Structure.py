import os
from HorusAPI import PluginVariable, VariableTypes, InputBlock, TempFile
from pathvalidate import sanitize_filepath

structureVariable = PluginVariable(
    name="Structure",
    id="structure",
    description="Select a molecular structure from Mol*",
    type=VariableTypes.STRUCTURE,
    allowedValues=["pdb"],
)

savenameVariable = PluginVariable(
    name="Save name",
    id="savename",
    description="Name of the file to save the structure",
    type=VariableTypes.STRING,
    defaultValue="structure",
)


def sanitizePath(path: str):
    """
    Replaces any invalid character in a path
    """

    path = (
        path.replace(" ", "_")
        .replace(":", "_")
        .replace("/", "_")
        .replace("\\", "_")
        .replace("(", "")
        .replace(")", "")
    )

    return sanitize_filepath(path, platform="universal", normalize=True)


def CIFtoPDB(cifFile: str, pdbFile: str):
    from Bio.PDB.MMCIFParser import MMCIFParser  # type: ignore
    from Bio.PDB import PDBIO  # type: ignore

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


def convertStructureToPDB(structure):
    isCif = structure.get("type", None) == "cif"
    dataStructure = structure.get("structure", None)
    name = structure.get("name", None)

    if ".pdb" not in name:
        filename = str(name) + ".pdb"
    else:
        filename = name

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

    # Sanitize the filename
    filename = sanitizePath(filename)

    # Save the data into the file
    with open(filename, "w") as f:
        f.write(pdbtmp.read())

    print(f"Saved {name} to {filename}")

    return filename


def saveStructure(block: InputBlock):
    """
    Saves a Mol* structure to a PDB file
    """

    try:
        structure = block.variables.get("structure", None)
    except Exception:
        raise Exception("No structure provided.")

    if structure is None or structure == "" or hasattr(structure, "get") is False:
        structure = sanitizePath(structure)
        if os.path.exists(structure):
            print(f"Found existing {structure} file")
            filename = structure
        else:
            raise Exception(
                f"The provided {structure} does not exist. Please provide a new structure."
            )
    else:
        filename = convertStructureToPDB(structure)

    block.setOutput("structure", filename)


# Create the block "Structure"
strucBlock = InputBlock(
    "Structure",
    description="Get a structure from the visualizer",
    action=saveStructure,
    variable=structureVariable,
)
