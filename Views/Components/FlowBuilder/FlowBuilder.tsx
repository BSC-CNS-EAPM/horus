import { ItemTypes, Block, BlockProps } from "./Block";
import { useDrop } from "react-dnd";
import { useState } from "react";

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
        setBlocks([...blocks, block])
    }

    return (
        <div ref={drop} style={{ width: 200, height: 200 }}>
            <h1>FlowBuilder</h1>
            {blocks.map((block, index) => (
                <Block key={index} {...block} />
            ))}
        </div>
    )
}

const sampleBlocks: BlockProps[] = [
    {
        id: "1",
        name: "Block 1",
        description: "This is block 1",
    },
    {
        id: "2",
        name: "Block 2",
        description: "This is block 2",
    },
]

export default function FlowBuilder() {



    return (
        <div>
            <FlowReciver />
            <div style={{ display: "flex" }}>
                
        </div>
    )
}