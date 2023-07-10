// Create the error window view
import { createRoot } from "react-dom/client";
import { useState, useEffect } from "react";
import NBDButton from "../Components/nbdbutton";

import { horusGet } from "../Utils/utils";
import nostrum_logo from "../../Resources/horus.png";

import { RotatingLines } from "react-loader-spinner";

function BrowserMode() {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await horusGet("getbrowserurl");
        if (!response.ok) {
          setError(true);
          return;
        }
        const data = await response.json();
        setUrl(data.url);
      } catch (error) {
        setError(true);
      }
    }
    if (!url) {
      setTimeout(fetchData, 2000);
    }
  }, [url]);

  if (error || !url) {
    return (
      <div className="flex flex-col justify-center items-center overflow-hidden">
        <img
          src={nostrum_logo}
          alt="Nostrum Logo"
          className="object-fit"
          width={100}
        />
        <RotatingLines></RotatingLines>
      </div>
    );
  }

  const openBrowser = () => {
    horusGet("/openbmode");
  };

  return (
    <div className="flex flex-col justify-center items-center overflow-hidden">
      <img
        src={nostrum_logo}
        alt="Nostrum Logo"
        className="object-fit"
        width={100}
      />
      <p>Horus is running in browser mode.</p>
      <p className="mb-4">Do not close this window.</p>
      <NBDButton action={openBrowser} text={"Open Horus"}></NBDButton>
    </div>
  );
}

let container = null;

document.addEventListener("DOMContentLoaded", () => {
  if (!container) {
    container = document.getElementById("bmode");
    const root = createRoot(container);
    root.render(<BrowserMode />);
  }
});
