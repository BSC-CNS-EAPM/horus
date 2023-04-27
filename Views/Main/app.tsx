import React, { useState } from "react";
import { Molstar } from "../Molstar/molstar";

// Define the window object
declare global {
    interface Window {
        shemsu: string;
    }
}

function getData() {
    // Fetch the data from /api/data
    return fetch("/api/data", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            shemsu: window.shemsu
        }
    })
        .then((response) => response.json())
        .then((data) => data.data);
}

export function App() {
    const [showData, setShowData] = useState("No data");
    return (
        <div className="App">
            <FetchButton setShowData={setShowData} />
            <DataDisplay data={showData} />
            <Molstar />
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

    return <button onClick={handleClick}>Fetch Data</button>;
}
