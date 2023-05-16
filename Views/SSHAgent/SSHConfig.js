// Create the error window view
import { createRoot } from "react-dom/client";
import React, { useState } from "react";
import NBDButton from "../Components/NBDButton";
import { horusPost } from "../Utils/utils";

// Define the submission function
async function submitSSHConfig() {
    // Get the values from the form
    const username = document.getElementById("username").value;
    const host = document.getElementById("host").value;
    const port = document.getElementById("port").value;
    const workingDir = document.getElementById("directory").value;
    const keys = document.getElementById("keys").files[0];

    const keysText = await keys.text();

    const data = JSON.stringify({
        username: username,
        host: host,
        port: port,
        workingDir: workingDir,
        keys: keysText
    });

    const headers = {
        "Content-Type": "application/json",
    };

    // Send the form data to the backend
    await horusPost("/desktop/configureSSH", headers, data);

}


// Create a component for the error window
function SSHConfig() {
    return (
        <div className="error">
            <h1>Configure a SSH server</h1>
            <p>In order to store the connection you will need a keys file containing the authentication to your SSH server.</p>
            {/* Create a form for the username, host, port and password of the ssh server */}
            <form>
                <label htmlFor="username">Username:</label>
                <input type="text" id="username" name="username" />
                <label htmlFor="host">Host:</label>
                <input type="text" id="host" name="host" />
                <label htmlFor="port">Port:</label>
                <input type="text" id="port" name="port" />
                <label htmlFor="directory">Wroking directory:</label>
                <input type="text" id="directory" name="directory" />
                <label htmlFor="keys">Keys file:</label>
                {/* Create an input for the keys file. It should only accept files with no extension */}
                <input type="file" id="keys" name="keys" />
            </form>
            {/* Add a button for submission */}
            <NBDButton text="Submit" action={submitSSHConfig} />
        </div>
    )
}

// Export the component
export default SSHConfig;


const container = document.getElementById("SSHConfig");
const root = createRoot(container)
root.render(<SSHConfig />);