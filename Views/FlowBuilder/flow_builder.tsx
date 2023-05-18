import React, { Children, useState } from "react";
import { Molstar } from "../Molstar/molstar";
import NBDButton from "../Components/NBDButton";


export const FlowBuilder = () => {
        return (
            <div className="flow-builder">
                <Molstar />
            </div>
        );
    }