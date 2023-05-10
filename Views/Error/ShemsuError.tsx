import React, { useState } from "react";

// Import the image
import horus from "./horus.png"

// Import the css file
import "./error.css";

// Create a component for the error window
function Error() {
    return (
        <div className="error">
            <h1>Shemsu Error</h1>
            <p>Shemsu has encountered an error and cannot continue.</p>
            <img src={horus} alt="Shemsu Error" className="shemsu-img" />
        </div>
    )
}

// Export the component
export default Error;