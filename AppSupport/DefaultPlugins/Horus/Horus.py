from HorusAPI import Plugin


plugin = Plugin()

from Blocks.Smiles import smilesBlock  # type: ignore

# Add the smiles block to the plugin
plugin.addBlock(smilesBlock)

from Blocks.File import fileBlock  # type: ignore

# Add the file block to the plugin
plugin.addBlock(fileBlock)

from Blocks.Folder import folderBlock  # type: ignore

# Add the folder block to the plugin
plugin.addBlock(folderBlock)

# Add the addMolecule block to plugin
from Blocks.AddMolecule import addMoleculeBlock  # type: ignore

# Add the addPDB block to the plugin
plugin.addBlock(addMoleculeBlock)

from Blocks.GetPDB import getPDBBlock  # type: ignore

# Add the getPDB block to the plugin
plugin.addBlock(getPDBBlock)

from Blocks.HeteroRes import heteroResBlock  # type: ignore

# Add the heteroRes block to the plugin
plugin.addBlock(heteroResBlock)

from Blocks.StdRes import stdResBlock  # type: ignore

# Add the stdRes block to the plugin
plugin.addBlock(stdResBlock)

from Blocks.Residue import residueBlock  # type: ignore

# Add the residue block to the plugin
plugin.addBlock(residueBlock)

from Blocks.Atom import atomBlock  # type: ignore

# Add the atom block to the plugin
plugin.addBlock(atomBlock)

from Blocks.Chain import chainBlock  # type: ignore

# Add the chain block to the plugin
plugin.addBlock(chainBlock)

from Blocks.Sphere import sphereBlock  # type: ignore

# Add the sphere block to the plugin
plugin.addBlock(sphereBlock)

from Blocks.RegularString import stringBlock  # type: ignore

# Add the string block to the plugin
plugin.addBlock(stringBlock)

from Blocks.GetData import getDataBlock  # type: ignore

# Add the getData block to the plugin
plugin.addBlock(getDataBlock)

from Blocks.SendData import sendDataBlock  # type: ignore

# add the sendData block to the plugin
plugin.addBlock(sendDataBlock)

from Blocks.PrintVariable import printBlock  # type: ignore

# Add the print block to the plugin
plugin.addBlock(printBlock)

from Blocks.TextArea import textAreaBlock  # type: ignore

# Add the print block to the plugin
plugin.addBlock(textAreaBlock)

from Blocks.Structure_MultipleStructure import strucBlock, multStrucBlock  # type: ignore

# Add the Structure block to the plugin
plugin.addBlock(strucBlock)

# Add the multipleStructure block to the plugin
plugin.addBlock(multStrucBlock)

from Blocks.Box import boxBlock  # type: ignore

plugin.addBlock(boxBlock)

from Blocks.Object import objectBlock  # type: ignore

plugin.addBlock(objectBlock)

from Blocks.PythonBlock import pythonCodeBlock  # type: ignore

plugin.addBlock(pythonCodeBlock)

from Blocks.VariableMerger import mergeVariablesBlock  # type: ignore

plugin.addBlock(mergeVariablesBlock)

# Add the "Page loader" extension
from Extensions.PageLoader import htmlLoader  # type: ignore

plugin.addPage(htmlLoader)
