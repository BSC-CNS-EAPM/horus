import { useDrag } from "react-dnd";

export const ItemTypes = {
    BLOCK: 'block'
}

export interface BlockProps {
    id: string;
    name: string;
    description: string;
}

export function Block<BlockProps>({ id, name, description }) {
    const [{ isDragging }, drag] = useDrag(() => ({
        type: ItemTypes.BLOCK,
        collect: monitor => ({
            isDragging: !!monitor.isDragging(),
        }),
    }))

    return (
        <div ref={drag} style={{ opacity: isDragging ? 0.5 : 1, cursor: 'move' }}>
            <h3>{name}</h3>
            <p>{description}</p>
        </div>
    )
}