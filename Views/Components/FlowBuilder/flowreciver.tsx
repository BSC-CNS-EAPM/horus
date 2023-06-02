import { ItemTypes, Block } from "./block";
import { BlockProps } from "../../Interfaces/plugins";
import { useDrop } from "react-dnd";
import { useEffect, useState, useCallback } from "react";
import { horusPost } from "../../Utils/utils";
import { HorusModal } from "../reusable";
import update from 'immutability-helper'

// Import animejs
import anime from "animejs";


interface FlowReciverProps {
    openFlow?: string;
    flowName: string;
}


var placedID = 0

function FlowReciver(props: FlowReciverProps) {

    // Block states
    const [blocks, setBlocks] = useState<BlockProps[]>([])

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [modal, setModal] = useState(<div></div>);
    const [flowName, setFlowName] = useState("New flow")

    // Executing state
    const [executingAll, setExecutingAll] = useState(false)

    // Saved state
    const [saved, setSaved] = useState(false)

    // Block animation state (id of the block)
    const [blockAnimation, setBlockAnimation] = useState("")

    // Use a useEffect to load the animation when the blockAnimation changes
    useEffect(() => {
        if (blockAnimation !== "") {
            // Add rubber bounce effect to the block
            const blockElement = document.getElementById(blockAnimation)

            anime({
                targets: blockElement,
                scaleX: [
                    { value: 3, easing: 'easeInOutSine', duration: 50 },
                    { value: 0.9, easing: 'easeInOutSine', duration: 50 },
                    { value: 1.05, easing: 'easeInOutSine', duration: 50 },
                    { value: 1, easing: 'easeInOutSine', duration: 50 },
                ], scaleY: [
                    { value: 1.1, easing: 'easeInOutSine', duration: 50 },
                    { value: 0.9, easing: 'easeInOutSine', duration: 50 },
                    { value: 1.05, easing: 'easeInOutSine', duration: 50 },
                    { value: 1, easing: 'easeInOutSine', duration: 50 },
                ],
            });
        }
    }, [blockAnimation])

    const [, drop] = useDrop(
        () => ({
            accept: ItemTypes.BLOCK,
            drop: (item: BlockProps) => {
                addBlock(item)
            }
        }),
        [blocks],
    )

    const moveBlockHandler = (dragIndex: number, hoverIndex: number) => {
        setBlocks(prevState => {
            const dragBlock = prevState[dragIndex];
            if (dragBlock) {
                const copiedState = [...prevState];

                // Remove the block from the old position
                const prevItem = copiedState.splice(hoverIndex, 1, dragBlock);

                // Remove block on dragIndex and put it on hoverIndex
                copiedState.splice(dragIndex, 1, prevItem[0]);

                return copiedState;
            }
            return prevState;
        });
    };


    // Remove the block from the list
    const removeBlock = (block: BlockProps) => {
        setBlocks(prevBlocks => {
            // Filter out the block to be removed
            const updatedBlocks = prevBlocks.filter(item => item.placedID !== block.placedID);

            // Set the flow as not saved because it has changed
            setSaved(false);

            return updatedBlocks;
        });
    };

    const addBlock = (block: BlockProps) => {

        // If the block is already placed, move it to the new position
        if (block.isPlaced) {
            return
        }

        // Set the placedID
        const newBlock = { ...block, placedID: placedID }

        // Set the new block as placed
        newBlock.isPlaced = true

        // Increment the placedID
        placedID++

        // Add the moveBlock function to the block
        newBlock.moveBlock = moveBlockHandler

        // Add the removeBlock function to the block
        newBlock.deleteBlock = removeBlock

        setBlocks([...blocks, newBlock])

        // Set the flow as not saved because it has changed
        setSaved(false)

        // Set the animation
        setBlockAnimation(`${newBlock.placedID}-${newBlock.id}`)

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

    const executeBlock = async (block) => {

        //Set the running button
        setBlocks(blocks.map(b => {
            if (b.placedID === block.placedID) {
                b.isRunning = true
            }
            return b
        }))

        // Get the updated block variables
        const variables = block.variables.reduce((acc, variable) => {
            // Return a dictionary with the variable name and value {name: value}
            acc[variable.id] = variable.value
            return acc
        }, {})


        const body = JSON.stringify({
            blockID: block.id,
            variables: variables
        })

        const headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

        const response = await horusPost("/plugins/executeblock", headers, body)

        try {
            const data = await response.json()
            // Check any error status code
            if (!data.ok) {
                throw new Error(data.message)
            }
            else {
                setBlocks(blocks.map(b => {
                    if (b.placedID === block.placedID) {
                        b.runError = false
                    }
                    return b
                }))
            }
        }
        catch (e) {
            console.log(e)
            setBlocks(blocks.map(b => {
                if (b.placedID === block.placedID) {
                    b.runError = true
                }
                return b
            }))
        }

        // Set the running button
        setBlocks(blocks.map(b => {
            if (b.placedID === block.placedID) {
                b.isRunning = false
            }
            return b
        }
        ))
    }

    const handleExecuteAll = async () => {
        // Set the executing state to true
        setExecutingAll(true)

        // Loop over the blocks and execute them
        for (let i = 0; i < blocks.length; i++) {
            const b = blocks[i]
            await executeBlock(b)
        }

        // Set the executing state to false
        setExecutingAll(false)
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
                <input type="text" id="flow-name" placeholder={props.flowName} onChange={onNameChange} />
                <button onClick={handleSave}>
                    {
                        saved ? (<svg xmlns="http://www.w3.org/2000/svg" fill="green" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                        </svg>
                        ) : (<svg xmlns="http://www.w3.org/2000/svg" fill="orange" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                        </svg>
                        )
                    }
                </button>
                <button onClick={handleExecuteAll}>
                    {executingAll ? (<svg xmlns="http://www.w3.org/2000/svg" fill="red" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9.563C9 9.252 9.252 9 9.563 9h4.874c.311 0 .563.252.563.563v4.874c0 .311-.252.563-.563.563H9.564A.562.562 0 019 14.437V9.564z" />
                    </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="green" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
                        </svg>
                    )}
                </button>
            </h1>
            <div className="flex flex-col align-items-center">
                {blocks.map((block, index) => (
                    <div key={block.placedID} style={{
                        marginBottom: "1rem"
                    }}>
                        <Block key={
                            `${block.placedID}-${block.id}`
                        } {...block} onChange={onblockChange} execute={executeBlock} index={index} />
                    </div>
                ))}
            </div>
        </div>
    )
}

export { FlowReciver }