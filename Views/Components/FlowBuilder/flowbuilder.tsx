import { ItemTypes, Block, BlockProps } from "./block";
import { DndProvider, useDrop } from "react-dnd";
import { useEffect, useState } from "react";
import { DndContext } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { horusGet, horusPost } from "../../Utils/utils";
import Loading from "../loading";
import HorusModal from "../reusable";

interface FlowReciverProps {
    openFlow?: string;
    flowName: string;
}

function FlowReciver(props: FlowReciverProps) {

    const [blocks, setBlocks] = useState<BlockProps[]>([])

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [modal, setModal] = useState(<div></div>);
    const [flowName, setFlowName] = useState("New flow")

    // Saved state
    const [saved, setSaved] = useState(false)

    const [, drop] = useDrop(
        () => ({
            accept: ItemTypes.BLOCK,
            drop: (item: BlockProps) => {
                // Set the block as placed
                item.isPlaced = true
                addBlock(item)

                // Set the flow as not saved because it has changed
                setSaved(false)
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

    const handleSave = async () => {
        // Tell the server to save the flow
        // If the flow is saved, close the modal

        try {
            const currentFlowName = flowName
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
                // Throw an error
                throw new Error(data.message)
            }
            else {
                setSaved(true)
                setFlowName(currentFlowName)
            }
        }
        catch (e) {
            const header = (<div>Error!</div>)
            const body = (<div>{e}</div>)
            const footer = (<div>There was an error saving the flow</div>)
            const modal = (<HorusModal show={showModal} header={header} body={body} footer={footer} />)
            setModal(modal)
            setShowModal(true)
            return
        }
    }

    const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFlowName(e.target.value)
        setSaved(false)
    }

    const onblockChange = () => (setSaved(false))

    return (
        <div ref={drop} className="current-flow">
            {modal}
            <h1 className="flex flex-row">
                <input type="text" id="flow-name" placeholder={props.flowName} onChange={onNameChange}/>
                <button onClick={handleSave}>
                {
                    saved ? (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="green" className="w-5 h-5">
                        <path d="M2 3a1 1 0 00-1 1v1a1 1 0 001 1h16a1 1 0 001-1V4a1 1 0 00-1-1H2z" />
                        <path fillRule="evenodd" d="M2 7.5h16l-.811 7.71a2 2 0 01-1.99 1.79H4.802a2 2 0 01-1.99-1.79L2 7.5zM7 11a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                    ) : (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="orange" className="w-5 h-5">
                        <path fillRule="evenodd" d="M2 3a1 1 0 00-1 1v1a1 1 0 001 1h16a1 1 0 001-1V4a1 1 0 00-1-1H2zm0 4.5h16l-.811 7.71a2 2 0 01-1.99 1.79H4.802a2 2 0 01-1.99-1.79L2 7.5zM10 9a.75.75 0 01.75.75v2.546l.943-1.048a.75.75 0 111.114 1.004l-2.25 2.5a.75.75 0 01-1.114 0l-2.25-2.5a.75.75 0 111.114-1.004l.943 1.048V9.75A.75.75 0 0110 9z" clipRule="evenodd" />
                    </svg>
                    )
                }
                </button>
            </h1>
            <div className="flex flex-col align-items-center">
                {blocks.map((block, index) => (
                    <div style={{
                        marginBottom: "1rem"
                    }}>
                        <Block key={index} {...block} onChange={onblockChange}/>
                    </div>
                ))}
            </div>
        </div>
    )
}

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
                        blocks.length === 0 ? <Loading /> : blocks.map((block, index) => (
                            <div style={{
                                marginBottom: "1rem"
                            }}>
                                <Block key={index} {...block} />
                            </div>
                        ))
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