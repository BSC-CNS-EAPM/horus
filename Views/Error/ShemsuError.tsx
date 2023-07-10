import React, { useState } from "react";

// Import the image
import horus_god from "../../Resources/horus_god.png";

// Import the css file
import "./error.css";

// Create a component for the error window
function Error() {
  return (
    <div className="error">
      <h1>Shemsu Error</h1>
      <p>Shemsu has encountered an error and cannot continue.</p>
      <img src={horus_god} alt="Shemsu Error" className="shemsu-img" />
    </div>
  );
}

// Export the component
export default Error;
