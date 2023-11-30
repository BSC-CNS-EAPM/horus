import { useEffect, createRef } from "react";
import { socket } from "../../Utils/socket";

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

  const loadMolstar = async () => {
    const molstar = new HorusMolstar();
    await molstar.init(parent.current);
    window.molstar = molstar;
  };

  const applyAction = (data) => {
    const molstar = window.molstar;
    if (molstar) {
      molstar.applyAction(data);
    }
  };

  useEffect(() => {
    if (!window.molstar) {
      loadMolstar();
    }

    socket.on("molstarAction", applyAction);

    return () => {
      socket.off("molstarAction");
    };
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
