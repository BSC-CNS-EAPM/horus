from HorusAPI import Plugin


plugin = Plugin()

from Blocks.Smiles import smilesBlock

# Add the smiles block to the plugin
plugin.addBlock(smilesBlock)

from Blocks.File import fileBlock

# Add the file block to the plugin
plugin.addBlock(fileBlock)

from Blocks.Folder import folderBlock

# Add the folder block to the plugin
plugin.addBlock(folderBlock)

# Add the addMolecule block to plugin
from Blocks.AddMolecule import addMoleculeBlock

# Add the addPDB block to the plugin
plugin.addBlock(addMoleculeBlock)

from Blocks.GetPDB import getPDBBlock

# Add the getPDB block to the plugin
plugin.addBlock(getPDBBlock)

from Blocks.HeteroRes import heteroResBlock

# Add the heteroRes block to the plugin
plugin.addBlock(heteroResBlock)

from Blocks.StdRes import stdResBlock

# Add the stdRes block to the plugin
plugin.addBlock(stdResBlock)

from Blocks.Residue import residueBlock

# Add the residue block to the plugin
plugin.addBlock(residueBlock)

from Blocks.Atom import atomBlock

# Add the atom block to the plugin
plugin.addBlock(atomBlock)

from Blocks.Chain import chainBlock

# Add the chain block to the plugin
plugin.addBlock(chainBlock)

# Add the interactive chain block
from Blocks.ChainInteractive import interactiveChainBlock

plugin.addBlock(interactiveChainBlock)

# Add the residue range block
from Blocks.ResidueRange import residueRangeBlock

plugin.addBlock(residueRangeBlock)

from Blocks.Sphere import sphereBlock

# Add the sphere block to the plugin
plugin.addBlock(sphereBlock)

from Blocks.RegularString import stringBlock

# Add the string block to the plugin
plugin.addBlock(stringBlock)

from Blocks.GetData import getDataBlock

# Add the getData block to the plugin
plugin.addBlock(getDataBlock)

from Blocks.SendData import sendDataBlock

# add the sendData block to the plugin
plugin.addBlock(sendDataBlock)

from Blocks.PrintVariable import printBlock

# Add the print block to the plugin
plugin.addBlock(printBlock)

from Blocks.TextArea import textAreaBlock

# Add the print block to the plugin
plugin.addBlock(textAreaBlock)

from Blocks.Structure_MultipleStructure import strucBlock, multStrucBlock

# Add the Structure block to the plugin
plugin.addBlock(strucBlock)

# Add the multipleStructure block to the plugin
plugin.addBlock(multStrucBlock)

from Blocks.LoadTrajectory import loadTrajectoryBlock

# Add the loadTrajectory block to the plugin
plugin.addBlock(loadTrajectoryBlock)

from Blocks.Box import boxBlock

plugin.addBlock(boxBlock)

from Blocks.Object import objectBlock

plugin.addBlock(objectBlock)

from Blocks.PythonBlock import pythonCodeBlock

plugin.addBlock(pythonCodeBlock)

from Blocks.VariableMerger import mergeVariablesBlock

plugin.addBlock(mergeVariablesBlock)

# Add the "Page loader" extension
from Extensions.PageLoader import htmlLoader, imageLoader, csvLoader, pdfLoader, plotLoader

plugin.addPage(htmlLoader)
plugin.addPage(imageLoader)
plugin.addPage(csvLoader)
plugin.addPage(pdfLoader)
plugin.addPage(plotLoader)
