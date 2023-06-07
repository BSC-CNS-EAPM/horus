import { Block } from "./block";
import { BlockProps, FlowReciverProps } from "./flow_builder_interfaces";
import { useEffect, useState } from "react";
import { horusPost } from "../../Utils/utils";
import { HorusModal } from "../reusable";
import update from 'immutability-helper'
import { RotatingLines } from "react-loader-spinner";

// Import animejs
import anime from "animejs";

// Import the dndkit
import { DndContext, useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

var placedID = 0

function FlowReciver(props: FlowReciverProps) {

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

    const { isOver, setNodeRef } = useDroppable({
        id: 'droppable',
    });
    const style = {
        color: isOver ? 'green' : undefined,
    };

    // Set the new index of the block   
    const [activeId, setActiveId] = useState(null);

    // const moveBlockHandler = (dragIndex: number, hoverIndex: number) => {

    //     var newIndex = dragIndex;
    //     setBlocks(prevState => {
    //         const dragBlock = prevState[dragIndex];
    //         if (dragBlock) {

    //             // If the dragblock has a parent, check if the parent is the same as the hover block
    //             if (dragBlock.parent) {
    //                 if (dragBlock.parent.id === prevState[hoverIndex].id) {
    //                     return prevState;
    //                 }
    //                 // Check that if the block was placed, the parent matches
    //                 if (dragBlock.parent.id !== prevState[hoverIndex - 1].id && dragBlock.parent.id !== prevState[hoverIndex].parent.id) {
    //                     return prevState;
    //                 }
    //             }

    //             const copiedState = [...prevState];
    //             // // Remove the block from the old position
    //             // const prevItem = copiedState.splice(hoverIndex, 1, dragBlock);

    //             // // Remove block on dragIndex and put it on hoverIndex
    //             // copiedState.splice(dragIndex, 1, prevItem[0]);

    //             update(copiedState, {
    //                 $splice: [
    //                     [dragIndex, 1],
    //                     [hoverIndex, 0, dragBlock],
    //                 ],
    //             });

    //             // Set the flow as not saved because it has changed
    //             setSaved(false);

    //             // Set the new index of the block
    //             newIndex = hoverIndex;

    //             return copiedState;
    //         }
    //         return prevState;
    //     });

    //     // Return the new index of the block
    //     return newIndex;
    // };


    // // Remove the block from the list
    // const removeBlock = (block: BlockProps) => {
    //     setBlocks(prevBlocks => {
    //         // Filter out the block to be removed and its children
    //         const updatedBlocks = prevBlocks.filter(item => {
    //             if (item.placedID === block.placedID) {
    //                 return false;
    //             }
    //             if (item.parent && item.parent.placedID === block.placedID) {
    //                 return false;
    //             }
    //             return true;
    //         });

    //         // Set the flow as not saved because it has changed
    //         setSaved(false);

    //         return updatedBlocks;
    //     });
    // };

    // const addBlock = (event) => {

    //     console.log("Adding block")
    //     console.log(event)

    //     const block: BlockProps = {
    //         ...event.data.block
    //     }

    //     // If the block is already placed, move it to the new position
    //     if (block.isPlaced) {
    //         return
    //     }

    //     // Allow to place only if the block before is its parent or if the block has te same parent
    //     if (block.parent !== undefined) {
    //         if (blocks.length === 0) {
    //             return
    //         }
    //         const lastBlock = blocks[blocks.length - 1]
    //         if (lastBlock.id !== block.parent.id && lastBlock.parent.id !== block.parent.id) {
    //             return
    //         }
    //         // If we can place it, update its parent.placedID
    //         if (lastBlock.parent !== undefined) {
    //             block.parent.placedID = lastBlock.parent.placedID
    //         } else {
    //             block.parent.placedID = lastBlock.placedID
    //         }
    //     }



    //     // Set the placedID
    //     const newBlock = { ...block, placedID: placedID }

    //     // Set the new block as placed
    //     newBlock.isPlaced = true

    //     // Increment the placedID
    //     placedID++

    //     // Add the moveBlock function to the block
    //     newBlock.moveBlock = moveBlockHandler

    //     // Add the removeBlock function to the block
    //     newBlock.deleteBlock = removeBlock

    //     setBlocks([...blocks, newBlock])

    //     // Set the flow as not saved because it has changed
    //     setSaved(false)

    //     // Set the animation
    //     setBlockAnimation(`${newBlock.placedID}-${newBlock.id}`)

    // }

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

        // //Set the running button
        // setBlocks(blocks.map(b => {
        //     if (b.placedID === block.placedID) {
        //         b.isRunning = true
        //     }
        //     return b
        // }))

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
                // setBlocks(blocks.map(b => {
                //     if (b.placedID === block.placedID) {
                //         b.runError = false
                //     }
                //     return b
                // }))
            }
        }
        catch (e) {
            console.log(e)
            // setBlocks(blocks.map(b => {
            //     if (b.placedID === block.placedID) {
            //         b.runError = true
            //     }
            //     return b
            // }))
        }

        // Set the running button
        // setBlocks(blocks.map(b => {
        //     if (b.placedID === block.placedID) {
        //         b.isRunning = false
        //     }
        //     return b
        // }
        // ))
    }

    const handleExecuteAll = async () => {
        // Set the executing state to true
        setExecutingAll(true)

        // Loop over the blocks and execute them
        // for (let i = 0; i < blocks.length; i++) {
        //     const b = blocks[i]
        //     await executeBlock(b)
        // }

        // Set the executing state to false
        setExecutingAll(false)
    }

    const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFlowName(e.target.value)
        setSaved(false)
    }

    const onblockChange = () => (setSaved(false))

    function handleDragStart(event) {
        setActiveId(event.active.id);
    }

    function handleDragEnd() {
        setActiveId(null);
    }

    return (
        <div ref={setNodeRef} className="current-flow">
            {modal}
            <h1 className="flex flex-row">
                <input className="flow-name" type="text" id="flow-name" placeholder={props.flowName} onChange={onNameChange} />
                <button onClick={handleSave} className="flow-button">
                    {
                        saved ? (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                        </svg>
                        ) : (<svg xmlns="http://www.w3.org/2000/svg" fill="var(--light-orange)" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                        </svg>
                        )
                    }
                </button>
                <button onClick={handleExecuteAll} className="flow-button">
                    {executingAll ? (
                        <RotatingLines
                            strokeColor="grey"
                            strokeWidth="5"
                            animationDuration="0.75"
                            width="40"
                        />
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
                        </svg>
                    )}
                </button>
            </h1>
            <div className="flex flex-col align-items-center">
                <SortableContext
                    items={props.placedBlocks}
                    strategy={verticalListSortingStrategy}
                >
                    {props.placedBlocks.map((block, index) => (
                        <Block key={
                            `${block.placedID}-${block.id}`
                        } {...block} onChange={onblockChange} execute={executeBlock} index={index} />
                    ))}
                </SortableContext>
            </div>
        </div>
    )
}

export { FlowReciver }