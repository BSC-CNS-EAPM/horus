from HorusAPI import Plugin


def createPlugin():
    plugin = Plugin(id="NBDSuitePro")

    # ========== Blocks ========== #

    # General
    from Blocks.General import generalBlock  # type: ignore

    plugin.addBlock(generalBlock)

    # Topology Extractor
    from Blocks.TopologyExtractor import topologyExtractorBlock  # type: ignore

    plugin.addBlock(topologyExtractorBlock)

    # Topology Fixer
    from Blocks.TopologyFixer import topologyFixerBlock  # type: ignore

    plugin.addBlock(topologyFixerBlock)

    return plugin


plugin = createPlugin()
