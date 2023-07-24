import { horusGet } from "../../Utils/utils";
import { useEffect, useState } from "react";
import { BlockProps } from "./flow_builder_interfaces";
import { Block, DraggableBlock } from "./block";
import RotatingLines from "../RotatingLines/rotatinglines";
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
        inputs: b.inputs,
        outputs: b.outputs,
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
      <div className="flow-title">Blocks</div>
      <SearchComponent
        placeholder="Search blocks..."
        onChange={(e) => setQuery(e.target.value)}
        showIcon={false}
      />
      {blocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full">
          <RotatingLines />
          Loading blocks...
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
                  <div className="plugin-name-block">{block.plugin}</div>
                </div>
              )}
              <DraggableBlock {...block} />
              {isLast && <div className="pb-4"></div>}
            </div>
          );
        })
      )}
    </div>
  );
}

export { BlockList };
