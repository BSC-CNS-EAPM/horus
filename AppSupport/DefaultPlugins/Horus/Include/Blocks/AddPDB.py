from HorusAPI import PluginVariable, PluginBlock, VariableTypes, MolstarAPI
import os


class NoPDBFileException(Exception):
    pass


# Create a block that adds a given pdb to Mol*
def addPDB(block: PluginBlock):
    """
    Adds a PDB file to Mol*
    """

    def addToMolstar(f: str):
        if isinstance(f, list):
            f = f[0]

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
                pdbFullPath = os.path.join(path, f)
                addToMolstar(pdbFullPath)
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
    inputs=[visualizePDBinput, visualizePDBfolder],
)
