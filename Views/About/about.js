// Create the error window view
import { createRoot } from "react-dom/client";
import { useState, useEffect } from "react";

import { horusGet } from "../Utils/utils";
import nostrum_logo from "../../Resources/horus.png";

function About() {
  const [url, setUrl] = useState(null);
  const [version, setVersion] = useState("0.0.0");

  const getVersion = async () => {
    const response = await horusGet("/api/version");
    if (!response.ok) {
      console.log("Error getting version");
      return;
    }
    const data = await response.json();

    if (!data.ok) {
      alert("Error getting version: " + data.msg);
      return;
    }

    const version = data.version;

    setVersion(version);
  }

  useEffect(() => {
    getVersion();
  }, []);


  return (
    <div className="flex flex-col justify-center items-center overflow-hidden">
      <img
        src={nostrum_logo}
        alt="Nostrum Logo"
        className="object-fit"
        width={100}
      />
      <p>Horus version</p>
      <p className="mb-4">{version}</p>
    </div>
  );
}

let container = null;

document.addEventListener("DOMContentLoaded", () => {
  if (!container) {
    container = document.getElementById("about");
    const root = createRoot(container);
    root.render(<About />);
  }
});
