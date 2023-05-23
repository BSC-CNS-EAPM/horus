import { ItemTypes, Block, BlockProps } from "./Block";
import { DndProvider, useDrop } from "react-dnd";
import { useEffect, useState } from "react";
import { DndContext } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { horusGet } from "../../Utils/utils";
import Loading from "../Loading";

function FlowReciver() {

    const [blocks, setBlocks] = useState<BlockProps[]>([])

    const [, drop] = useDrop(
        () => ({
            accept: ItemTypes.BLOCK,
            drop: (item: BlockProps) => addBlock(item),
        }),
        [blocks],
    )

    const addBlock = (block: BlockProps) => {
        // Add the block only if its not there
        // if (!blocks.find(b => b.id === block.id)) {
        //     setBlocks([...blocks, block])
        // }
        setBlocks([...blocks, block])
    }

    // Remove the block from the list
    const removeBlock = (block: BlockProps) => {
        setBlocks(blocks.filter(b => b.id !== block.id))
    }

    return (
        <div ref={drop} className="current-flow">
            <h1>Current flow</h1>
            <div className="flex flex-col align-items-center">
                {blocks.map((block, index) => (
                    <div style={{
                        marginBottom: "1rem"
                    }}>
                        <Block key={index} {...block} />
                    </div>
                ))}
            </div>
        </div>
    )
}

export default function FlowBuilder() {

    // Fetch the blocks from the server api
    const [blocks, setBlocks] = useState<BlockProps[]>([])

    useEffect(() => {
        async function fetchBlocks() {
            return (await horusGet("/plugins/listblocks")).json()
        }

        fetchBlocks().then(fb => {
            // Parse the blocks
            fb = fb.map((b: any) => ({
                id: b.id,
                name: b.name,
                description: b.description,
                plugin: b.plugin,
                variables: b.variables,
            }))
            setBlocks(fb)
        }
        )
    }, [])

    return (
        <DndProvider backend={HTML5Backend}>
            <div className="m-auto flex flex-row">
                <div className="block-sidebar">
                    <h1>Blocks</h1>
                    {
                        blocks.length === 0 ? <Loading /> : blocks.map((block, index) => (
                            <div style={{
                                marginBottom: "1rem"
                            }}>
                                <Block key={index} {...block} />
                            </div>
                        ))
                    }
                </div>
                <FlowReciver />
            </div>
        </DndProvider>
    )
}