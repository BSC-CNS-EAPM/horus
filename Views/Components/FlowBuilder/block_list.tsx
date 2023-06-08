import { horusGet } from "../../Utils/utils";
import { useEffect, useState } from "react";
import { BlockProps } from "./flow_builder_interfaces";
import { Block } from "./block";

function BlockList() {
  // Fetch the blocks from the server api
  const [blocks, setBlocks] = useState<BlockProps[]>([]);

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
      }));
      setBlocks(fb);
    });
  }, []);

  return (
    <div className="block-sidebar">
      <h1>Blocks</h1>
      <div>
        {blocks.length === 0
          ? "No blocks"
          : blocks.map((block, index) => {
              const prevBlock = index > 0 ? blocks[index - 1] : null;
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
                  <Block {...block} />
                  {/* Now place the sub-blocks */}
                  {block.subBlocks &&
                    block.subBlocks.map((subBlock) => {
                      return (
                        <Block
                          key={subBlock.id}
                          {...subBlock}
                          isSubBlock={true}
                          parent={block}
                        />
                      );
                    })}
                </div>
              );
            })}
      </div>
    </div>
  );
}

export { BlockList };
