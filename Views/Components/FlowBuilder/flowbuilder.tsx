import { Block } from "./block";
import { BlockProps } from "../../Interfaces/plugins";
import { DndProvider } from "react-dnd";
import { useEffect, useState, useCallback } from "react";
import { HTML5Backend } from "react-dnd-html5-backend";
import { horusGet } from "../../Utils/utils";
import Loading from "../loading";

// Import animejs
import anime from "animejs";

// Import the flow reciver
import { FlowReciver } from "./flowreciver";

interface FlowBuilderProps {
    openFlow?: string;
}

export default function FlowBuilder(props: FlowBuilderProps) {

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
                isPlaced: false,
                subBlocks: b.subBlocks,
            }))
            setBlocks(fb)
        }
        )

        // If the open param is set, open the saved flow
        // WIP
        if (props.openFlow) {
            // Fetch the flow
            // If the flow is found, set the blocks to the flow blocks
        }

    }, [])

    return (
        <DndProvider backend={HTML5Backend}>
            <div className="m-auto flex flex-row h-100">
                <div className="block-sidebar">
                    <h1>Blocks</h1>
                    <div>
                        {
                            blocks.length === 0 ? <Loading /> : blocks.map((block, index) => {
                                const prevBlock = index > 0 ? blocks[index - 1] : null
                                const isDifferentPlugin = prevBlock && prevBlock.plugin !== block.plugin
                                return (
                                    <>
                                        {(isDifferentPlugin || index == 0) &&
                                            <div>
                                                <div className="block-separator"></div>
                                                <div className="plugin-name-block">
                                                    {block.plugin}
                                                </div>
                                            </div>
                                        }
                                        <Block {...block} />
                                        {/* Now place the sub-blocks */}
                                        {block.subBlocks && block.subBlocks.map((subBlock) => {
                                            return (
                                                <Block {...subBlock} isSubBlock={true} parent={block} />
                                            )
                                        })}

                                    </>
                                )
                            })
                        }
                    </div>
                </div>
                <FlowReciver
                    openFlow={props.openFlow}
                    flowName="New Flow"
                />
            </div>
        </DndProvider>
    )
}