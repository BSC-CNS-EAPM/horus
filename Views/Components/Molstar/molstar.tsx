// React
import { useEffect, createRef } from "react";

// Mol* styling THE ORDER OF THESE IMPORTS MATTERS
// 1. Mol* custom scss theme
// 3. Mol* override styles (molstar.css)
import "./horus_molstar.scss";

// Horus Molstar wrapper
import HorusMolstar from "./HorusWrapper/horusmolstar";

// Error boundary (currently does not do anything)
import { ErrorBoundary } from "../reusable";

export default function Molstar() {
  const parent = createRef<HTMLDivElement>();

  useEffect(() => {
    window.molstar = new HorusMolstar(parent.current!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    // @ts-ignore
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
        className="home-molstar zoom-in-animation"
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
