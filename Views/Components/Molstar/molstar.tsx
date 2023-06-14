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

    var snapshot: any = null;

    function loadAndSnapshot(params) {
      molstar.load(params).then(() => {
        setTimeout(
          () =>
            (snapshot = molstar.plugin.state.getSnapshot({
              canvas3d: false,
            })),
          500
        );
      });
    }

    molstar.init(parent.current, {}).then(() => {
      molstar.setBackground(0xffffff);
    });

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
