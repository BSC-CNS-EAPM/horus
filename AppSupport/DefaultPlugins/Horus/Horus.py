from HorusAPI import Plugin


def createPlugin():
    plugin = Plugin(id="horus")

    from Blocks.Structure import strucBlock  # type: ignore

    # Add the structure to the plugin
    plugin.addBlock(strucBlock)

    from Blocks.Smiles import smilesBlock  # type: ignore

    # Add the smiles block to the plugin
    plugin.addBlock(smilesBlock)

    from Blocks.File import fileBlock  # type: ignore

    # Add the file block to the plugin
    plugin.addBlock(fileBlock)

    from Blocks.Folder import folderBlock  # type: ignore

    # Add the folder block to the plugin
    plugin.addBlock(folderBlock)

    from Blocks.AddPDB import addPDBBlock  # type: ignore

    # Add the addPDB block to the plugin
    plugin.addBlock(addPDBBlock)

    from Blocks.HeteroRes import heteroResBlock  # type: ignore

    # Add the heteroRes block to the plugin
    plugin.addBlock(heteroResBlock)

    from Blocks.StdRes import stdResBlock  # type: ignore

    # Add the stdRes block to the plugin
    plugin.addBlock(stdResBlock)

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

    return plugin


plugin = createPlugin()
