// React
import { useEffect, createRef, useContext } from "react";
// Mol* styling THE ORDER OF THESE IMPORTS MATTERS
// 1. Mol* custom scss theme
// 3. Mol* override styles (molstar.css)
import "./horus_molstar.scss";

// Horus Molstar wrapper
import HorusMolstar from "./HorusWrapper/horusmolstar";

// Error boundary (currently does not do anything)
import { useSettings } from "@/Main/app";
import AppButton from "../appbutton";
import {
  DockContext,
  PANEL_REGISTRY,
  addPanel,
  hooksInitializer,
} from "../MainApp/PanelView";

export default function Molstar() {
  const parent = createRef<HTMLDivElement>();
  const settings = useSettings();
  const { dockApi } = useContext(DockContext)!;

  useEffect(() => {
    if (settings?.["disableMolstar"]?.value) {
      window.molstar?.plugin?.dispose();
      window.molstar = undefined;

      // Remove the msp-plugin class div
      document
        .querySelectorAll(".msp-plugin")
        .forEach((element) => element.remove());

      return;
    }

    window.molstar = new HorusMolstar(parent.current!);

    return () => {
      // Reset mol* when the component unmounts
      window?.molstar?.plugin?.dispose();

      window.molstar = undefined;

      // Run the hooksInitializer again
      hooksInitializer();
    };
  }, [settings]);

  if (settings?.["disableMolstar"]?.value) {
    return (
      <div className="grid place-items-center h-full z-10">
        <div className="flex flex-col gap-2 justify-center items-center">
          Molstar is disabled in the settings.
          <AppButton
            action={() => {
              addPanel({
                dockApi,
                panelID: PANEL_REGISTRY.horusSettings.id,
                component: PANEL_REGISTRY.horusSettings.component,
              });
            }}
          >
            Open settings
          </AppButton>
        </div>
      </div>
    );
  }

  return (
    <div
      id="home-molstar"
      className="home-molstar"
      ref={parent}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        border: "none",
      }}
    />
  );
}
