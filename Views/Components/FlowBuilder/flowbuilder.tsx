import { ItemTypes, Block, BlockProps } from "./block";
import { DndProvider, useDrop } from "react-dnd";
import { useEffect, useState } from "react";
import { DndContext } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { horusGet, horusPost } from "../../Utils/utils";
import Loading from "../loading";
import HorusModal from "../modal";

interface FlowReciverProps {
    flowName: string;
}

function FlowReciver(props: FlowReciverProps) {

    const [blocks, setBlocks] = useState<BlockProps[]>([])

    const [, drop] = useDrop(
        () => ({
            accept: ItemTypes.BLOCK,
            drop: (item: BlockProps) => {
                // Set the block as placed
                item.isPlaced = true
                addBlock(item)
            }
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
            <h1>{props.flowName}</h1>
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

interface FlowBuilderProps {
    openFlow: boolean;
}

export default function FlowBuilder(props: FlowBuilderProps) {

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [modalBody, setModalBody] = useState(<div></div>);
    const [modalHeader, setModalHeader] = useState(<div></div>);
    const [modalFooter, setModalFooter] = useState(<div></div>);
    const [flowName, setFlowName] = useState("New flow")


    const openModalSaveFlow = () => {
        const flowNameChildren = (
            <div>
                <input type="text" className="plugin-description" id="flow-name"/>
            </div>);
        setModalHeader(<div>Save flow</div>);
        setModalBody(flowNameChildren);
        setModalFooter(<div>
            <button onClick={handleCloseModal}>Save</button>
        </div>);
    
        setShowModal(true);
    }

    const handleCloseModal = async () => {
        // Tell the server to save the flow
        // If the flow is saved, close the modal

        try {
            const currentFlowName = (document.getElementById("flow-name") as HTMLInputElement).value;
            const body = JSON.stringify({
                name: currentFlowName,
            })
            const headers = {
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
    
            const response = await horusPost("/createflow", headers, body)
    
            const data = await response.json()
    
            // Check any error status code
            if (!data.ok) {
                setModalBody(<div>{data.error}</div>)
                setModalFooter(<div>There was an error saving the flow</div>)
            }
            else {
                setFlowName(currentFlowName)
                setShowModal(false);
            }
        }
        catch (e) {
            setModalBody(<div>There was an error getting the flow name</div>)
            setModalFooter(<div>There was an error saving the flow</div>)
            return
        }
    }

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
        } else {
            openModalSaveFlow()
        }

    }, [])

    return (
        <DndProvider backend={HTML5Backend}>
            <HorusModal
                show={showModal}
                body={modalBody}
                header={modalHeader}
                footer={modalFooter}
            />

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
                <FlowReciver flowName={flowName}/>
            </div>
        </DndProvider>
    )
}