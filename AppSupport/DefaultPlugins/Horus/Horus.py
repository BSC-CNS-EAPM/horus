from HorusAPI import Plugin, PluginBlock, PluginVariable, VariableTypes, TempFile
from Bio.PDB.MMCIFParser import MMCIFParser
from Bio.PDB import PDBIO

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


# Create the block "Structure"
strucBlock = PluginBlock(
    "Structure",
    description="Get a structure from Mol*",
    action=saveStructure,
    variables=[structureVariable, savenameVariable],
)

# Add the block to the plugin
plugin.addBlock(strucBlock)

fileVariable = PluginVariable(
    name="File",
    id="file",
    description="Select a file",
    type=VariableTypes.FILE,
)

# Create the block "File"
fileBlock = PluginBlock(
    "File",
    description="Select a file",
    action=None,
    variables=[fileVariable],
)

# Add the block to the plugin
plugin.addBlock(fileBlock)
