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
                isPlaced: false
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
                                return (
                                    <div key={block.id} style={{
                                        marginBottom: "1rem"
                                    }}>
                                        <Block {...block} />
                                    </div>
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