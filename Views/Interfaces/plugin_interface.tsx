interface HorusPlugin {
    actions: string;
    author: string;
    blocks: BlockProps[];
    dependencies: string;
    description: string;
    id: string;
    name: string;
    version: string;
    views: string;
    default: boolean;
}





// Export the interfaces
export { HorusPlugin};