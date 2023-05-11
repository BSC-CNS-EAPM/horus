import React, { useState } from "react";
import { Molstar } from "../Molstar/molstar";
import NBDButton from "../Components/NBDButton";

// Define the window object
declare global {
    interface Window {
        shemsu: string;
    }
}

async function getData() {
    // Fetch the data from /api/data
    const result = await fetch("/api/data", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            shemsu: window.shemsu
        }
    })

    console.log(result)

    // Parse the result as JSON
    const data = await result.json();

    if (data.error) {
        return "Error"
    }

    // Return the data
    return data;

}

export function App() {
    const [showData, setShowData] = useState("No data");
    return (
        <div className="App">
            <FetchButton setShowData={setShowData} />
            <DataDisplay data={showData} />
            {/* <Molstar /> */}
        </div>
    );
}

// Create a text component to display the fetched data
function DataDisplay({ data }) {
    return (
        <div>
            <p>Here is the data: {data}</p>
        </div>
    );
}

function FetchButton({ setShowData }) {
    const handleClick = async () => {
        try {
            const data = await getData();
            setShowData(data);
        } catch (error) {
            setShowData(`Error fetching data: ${error}`);
        }
    };

    const props = {
        text: "Fetch data",
        action: handleClick
    };
    // Create a nbd button with the text "Fetch data" and the action handleClick
    return <NBDButton {...props} />;
}
