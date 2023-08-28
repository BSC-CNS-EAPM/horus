from HorusAPI import Plugin


def createPlugin():
    # ========== Plugin Definition ========== #

    plugin = Plugin(id="NBDSuite")

    # ========== Blocks ========== #

    from Blocks.Minimizer import minimizePDBBlock  # type: ignore

    plugin.addBlock(minimizePDBBlock)

    from Blocks.IFR import inducedFitRefinementBlock  # type: ignore

    # Add the block to the plugin
    plugin.addBlock(inducedFitRefinementBlock)

    from Blocks.Docking import dockingBlock  # type: ignore

    # Add the block to the plugin
    plugin.addBlock(dockingBlock)

    # ========== PAGES ========== #

    from Pages.PELEResults import PeleResultsPage  # type: ignore

    # Add the PELE results page to the plugin
    plugin.addPage(PeleResultsPage)

    # Return the plugin
    return plugin


plugin = createPlugin()
