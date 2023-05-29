import { useDrag } from "react-dnd";
import { useEffect, useState } from "react";
import { horusPost } from "../../Utils/utils";

import "./block.css"

import { Popover } from "@headlessui/react";

interface PlayBlockButtonProps {
    isRunning: boolean;
    runError: boolean;
    onClick: () => Promise<void>;
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

export const ItemTypes = {
    BLOCK: 'block'
}

enum PluginVariableTypes {
    STRING = "string",
    INTEGER = "integer",
    FLOAT = "float",
    BOOLEAN = "boolean",
    STRING_LIST = "string[]",
    INTEGER_LIST = "integer[]",
    FLOAT_LIST = "float[]",
    BOOLEAN_LIST = "boolean[]",
    INT_RANGE = "[integer, integer]",
    FLOAT_RANGE = "[float, float]",
    FILE = "file",
    // STRING_ARRAY = "string[]",
    // NUMBER_RANGE = "[number, number]"
}

type PluginVariableType = string | number | boolean; // | string[] | [number, number]; // Define the allowed types

interface PluginVariable<T extends PluginVariableType> {
    name: string;
    id: string;
    description: string;
    type: PluginVariableTypes;
    value: T;
    allowedValues?: T[];
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

export interface BlockProps {
    id: string;
    name: string;
    description: string;
    plugin: string;
    variables: PluginVariable<PluginVariableType>[];
    isPlaced: boolean;
    onChange?: () => void;
    execute?: (
        block: BlockProps,
    ) => Promise<void>;
    isRunning?: boolean;
    runError?: boolean;
    placedID: number
}


export function Block(block: BlockProps) {

    // Track the mouse position
    const [isHovering, setIsHovering] = useState(false)

    const handleMouseOver = () => {
        setIsHovering(true)
    }

    const handleMouseOut = () => {
        setIsHovering(false)
    }

    const [{ isDragging }, drag] = useDrag(() => ({
        type: ItemTypes.BLOCK,
        collect: monitor => ({
            isDragging: !!monitor.isDragging(),
        }),
        // Assing the item to the drag (BlockProps)
        item: {
            id: block.id,
            name: block.name,
            description: block.description,
            plugin: block.plugin,
            variables: block.variables,
            isPlaced: block.isPlaced
        }
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


    return (
        <div ref={drag} className={`plugin-block ${block.isPlaced ? 'plugin-block-placed' : ''}`} style={{ opacity: isDragging ? 0.5 : 1, cursor: 'move' }}>
            <div className="flex flew-row justify-between">
                <div style={{ fontWeight: "bold" }}>
                    {block.name}
                </div>
                {block.isPlaced && <PlayBlockButton isRunning={block.isRunning} runError={block.runError} onClick={handleExecute} />}

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