// Import React library
import React, { useState, useEffect } from "react";

// Import the css
import "./NBDButton.css";

// Create a component called NBDButton
function NBDButton(props) {

    return (
        <div>
            {/* Create a button with the text and the action */}
            <button className="nbd-btn" onClick={props.action}>{props.text}</button>
        </div>
    );
}

// Export the component
export default NBDButton;