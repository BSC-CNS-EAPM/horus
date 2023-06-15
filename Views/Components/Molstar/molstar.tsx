import { useEffect, createRef } from "react";

// Load the molstar default style
import "molstar/lib/mol-plugin-ui/skin/light.scss";

// Import index.css
import "./molstar.css";

import HorusMolstar from "./HorusWrapper/horusmolstar";

declare global {
  interface Window {
    molstar?: HorusMolstar;
  }
}

export default function Molstar() {
  const parent = createRef<HTMLDivElement>();

  useEffect(() => {
    const molstar = new HorusMolstar();

    molstar.init(parent.current);

    window.molstar = molstar;
  }, []);

  return (
    <div
      id="home-molstar"
      className="home-molstar"
      ref={parent}
      style={{
        // Place a top margin of 2 rem to avoid the toolbar
        position: "relative",
        width: "100%",
        border: "none",
      }}
    />
  );
}
