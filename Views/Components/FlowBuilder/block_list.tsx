import { horusGet } from "../../Utils/utils";
import { useEffect, useState } from "react";
import { BlockProps } from "./flow_builder_interfaces";
import { Block, DraggableBlock } from "./block";
import { RotatingLines } from "react-loader-spinner";
import { SearchComponent } from "../Toolbar/toolbar";

function getFilteredItems(query, blocks: BlockProps[]) {
  if (!query) {
    return blocks;
  }

  return blocks.filter((block) => {
    const blockName = block.name.toLowerCase();
    const blockPlugin = block.plugin.toLowerCase();
    return (
      blockName.includes(query.toLowerCase()) ||
      blockPlugin.includes(query.toLowerCase())
    );
  });
}

function BlockList() {
  // Fetch the blocks from the server api
  const [blocks, setBlocks] = useState<BlockProps[]>([]);

  const [query, setQuery] = useState<string>("");

  const filteredBlocks = getFilteredItems(query, blocks);

  useEffect(() => {
    async function fetchBlocks() {
      return (await horusGet("/plugins/listblocks")).json();
    }

    fetchBlocks().then((fb) => {
      // Parse the blocks
      fb = fb.map((b: any) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        plugin: b.plugin,
        variables: b.variables,
        isPlaced: false,
        subBlocks: b.subBlocks,
        coords: {
          x: 0,
          y: 0,
        },
      }));
      setBlocks(fb);
    });
  }, []);

  return (
    <div className="block-sidebar">
      <h1>Blocks</h1>
      <SearchComponent
        placeholder="Search blocks..."
        onChange={(e) => setQuery(e.target.value)}
        showIcon={false}
      />
      <div>
        {blocks.length === 0 ? (
          <div
            className="flex flew-column gap-1 justify-center align-items-center"
            style={{
              marginTop: "calc(50vh - 6rem)",
            }}
          >
            <RotatingLines
              strokeColor="grey"
              strokeWidth="5"
              animationDuration="0.75"
              width="40"
            />
            Loading blocks...
          </div>
        ) : (
          filteredBlocks.map((block, index) => {
            const prevBlock = index > 0 ? filteredBlocks[index - 1] : null;
            const isDifferentPlugin =
              prevBlock && prevBlock.plugin !== block.plugin;
            return (
              <div key={block.id}>
                {(isDifferentPlugin || index == 0) && (
                  <div>
                    <div className="block-separator"></div>
                    <div className="plugin-name-block">{block.plugin}</div>
                  </div>
                )}
                <DraggableBlock {...block} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export { BlockList };
