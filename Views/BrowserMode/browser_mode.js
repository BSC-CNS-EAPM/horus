// Create the error window view
import { createRoot } from "react-dom/client";
import { useState, useEffect } from "react";
import AppButton from "../Components/appbutton";

import { horusGet } from "../Utils/utils";

// @ts-ignore
import horus_logo from "../../Resources/horus.png";

import RotatingLines from "../Components/RotatingLines/rotatinglines";

// Import CSS
import "../CSS/main.css";
import "../CSS/colors.css";
import "../CSS/animations.css";
import "../CSS/font.css";

function BrowserMode() {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await horusGet("/api/getbrowserurl");
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
      <div className="flex flex-col justify-center items-center overflow-hidden h-full">
        <img
          src={horus_logo}
          alt="Horus logo"
          className="object-fit"
          width={100}
        />
        <RotatingLines />
      </div>
    );
  }

  const openBrowser = () => {
    horusGet("/api/openbmode");
  };

  return (
    <div className="flex flex-col justify-center items-center overflow-hidden p-4">
      <img
        src={horus_logo}
        alt="Horus logo"
        className="object-fit"
        width={100}
      />
      <p>Horus is running in browser mode.</p>
      <p className="mb-4">Do not close this window.</p>
      <AppButton action={openBrowser} text={"Open Horus"}></AppButton>
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
