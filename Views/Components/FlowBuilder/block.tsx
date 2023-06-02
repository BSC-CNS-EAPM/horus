import { Identifier, XYCoord } from "dnd-core";
import { DropTargetMonitor, useDrag, useDrop } from "react-dnd";
import { useEffect, useState, useRef } from "react";
import { horusPost } from "../../Utils/utils";

import { BlockProps, PluginVariable, PluginVariableType, PluginVariableTypes } from "../../Interfaces/plugins";

import "./block.css"

import { Popover } from "@headlessui/react";

interface DeleteBlockButtonProps {
    block: BlockProps;
    onClick: (block: BlockProps) => void;
}

interface PlayBlockButtonProps {
    isRunning: boolean;
    runError: boolean;
    onClick: () => Promise<void>;
}

function DeleteBlockButton(
    { block, onClick }: DeleteBlockButtonProps
) {

    const deleteBlock = () => {
        onClick(block);
    }

    return (<CustomPopover trigger={
        <button onClick={deleteBlock}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="red" className="w-5 h-5">
                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
            </svg>
        </button>
    }>
        <div className="plugin-description">Delete block</div>
    </CustomPopover>)
}

function PlayBlockButton(
    { isRunning, runError, onClick }: PlayBlockButtonProps
) {
    return (<CustomPopover trigger={
        <button onClick={onClick}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"
                fill={isRunning ? "green" : (runError ? "red" : "currentColor")}
                className="w-5 h-5">
                <path fillRule="evenodd" d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm6.39-2.908a.75.75 0 01.766.027l3.5 2.25a.75.75 0 010 1.262l-3.5 2.25A.75.75 0 018 12.25v-4.5a.75.75 0 01.39-.658z" clipRule="evenodd" />
            </svg>
        </button>
    }>
        <div className="plugin-description">Execute block</div>
    </CustomPopover>)
}

const ItemTypes = {
    BLOCK: 'block'
}

const PluginVariable = <T extends PluginVariableType>(props: { variable: PluginVariable<T>, onChange: (value: T, id: string) => void }) => {

    const [value, setValue] = useState<T>(props.variable.value)

    const handleChange = (value: T) => {
        setValue(value)
        props.onChange(value, props.variable.id)
    }

    useEffect(() => {
        handleChange(props.variable.value)
    }, [props.variable.value])

    return (
        <div className="plugin-variable">
            <div className="plugin-variable-name">
                {props.variable.name}
            </div>
            <div className="plugin-variable-description">
                {props.variable.description}
            </div>
            <div className="plugin-variable-value">

                {/* Define an input based on the type */}

                {/* If its a string, int or float, set a basic input */}
                {props.variable.type === PluginVariableTypes.STRING && (
                    <input type="text" value={value as string} onChange={e => handleChange(e.target.value as any)} />
                )}

                {props.variable.type === PluginVariableTypes.INTEGER && (
                    <input type="number" value={value as number} onChange={e => handleChange(e.target.value as any)} />
                )}

                {props.variable.type === PluginVariableTypes.FLOAT && (
                    <input type="number" value={value as number} onChange={e => handleChange(e.target.value as any)} />
                )}

                {/* If its a boolean, set a checkbox */}
                {props.variable.type === PluginVariableTypes.BOOLEAN && (
                    <input type="checkbox" checked={value as boolean} onChange={e => handleChange(e.target.checked as any)} />
                )}

                {/* If its a list of strings, set a dropdown */}
                {props.variable.type === PluginVariableTypes.STRING_LIST && (
                    <select value={value as string} onChange={e => handleChange(e.target.value as any)}>
                        {(props.variable.allowedValues as string[])?.map((value, index) => (
                            <option key={index} value={value}>{value}</option>
                        ))}
                    </select>
                )}

                {/* If its a list of integers, set a dropdown */}
                {props.variable.type === PluginVariableTypes.INTEGER_LIST && (
                    <select value={value as number} onChange={e => handleChange(e.target.value as any)}>
                        {(props.variable.allowedValues as number[])?.map((value, index) => (
                            <option key={index} value={value}>{value}</option>
                        ))}
                    </select>
                )}

                {/* If its a list of floats, set a dropdown */}
                {props.variable.type === PluginVariableTypes.FLOAT_LIST && (
                    <select value={value as number} onChange={e => handleChange(e.target.value as any)}>
                        {(props.variable.allowedValues as number[])?.map((value, index) => (
                            <option key={index} value={value}>{value}</option>
                        ))}
                    </select>
                )}

                {/* If its a list of booleans, set radio items*/}
                {props.variable.type === PluginVariableTypes.BOOLEAN_LIST && (
                    <div className="flex flex-row">
                        {(props.variable.allowedValues as boolean[])?.map((value, index) => (
                            <div key={index} className="flex flex-row items-center">
                                <input type="radio" checked={value === (value as boolean)} onChange={e => handleChange(value as any)} />
                                <div className="ml-2">{value}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* If the type is a FILE, set a file upload button */}
                {props.variable.type === PluginVariableTypes.FILE && (
                    <input type="file" onChange={e => handleChange(e.target.files[0] as any)} />
                )}
            </div>
        </div>
    )
}

const CustomPopover = ({ trigger, children }) => {
    const [isOpen, setIsOpen] = useState(false)
    const handleOpen = () => {
        setIsOpen(true)
    }
    const handleClose = () => {
        setIsOpen(false)
    }

    return (
        <Popover className="relative">
            <Popover.Button onMouseOver={handleOpen} onMouseLeave={handleClose}>{trigger}</Popover.Button>
            {isOpen && (<Popover.Panel className="absolute z-30" static>
                {children}
            </Popover.Panel>)}
        </Popover>
    )
}

function Block(block: BlockProps) {

    const ref = useRef<HTMLDivElement>(null)

    // Track the mouse position
    const [isHovering, setIsHovering] = useState(false)

    const handleMouseOver = () => {
        setIsHovering(true)
    }

    const handleMouseOut = () => {
        setIsHovering(false)
    }


    function handleHover(hoverBlock: BlockProps, monitor: DropTargetMonitor) {
        if (!ref.current) {
            return
        }
        const dragIndex = hoverBlock.index
        const hoverIndex = block.index

        // Don't replace items with themselves
        if (dragIndex === hoverIndex) {
            return
        }

        // Determine rectangle on screen
        const hoverBoundingRect = ref.current?.getBoundingClientRect()

        // Get vertical middle
        const hoverMiddleY =
            (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2

        // Determine mouse position
        const clientOffset = monitor.getClientOffset()

        // Get pixels to the top
        const hoverClientY = (clientOffset as XYCoord).y - hoverBoundingRect.top

        // Only perform the move when the mouse has crossed half of the items height
        // When dragging downwards, only move when the cursor is below 50%
        // When dragging upwards, only move when the cursor is above 50%

        // Dragging downwards
        if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
            return
        }

        // Dragging upwards
        if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
            return
        }

        // Time to actually perform the action
        block.moveBlock(dragIndex, hoverIndex)

        // Note: we're mutating the monitor item here!
        // Generally it's better to avoid mutations,
        // but it's good here for the sake of performance
        // to avoid expensive index searches.
        hoverBlock.index = hoverIndex
    }

    const [, drop] = useDrop({
        accept: ItemTypes.BLOCK,
        hover(
            item: BlockProps,
            monitor: DropTargetMonitor
        ) {
            handleHover(item, monitor)
        }
    })

    const [{ isDragging }, drag] = useDrag(() => ({
        type: ItemTypes.BLOCK,
        collect: (monitor: any) => ({
            isDragging: monitor.isDragging(),
        }),
        // Assing the item to the drag (BlockProps)
        item: () => {
            return {
                id: block.id,
                name: block.name,
                description: block.description,
                plugin: block.plugin,
                variables: block.variables,
                isPlaced: block.isPlaced,
                index: block.index,
                moveBlock: block.moveBlock
            }
        },
    }))

    const handleChange = (value: PluginVariableType, id: string) => {
        // Update the variable value by searching the PluginVariable by id
        const updatedVariables = block.variables.map(variable => {
            if (variable.id === id) {
                variable.value = value
            }
            return variable
        })

        // Update the block variables
        block.variables = updatedVariables

        // Call the onChange function
        block.onChange()
    }

    const handleExecute = async () => {
        // Call the execute function
        await block.execute(block)
    }

    if (block.isPlaced) {
        drag(drop(ref))
    } else {
        drag(ref)
    }

    return (
        <div
            id={`${block?.placedID}-${block.id}`} ref={ref} className={`plugin-block ${block.isPlaced ? 'plugin-block-placed' : ''}`} style={{ opacity: isDragging ? 0.5 : 1, cursor: 'move' }}>
            <div className="flex flew-row justify-between">
                <div style={{ fontWeight: "bold" }}>
                    {block.name}
                </div>
                {/* Play button to execute the block */}
                {block.isPlaced && <PlayBlockButton isRunning={block.isRunning} runError={block.runError} onClick={handleExecute} />}
                {/* Delete button to remove the block from the canvas */}
                {block.isPlaced && <DeleteBlockButton block={block} onClick={() => block.deleteBlock(block)} />}

                <CustomPopover trigger={
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                    </svg>
                }>
                    <div className="plugin-description">{block.description}</div>
                </CustomPopover>
            </div>
            {
                block.isPlaced && (
                    <div>
                        {block.variables.map((variable, index) => (
                            <PluginVariable key={variable.id} variable={variable} onChange={handleChange} />
                        ))}
                    </div>)
            }
            <p>{block.plugin}</p>
        </div>
    )
}

export { Block, ItemTypes, PluginVariable }