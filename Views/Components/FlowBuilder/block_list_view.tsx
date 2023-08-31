// React hooks
import { useEffect, useRef, useState } from "react";

// Types for TypeScript
import { Block } from "./flow_builder_types";
import { FlowBuilderController } from "./flow_builder_hooks";

// React components
import { DraggableBlockView } from "./block_view";
import RotatingLines from "../RotatingLines/rotatinglines";
import { SearchComponent } from "../Toolbar/toolbar";

// Socket.io to fetch new blocks
import { socket } from "../../Utils/socket";

// CSS
import "./block.css";

type BlockListViewProps = {
  flowBuilderController: FlowBuilderController;
};

/**
 * Renders the block list view component, which displays a list of draggable blocks that can be added to the flow builder canvas.
 * @param flowBuilderController The controller for the flow builder
 * @returns The block list view component
 */
function BlockListView({ flowBuilderController }: BlockListViewProps) {
  // View state
  const blockList = useRef<Array<Block>>([]);
  const [filteredBlocks, setFilteredBlocks] = useState<Array<Block>>([]);
  const [loadingBlocks, setLoadingBlocks] = useState<boolean>(true);

  // Fetch the blocks from the server api
  const fetchBlocks = async () => {
    setLoadingBlocks(true);

    const fetchedBlocks = await flowBuilderController.fetchBlocks();

    blockList.current = fetchedBlocks;
    setFilteredBlocks(fetchedBlocks);

    setLoadingBlocks(false);
  };

  // Filter the blocks
  const filterBlocks = (search: string) => {
    setFilteredBlocks(
      flowBuilderController.filterBlocks(search, blockList.current)
    );
  };

  // Side effects
  useEffect(() => {
    // Fetch the blocks from the server api
    fetchBlocks();

    // Add a scoket listener to update the block list after a plugin is installed/uninstalled
    socket.on("pluginChanges", fetchBlocks);

    return () => {
      socket.off("pluginChanges", fetchBlocks);
    };
  }, []);

  // Views
  const loadingBlocksView = (
    <div className="blocks-loading">
      <RotatingLines />
      Loading blocks...
    </div>
  );

  const loadedBlocksView =
    filteredBlocks.length === 0 ? (
      <div className="flex flex-col items-center justify-center h-full">
        No blocks...
      </div>
    ) : (
      filteredBlocks.map((block, index) => {
        const prevBlock = index > 0 ? filteredBlocks[index - 1] : null;
        const isDifferentPlugin =
          prevBlock && prevBlock.plugin !== block.plugin;
        const isLast = index === filteredBlocks.length - 1;
        return (
          <div key={block.id}>
            {(isDifferentPlugin || index == 0) && (
              <div>
                <div className="block-separator"></div>
                <div className="plugin-name-block">{block.plugin.name}</div>
              </div>
            )}
            <DraggableBlockView block={block} />
            {isLast && <div className="pb-4"></div>}
          </div>
        );
      })
    );

  // Render
  return (
    <div className="block-sidebar">
      <div className="flow-title">Blocks</div>
      <SearchComponent
        placeholder="Search blocks..."
        onChange={(event) => filterBlocks(event.target.value)}
        showIcon={false}
      />
      {loadingBlocks ? loadingBlocksView : loadedBlocksView}
    </div>
  );
}

export { BlockListView };
