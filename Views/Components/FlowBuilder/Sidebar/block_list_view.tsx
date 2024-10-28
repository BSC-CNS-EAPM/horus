// React hooks
import { useEffect, useRef, useState } from "react";

// Types for TypeScript
import { Block } from "../flow.types";

// Horus components
import { BlockView } from "../Blocks/block.view";
import { SearchComponent } from "../../Toolbar/toolbar";
import { MovingChevron } from "../../reusable";
import RotatingLines from "../../RotatingLines/rotatinglines";
import AppButton from "../../appbutton";

// Socket.io to fetch new blocks
import { socket } from "../../../Utils/socket";

// Horus settings
import { horusGet } from "../../../Utils/utils";

// CSS
import "../Blocks/block.css";
import { useAlert } from "../../HorusPrompt/horus_alert";

/**
 * Renders the block list view component, which displays a list of draggable blocks that can be added to the flow builder canvas.
 * @param flowBuilderController The controller for the flow builder
 * @returns The block list view component
 */
export function BlockListSidebar() {
  // View state
  const sidebarBlockList = useRef<Array<Block>>([]);
  const [filteredBlocks, setFilteredBlocks] = useState<Array<Block>>([]);
  const [loadingBlocks, setLoadingBlocks] = useState<boolean>(true);
  const [developmentMode, setDevelopmentMode] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");

  /**
   * Fetches the list of available blocks from the server.
   * @returns A promise that resolves to an array of Block objects.
   */
  const fetchBlocks = async () => {
    setLoadingBlocks(true);

    try {
      const response = await horusGet("/api/plugins/listblocks");

      const data = await response.json();

      const unparsedBlocks: Array<Block> = data.blocks;

      // Parse the data into the blockList
      const blockList: Array<Block> = [];
      unparsedBlocks.forEach((block: Block) => {
        const newBlock: Block = {
          ...block,
          isPlaced: false,
          position: { x: 0, y: 0 },
          variableConnections: [],
          variableConnectionsReference: [],
        };
        blockList.push(newBlock);
      });

      sidebarBlockList.current = blockList;
      setFilteredBlocks(sidebarBlockList.current);
    } finally {
      setLoadingBlocks(false);
    }
  };

  /**
   * Filters the list of blocks based on a search query.
   * @param query - The search query to filter the blocks by.
   * @param blockList - The list of blocks to filter.
   * @returns An array of Block objects that match the search query.
   */
  function filterBlocks(query: string | null) {
    if (!query || query === "") {
      setFilteredBlocks(sidebarBlockList.current);
      return;
    }

    const filtered = sidebarBlockList.current.filter((block) => {
      const blockName = block.name.toLowerCase();
      const blockPlugin = block.plugin.name.toLowerCase();
      const blockDescription = block.description.toLowerCase();
      return (
        blockName.includes(query.toLowerCase()) ||
        blockPlugin.includes(query.toLowerCase()) ||
        blockDescription.includes(query.toLowerCase())
      );
    });

    setFilteredBlocks(filtered);
  }

  // Update the filtered blocks when the search term changes
  useEffect(() => {
    search ? filterBlocks(search) : setFilteredBlocks(sidebarBlockList.current);
  }, [search, sidebarBlockList.current]);

  // Side effects
  useEffect(() => {
    // Set the development mode
    const devMode = window.horusSettings["developmentMode"];

    setDevelopmentMode(devMode?.value || false);

    // Fetch the blocks from the server api
    fetchBlocks();

    // Add a socket listener to update the block list after a plugin is installed/uninstalled
    socket.on("pluginChanges", fetchBlocks);

    return () => {
      socket.off("pluginChanges", fetchBlocks);
    };
  }, []);

  const horusAlert = useAlert();

  // Render
  return (
    <div className="block-sidebar overflow-y-auto h-full">
      {loadingBlocks ? (
        <div className="h-full flex flex-col gap-2 items-center justify-center">
          <RotatingLines />
          Loading blocks...
        </div>
      ) : (
        <>
          <div
            className="sticky top-0 bg-white p-2 pb-0"
            style={{
              zIndex: 1,
            }}
          >
            <div className="flex flex-row items-center justify-between w-full">
              <div className="flow-title">Blocks</div>
              {developmentMode && (
                <AppButton
                  className="m-0"
                  action={async () => {
                    setLoadingBlocks(true);
                    await horusGet("/api/plugins/reload");
                    await fetchBlocks();
                    await horusAlert("Plugins reloaded!");
                  }}
                >
                  Reload
                </AppButton>
              )}
            </div>
            <SearchComponent
              value={search}
              placeholder="Search blocks..."
              onChange={(event) => {
                setSearch(event.target.value);
              }}
              showIcon={false}
            />
            <hr
              style={{
                marginTop: "10px",
                marginBottom: "5px",
              }}
            ></hr>
          </div>
          <PluginBlocksGroupList blocks={filteredBlocks} />
        </>
      )}
    </div>
  );
}

function PluginBlocksGroupList({ blocks }: { blocks: Block[] }) {
  const groupBlocksByPlugin = () => {
    const groupedBlocks: { [key: string]: Block[] } = {};
    blocks.forEach((block) => {
      if (!groupedBlocks[block.plugin.id]) {
        groupedBlocks[block.plugin.id] = [];
      }
      groupedBlocks[block.plugin.id]?.push(block);
    });
    return groupedBlocks;
  };

  if (blocks.length === 0) {
    return (
      <div className="p-2 flex flex-col items-center justify-center h-full">
        No blocks...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      {Object.entries(groupBlocksByPlugin()).map(
        ([pluginID, groupedBlocks]) => {
          return (
            <PluginBlocksGroup key={pluginID} groupedBlocks={groupedBlocks} />
          );
        }
      )}
    </div>
  );
}

function PluginBlocksGroup({ groupedBlocks }: { groupedBlocks: Block[] }) {
  const [showBlocks, setShowBlocks] = useState<boolean>(true);

  return (
    <div className="flex flex-col gap-2">
      <div
        className="!text-white horus-container block-list-plugin animated-gradient flex flex-row justify-between p-2 plugin-group"
        onClick={() => {
          setShowBlocks(!showBlocks);
        }}
      >
        {groupedBlocks[0]?.plugin.name ?? "Unnamed Plugin"}
        <MovingChevron down={showBlocks} />
      </div>
      <div
        className={`flex flex-col gap-2 transition-all duration-300 ${
          showBlocks ? "opacity-100" : "opacity-0 hidden"
        }`}
      >
        {groupedBlocks.map((block) => {
          return <BlockView key={block.id} block={block} />;
        })}
      </div>
    </div>
  );
}
