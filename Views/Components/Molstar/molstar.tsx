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

    var pdbId = "4ldj",
      assemblyId = "preferred",
      isBinary = true;
    var url =
      "https://www.ebi.ac.uk/pdbe/entry-files/download/" + pdbId + ".bcif";
    var format = "cif";
    var representationStyle = {
      hetGroups: { kind: "ball-and-stick" }, // or 'spacefill
      water: { hide: true },
      snfg3d: { hide: false },
    };

    molstar.init(parent.current, {}).then(() => {
      molstar.setBackground(0xffffff);
      loadAndSnapshot({
        url: url,
        format: format,
        isBinary: isBinary,
        assemblyId: assemblyId,
        representationStyle: representationStyle,
      });
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
