import React, { Children, useState } from "react";
import { Molstar } from "./molstar";
import NBDButton from "./NBDButton";

import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

export const FlowBuilder = () => {
    return (
        <DndProvider backend={HTML5Backend}>
            
        </DndProvider>
    );
}