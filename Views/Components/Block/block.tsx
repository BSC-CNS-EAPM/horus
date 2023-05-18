
export enum blokcType {
    BLOCK = "BLOCK",
}

export interface BlockProps {
    id: number;
    title: string;
    desc: string;
    pluginName: string;
}

export interface dragItem {
    index: number;
    id: BlockProps["id"];
}