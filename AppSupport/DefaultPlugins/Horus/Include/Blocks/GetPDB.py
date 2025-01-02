"""
Download PDB block
"""

import os
import shutil
from HorusAPI import PluginVariable, InputBlock, VariableTypes


# Create a block that adds a given pdb to Mol*
def addPDB(block: InputBlock):

    pdbIDValue = block.variables.get("pdbID", None)

    if pdbIDValue is None:
        raise ValueError("PDB ID is required")

    # Download the PDB from the RCSB PDB
    print(f"Downloading PDB {pdbIDValue} from RCSB PDB...")

    import requests

    # Download the PDB
    url = f"https://files.rcsb.org/download/{pdbIDValue}.pdb"

    # Get the file
    r = requests.get(url, timeout=1500).content

    # Create the downloaded file
    with open(f"{pdbIDValue}.pdb", "wb") as fopen:
        fopen.write(r)

    # Get the absolute path
    path = os.path.abspath(f"{pdbIDValue}.pdb")

    # Set the output as the structure
    block.setOutput("structure", path)


pdbID = PluginVariable(
    name="PDB ID",
    id="pdbID",
    description="The PDB ID to download",
    placeholder="PDB ID...",
    type=VariableTypes.STRING,
)

structureOutput = PluginVariable(
    name="PDB File",
    id="structure",
    description="The PDB file downloaded from the PDB ID",
    type=VariableTypes.FILE,
    allowedValues=["pdb"],
)


getPDBBlock = InputBlock(
    name="Get PDB",
    description="Downloads a PDB from the RCSB PDB database from the given PDB ID",
    action=addPDB,
    variable=pdbID,
    output=structureOutput,
    id="get_pdb",
            category="Files"

)
