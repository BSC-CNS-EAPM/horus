"""
This plugin includes all the individual
blocks of the NBDSuite as Horus blocks
"""

from HorusAPI import Plugin


def createPlugin():
    """
    Creates the plugin and returns it
    """

    proPlugin = Plugin(id="NBDSuitePro")

    # ========== Blocks ========== #

    # General
    from Blocks.General import generalBlock  # type: ignore

    proPlugin.addBlock(generalBlock)

    # Topology Extractor
    from Blocks.TopologyExtractor import topologyExtractorBlock  # type: ignore

    proPlugin.addBlock(topologyExtractorBlock)

    # Topology Selector
    from Blocks.TopologySelector import topologySelectorBlock  # type: ignore

    proPlugin.addBlock(topologySelectorBlock)

    # Topology Retriever
    from Blocks.TopologyRetriever import topologyRetrieverBlock  # type: ignore

    proPlugin.addBlock(topologyRetrieverBlock)

    # Conformational selector
    from Blocks.ConformationSelector import conformationSelectorBlock  # type: ignore

    proPlugin.addBlock(conformationSelectorBlock)

    # Alphafold
    from Blocks.AlphaFold import alphafoldBlock  # type: ignore

    proPlugin.addBlock(alphafoldBlock)

    # Topology Fixer
    from Blocks.TopologyFixer import topologyFixerBlock  # type: ignore

    proPlugin.addBlock(topologyFixerBlock)

    # LigPrep
    from Blocks.LigPrep import ligPrepBlock  # type: ignore

    proPlugin.addBlock(ligPrepBlock)

    # ProtPrep
    from Blocks.ProtPrep import protPrepBlock  # type: ignore

    proPlugin.addBlock(protPrepBlock)

    # Topology merger
    from Blocks.TopologyMerger import topologyMergerBlock  # type: ignore

    proPlugin.addBlock(topologyMergerBlock)

    # Topology truncator
    from Blocks.TopologyTruncator import topologyTruncatorBlock  # type: ignore

    proPlugin.addBlock(topologyTruncatorBlock)

    # Topology untruncator
    from Blocks.TopologyUntruncator import topologyUntruncatorBlock  # type: ignore

    proPlugin.addBlock(topologyUntruncatorBlock)

    # Glide docking
    from Blocks.GlideDocking import glideDockingBlock  # type: ignore

    proPlugin.addBlock(glideDockingBlock)

    # RDock docking
    from Blocks.rDockDocking import rdockDockingBlock  # type: ignore

    proPlugin.addBlock(rdockDockingBlock)

    # PELE simulation
    from Blocks.PELESimulation import PELESimulationBlock  # type: ignore

    proPlugin.addBlock(PELESimulationBlock)

    # AdaptivePELE simulation
    from Blocks.AdaptivePELESimulation import AdaptivePELESimulationBlock  # type: ignore

    proPlugin.addBlock(AdaptivePELESimulationBlock)

    # Launcher
    from Blocks.NBDSuiteLauncher import launcherBlock  # type: ignore

    proPlugin.addBlock(launcherBlock)

    return proPlugin


plugin = createPlugin()
