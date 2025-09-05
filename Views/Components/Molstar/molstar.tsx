// React
import { useEffect, createRef, useContext } from "react";
// Mol* styling THE ORDER OF THESE IMPORTS MATTERS
// 1. Mol* custom scss theme
// 3. Mol* override styles (molstar.css)
import "./horus_molstar.scss";

// Horus Molstar wrapper
import HorusMolstar, {
  MolstarEvents,
  isMolstarLoaded
} from "./HorusWrapper/horusmolstar";

// Error boundary (currently does not do anything)
import { useSettings } from "@/Main/app";
import AppButton from "../appbutton";
import {
  DockContext,
  PANEL_REGISTRY,
  addPanel,
  hooksInitializer
} from "../MainApp/PanelView";

export default function Molstar() {
  const parent = createRef<HTMLDivElement>();
  const settings = useSettings();
  const { dockApi } = useContext(DockContext)!;

  useEffect(() => {
    if (settings?.["disableMolstar"]?.value) {
      pluginDisposal();
    } else {
      window.molstar = new HorusMolstar(parent.current!);
    }

    return () => {
      if (pluginDisposal()) {
        hooksInitializer();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.["disableMolstar"]?.value]);

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
                component: PANEL_REGISTRY.horusSettings.component
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
        border: "none"
      }}
    />
  );
}

// Remove the plugin entirely from the HTML canvas
function pluginDisposal() {
  if (isMolstarLoaded(window.molstar)) {
    // Proper plugin disposal
    window.molstar?.plugin?.dispose();
    window.molstar = undefined;

    // Clean up DOM elements
    document
      .querySelectorAll(".msp-plugin")
      .forEach((element) => element.remove());

    // Launch a STATE event
    const event = new CustomEvent(MolstarEvents.STATE, {
      detail: {}
    });
    window.dispatchEvent(event);
    return true;
  }

  return false;
}
