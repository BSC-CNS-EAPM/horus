import { PluginUIComponent } from "molstar/lib/mol-plugin-ui/base";
import {
  AnimationViewportControls,
  LociLabels,
  SelectionViewportControls,
  TrajectoryViewportControls
} from "molstar/lib/mol-plugin-ui/controls";
import { BackgroundTaskProgress } from "molstar/lib/mol-plugin-ui/task";
import { Toasts } from "molstar/lib/mol-plugin-ui/toast";
import { ViewportControls } from "molstar/lib/mol-plugin-ui/viewport";
import { ViewportCanvas } from "molstar/lib/mol-plugin-ui/viewport/canvas";
import { useEffect, useState } from "react";
import { Smiles2DMolstarViewportComponent } from "../../../Smiles/SmilesViewport";
import { isMolstarLoaded, MolstarEvents } from "../horusmolstar";

export class HorusMolstarViewportComponent extends PluginUIComponent {
  override render() {
    return (
      <>
        <ViewportCanvas />
        <div className="msp-viewport-top-left-controls flex flex-col gap-1">
          <Smiles2DMolstarViewportComponent />
          <div className="flex flex-row">
            <AnimationViewportControls />
            <TrajectoryViewportControls />
          </div>
        </div>
        <EmptyMolstarHelp />
        <SelectionViewportControls />
        <ViewportControls />
        <BackgroundTaskProgress />
        <div className="msp-highlight-toast-wrapper">
          <LociLabels />
          <Toasts />
        </div>
      </>
    );
  }
}

function EmptyMolstarHelp() {
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const checkEmpty = () => {
      setIsEmpty(
        (isMolstarLoaded(window.molstar)
          ? window.molstar?.structures?.().length
          : 0) === 0
      );
    };

    window.addEventListener(MolstarEvents.STATE, checkEmpty);

    return () => {
      window.removeEventListener(MolstarEvents.STATE, checkEmpty);
    };
  }, []);

  if (!isEmpty) return null;

  return (
    <div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-400 text-center"
      style={{
        fontFamily: "Poppins"
      }}
    >
      Drag and drop molecular structure files here (PDB, SDF, CIF...)
    </div>
  );
}
