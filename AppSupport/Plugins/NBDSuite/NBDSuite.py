"""
Entry point for the NBDSuite plugin
"""

from HorusAPI import Plugin


def createPlugin():
    """
    Generates the NBDSuite plugin and returns the instance
    """
    # ========== Plugin Definition ========== #

    nbdsuitePlugin = Plugin(id="NBDSuite")

    # ========== Blocks ========== #

    from Blocks.Minimizer import minimizePDBBlock  # type: ignore

    nbdsuitePlugin.addBlock(minimizePDBBlock)

    from Blocks.IFR import inducedFitRefinementBlock  # type: ignore

    # Add the block to the plugin
    nbdsuitePlugin.addBlock(inducedFitRefinementBlock)

    from Blocks.Docking import dockingBlock  # type: ignore

    # Add the block to the plugin
    nbdsuitePlugin.addBlock(dockingBlock)

    # ========== PAGES ========== #

    from Pages.PELEResults import peleResultsPage  # type: ignore # pylint: disable=no-name-in-module

    # Add the PELE results page to the plugin
    nbdsuitePlugin.addPage(peleResultsPage)

    # Return the plugin
    return nbdsuitePlugin


plugin = createPlugin()
