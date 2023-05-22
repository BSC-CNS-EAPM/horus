import { useDrag } from "react-dnd";
import { Children, useState } from "react";
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

    return (
        <div ref={drag} className="plugin-block" style={{ opacity: isDragging ? 0.5 : 1, cursor: 'move' }}>
            <div className="flex flew-row justify-between">
                <div style={{ fontWeight: "bold" }}>
                    {block.name}
                </div>
                <CustomPopover trigger={
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                    </svg>
                }>
                    <div className="plugin-description">{block.description}</div>
                </CustomPopover>
            </div>
            <p>{block.plugin}</p>
        </div>
    )
}