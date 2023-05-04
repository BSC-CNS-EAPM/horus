import React, { useState } from "react";
import horus from "./horus.png";

// Create a component for the error window
function Error() {
    return (
        <div className="error">
            <h1>Shemsu Error</h1>
            <p>Shemsu has encountered an error and cannot continue.</p>
            <img src={horus} alt="Shemsu Error" />
        </div>
    )
}

// Export the component
export default Error;