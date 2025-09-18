// React hooks
import {
  ImgHTMLAttributes,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

// Types for TypeScript
import { Block } from "../flow.types";

// Horus components
import { BlockView, BreakLongUnderscoreNames } from "../Blocks/block.view";
import { MovingChevron } from "../../reusable";
import RotatingLines from "../../RotatingLines/rotatinglines";
import AppButton from "../../appbutton";

// Socket.io to fetch new blocks
import { socket } from "../../../Utils/socket";

// Horus settings
import { horusGet } from "../../../Utils/utils";

// CSS
import "../Blocks/block.css";
import { SearchComponent } from "@/Components/Search/Search";
import PluginsIcon from "@/Components/Toolbar/Icons/Plugins";
import { useQuery } from "@tanstack/react-query";
import { getPluginLogo } from "@/Components/logo";
import { useSettings } from "@/Main/app";

// Icons
import { IconChevronsUp, IconPlus, IconSelector } from "@tabler/icons-react";
import {
  DockContext,
  PANEL_REGISTRY,
  addPanel
} from "@/Components/MainApp/PanelView";
import { useUser } from "@/Login/profile";

function PluginLogo({
  pluginID,
  ...rest
}: ImgHTMLAttributes<HTMLImageElement> & { pluginID: string }) {
  const { data } = useQuery({
    queryKey: [`pluginLogo-${pluginID}`],
    queryFn: () => getPluginLogo({ pluginID })
  });
  return data ? (
    <img {...rest} src={data}></img>
  ) : (
    <PluginsIcon className={rest.className} />
  );
}

/**
 * Renders the block list view component, which displays a list of draggable blocks that can be added to the flow builder canvas.
 * @param flowBuilderController The controller for the flow builder
 * @returns The block list view component
 */
export function BlockRegistry() {
  // View state
  const [filteredBlocks, setFilteredBlocks] = useState<Array<Block>>([]);
  const [search, setSearch] = useState<string>("");

  /**
   * Fetches the list of available blocks from the server.
   * @returns A promise that resolves to an array of Block objects.
   */
  const fetchBlocks = async () => {
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
        variableConnectionsReference: []
      };
      blockList.push(newBlock);
    });

    return blockList;
  };

  const { data: blocks, isLoading: loadingBlocks } = useQuery({
    queryKey: ["blocklist"],
    queryFn: fetchBlocks
  });

  const { userData } = useUser();

  /**
   * Filters the list of blocks based on a search query.
   * @param query - The search query to filter the blocks by.
   * @param blockList - The list of blocks to filter.
   * @returns An array of Block objects that match the search query.
   */
  const filterBlocks = useCallback(
    (query: string | null) => {
      if (!query || query === "") {
        setFilteredBlocks(blocks ?? []);
        return;
      }

      const filtered = blocks?.filter((block) => {
        const lowerQuery = query.toLowerCase();
        const blockID = block.id;
        const blockName = block.name.toLowerCase();
        const blockPlugin = block.plugin.name.toLowerCase();
        const blockDescription = block.description.toLowerCase();
        return (
          blockID.startsWith(lowerQuery) ||
          blockName.includes(lowerQuery) ||
          blockPlugin.includes(lowerQuery) ||
          blockDescription.includes(lowerQuery)
        );
      });

      setFilteredBlocks(filtered ?? []);
    },
    [blocks]
  );

  // Update the filtered blocks when the search term changes
  useEffect(() => {
    search ? filterBlocks(search) : setFilteredBlocks(blocks ?? []);
  }, [search, blocks, filterBlocks]);

  // Side effects
  useEffect(() => {
    // Add a socket listener to update the block list after a plugin is installed/uninstalled
    socket.on("pluginChanges", fetchBlocks);

    return () => {
      socket.off("pluginChanges", fetchBlocks);
    };
  }, []);

  const [showAllSignal, setShowAllSignal] = useState(0);
  const [collapseAllSignal, setCollapseAllSignal] = useState(0);
  const [turn, setTurn] = useState(0);

  const { dockApi } = useContext(DockContext);

  useEffect(() => {
    // Toggle the turn state to switch between showing all and collapsing all blocks
    setTurn((prevTurn) => prevTurn + 1);
  }, [showAllSignal, collapseAllSignal]);

  // Render
  return (
    <div className="block-sidebar overflow-y-auto h-full min-w-[200px]">
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
              zIndex: 1
            }}
          >
            <div className="flex flex-row items-center justify-between w-full">
              <div className="flow-title">Blocks</div>
              <div className="flex flex-row flex-wrap justify-end items-center gap-2 pb-2">
                {turn % 2 === 0 ? (
                  <AppButton
                    action={() => setShowAllSignal(showAllSignal + 1)}
                    title="Show all blocks"
                  >
                    <IconSelector />
                  </AppButton>
                ) : (
                  <AppButton
                    title="Collapse all blocks"
                    action={() => {
                      setCollapseAllSignal(collapseAllSignal + 1);
                    }}
                  >
                    <IconChevronsUp />
                  </AppButton>
                )}
                {(window.horusInternal.webApp === undefined ||
                  (window.horusInternal.webApp?.allowCustomBlocks &&
                    userData?.admin)) && (
                  <AppButton
                    title="New custom block"
                    action={() => {
                      addPanel({
                        dockApi,
                        component: PANEL_REGISTRY.blockEditor.component,
                        panelID: PANEL_REGISTRY.blockEditor.id
                      });
                    }}
                  >
                    <IconPlus />
                  </AppButton>
                )}
              </div>
            </div>
            <SearchComponent
              value={search}
              placeholder="Search blocks..."
              onChange={(event) => {
                const value = event.target.value;

                if (value) {
                  setShowAllSignal(showAllSignal + 1);
                } else {
                  setCollapseAllSignal(collapseAllSignal + 1);
                }

                setSearch(value);
              }}
              showIcon={false}
            />
            <hr
              style={{
                marginTop: "10px",
                marginBottom: "5px"
              }}
            ></hr>
          </div>
          <PluginBlocksGroupList
            key={filteredBlocks.map((block) => block.id).join("-")}
            blocks={filteredBlocks}
            showAllSignal={showAllSignal}
            collapseAllSignal={collapseAllSignal}
          />
        </>
      )}
    </div>
  );
}

function PluginBlocksGroupList({
  blocks,
  showAllSignal,
  collapseAllSignal
}: {
  blocks: Block[];
  collapseAllSignal: number;
  showAllSignal: number;
}) {
  const groupBlocksByPlugin = () => {
    let groupedBlocks: { [key: string]: Block[] } = {};

    blocks.forEach((block) => {
      // If the block is custom (no plugin), group it under "Custom Blocks"
      if (block.isCustom) {
        if (!groupedBlocks["Custom Blocks"]) {
          groupedBlocks["Custom Blocks"] = [];
        }
        groupedBlocks["Custom Blocks"].push(block);
        return;
      }

      // Otherwise, group by plugin ID
      if (!groupedBlocks[block.plugin.id]) {
        groupedBlocks[block.plugin.id] = [];
      }
      groupedBlocks[block.plugin.id]?.push(block);
    });

    // Sort the Plugins by name
    groupedBlocks = Object.entries(groupedBlocks)
      .sort((a, b) => {
        return a[0].localeCompare(b[0]);
      })
      .reduce(
        (acc, [key, value]) => {
          acc[key] = value;
          return acc;
        },
        {} as { [key: string]: Block[] }
      );

    return groupedBlocks;
  };

  if (blocks.length === 0) {
    return (
      <div className="p-2 flex flex-col items-center justify-center">
        No blocks...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[2px] p-2 ">
      {Object.entries(groupBlocksByPlugin()).map(
        ([pluginID, groupedBlocks]) => {
          return (
            <PluginBlocksGroup
              key={pluginID}
              showAllSignal={showAllSignal}
              collapseAllSignal={collapseAllSignal}
              pluginID={pluginID}
              groupedBlocks={groupedBlocks}
            />
          );
        }
      )}
    </div>
  );
}

function useCollapsible({
  collapseAllSignal,
  showAllSignal
}: {
  collapseAllSignal: number;
  showAllSignal: number;
}) {
  const setings = useSettings();

  const [show, setShow] = useState<boolean>(
    setings?.["collapseBlocks"]?.value ? false : true
  );

  useEffect(() => {
    setShow(false);
  }, [collapseAllSignal]);

  useEffect(() => {
    setShow(true);
  }, [showAllSignal]);

  useEffect(() => {
    setShow(!setings?.["collapseBlocks"]?.value);
  }, [setings]);

  const toggle = () => setShow((currentShow) => !currentShow);

  return { show, toggle };
}

function PluginBlocksGroup({
  groupedBlocks,
  pluginID,
  collapseAllSignal,
  showAllSignal
}: {
  groupedBlocks: Block[];
  pluginID: string;
  collapseAllSignal: number;
  showAllSignal: number;
}) {
  const { show, toggle } = useCollapsible({ collapseAllSignal, showAllSignal });

  const { categories, uncategorized } = useMemo(() => {
    let categories: Record<string, Block[]> = {};
    const uncategorized: Block[] = [];
    groupedBlocks.forEach((b) => {
      if (b.category) {
        if (b.category in categories) {
          categories[b.category]!.push(b);
        } else {
          categories[b.category] = [b];
        }
      } else {
        uncategorized.push(b);
      }
    });

    // Sort the categories alphabetically
    categories = Object.entries(categories)
      .sort((a, b) => {
        return a[0].localeCompare(b[0]);
      })
      .reduce(
        (acc, [key, value]) => {
          acc[key] = value;
          return acc;
        },
        {} as Record<string, Block[]>
      );

    return { categories, uncategorized };
  }, [groupedBlocks]);

  return (
    <div className="flex flex-col gap-[2px] min-w-[200px]">
      <div
        className="!text-white horus-container block-list-plugin animated-gradient flex flex-row justify-between items-center px-2 plugin-group"
        onClick={toggle}
      >
        <PluginLogo pluginID={pluginID} className="object-contain w-5 h-5" />
        <div className="flex flex-row justify-between items-center w-full pl-2">
          <BreakLongUnderscoreNames
            name={
              pluginID === "Custom Blocks"
                ? pluginID
                : (groupedBlocks[0]?.plugin.name ?? "Unnamed Plugin")
            }
          />
          <MovingChevron down={show} />
        </div>
      </div>
      <div
        className={`ml-4 flex flex-col gap-[2px] transition-all duration-300 ${
          show ? "opacity-100" : "opacity-0 hidden"
        }`}
      >
        {uncategorized.map((block) => {
          return <BlockView key={block.id} block={block} />;
        })}
        {Object.keys(categories).map((k) => {
          return (
            <_CategoryView
              key={k}
              category={k}
              blocks={categories[k]!}
              collapseAllSignal={collapseAllSignal}
              showAllSignal={showAllSignal}
            />
          );
        })}
      </div>
    </div>
  );
}

function _CategoryView({
  category,
  blocks,
  collapseAllSignal,
  showAllSignal
}: {
  category: string;
  blocks: Block[];
  collapseAllSignal: number;
  showAllSignal: number;
}) {
  const { show, toggle } = useCollapsible({ collapseAllSignal, showAllSignal });

  return (
    <div className="flex flex-col gap-[2px]">
      <div
        className="orange-container animated-gradient flex flex-row justify-between items-center px-2 plugin-group"
        onClick={toggle}
      >
        <div className="flex flex-row justify-between items-center w-full pl-2">
          <BreakLongUnderscoreNames name={category} />
          <MovingChevron down={show} />
        </div>
      </div>
      <div
        className={`ml-4 flex flex-col gap-[2px] transition-all duration-300 ${
          show ? "opacity-100" : "opacity-0 hidden"
        }`}
      >
        {blocks.map((b) => {
          return <BlockView key={b.id} block={b} />;
        })}
      </div>
    </div>
  );
}
