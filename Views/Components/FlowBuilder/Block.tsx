import { useDrag } from "react-dnd";
import { useState } from "react";
import { horusPost } from "../../Utils/utils";

import "./block.css"

import { Popover } from "@headlessui/react";

export const ItemTypes = {
    BLOCK: 'block'
}

export interface BlockProps {
    id: string;
    name: string;
    description: string;
    plugin: string;
    variables: number;
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

export function Block(block) {

    // Update the running button
    const [isRunning, setIsRunning] = useState(false)
    const [runError, setRunError] = useState(false)

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
            variables: block.variables
        }
    }))

    const executeBlock = async () => {

        // Set the running button
        setIsRunning(true)

        const body = JSON.stringify({
            blockID: block.id,
            variables: {
                "test": "UPDATED!"
            }
        })

        const headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

        const response = await horusPost("/plugins/executeblock", headers, body)

        const data = await response.json()

        // Check any error status code
        if (!data.ok) {
            setRunError(true)
        }
        else {
            setRunError(false)
        }

        // Set the running button
        setIsRunning(false)
    }

    return (
        <div ref={drag} className="plugin-block" style={{ opacity: isDragging ? 0.5 : 1, cursor: 'move' }}>
            <div className="flex flew-row justify-between">
                <div style={{ fontWeight: "bold" }}>
                    {block.name}
                </div>
                <CustomPopover trigger={
                    <button onClick={executeBlock}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"
                            fill={isRunning ? "green" : (runError ? "red" : "currentColor")}
                            className="w-5 h-5">
                            <path fillRule="evenodd" d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm6.39-2.908a.75.75 0 01.766.027l3.5 2.25a.75.75 0 010 1.262l-3.5 2.25A.75.75 0 018 12.25v-4.5a.75.75 0 01.39-.658z" clipRule="evenodd" />
                        </svg>
                    </button>
                }>
                    <div className="plugin-description">Execute block</div>
                </CustomPopover>
                <CustomPopover trigger={
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                    </svg>
                }>
                    <div className="plugin-description">{block.description}</div>
                </CustomPopover>
            </div>
            <p>{block.plugin}</p>
        </div>
    )
}