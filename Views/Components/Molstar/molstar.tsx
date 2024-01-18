import { useEffect, createRef } from "react";

// Load the molstar default style
import "molstar/lib/mol-plugin-ui/skin/light.scss";

// Import index.css
import "./molstar.css";

import HorusMolstar from "./HorusWrapper/horusmolstar";
import { ErrorBoundary } from "../reusable";

declare global {
  interface Window {
    molstar?: HorusMolstar;
  }
}

export default function Molstar() {
  const parent = createRef<HTMLDivElement>();

  const loadMolstar = async () => {
    const molstar = new HorusMolstar();
    await molstar.init(parent.current);
    window.molstar = molstar;
  };

  useEffect(() => {
    if (!window.molstar) {
      loadMolstar();
    }
  }, []);

  return (
    <ErrorBoundary
      fallback={
        <div className="alert alert-danger" role="alert">
          An error occurred while loading Molstar. Open the Horus console and
          type "molreset" to reload Molstar.
        </div>
      }
    >
      <div
        id="home-molstar"
        className="home-molstar"
        ref={parent}
        style={{
          // Place a top margin of 2 rem to avoid the toolbar
          position: "relative",
          width: "100%",
          height: "100%",
          border: "none",
        }}
      />
    </ErrorBoundary>
  );
}
