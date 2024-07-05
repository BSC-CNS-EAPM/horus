import { PluginUIComponent } from "molstar/lib/mol-plugin-ui/base";
import {
  AnimationViewportControls,
  LociLabels,
  TrajectoryViewportControls,
} from "molstar/lib/mol-plugin-ui/controls";
import { BackgroundTaskProgress } from "molstar/lib/mol-plugin-ui/task";
import { Toasts } from "molstar/lib/mol-plugin-ui/toast";
import { ViewportCanvas } from "molstar/lib/mol-plugin-ui/viewport/canvas";
import { Smiles2DMolstarViewportComponent } from "../../../Smiles/SmilesViewport";
import { ViewportControls } from "molstar/lib/mol-plugin-ui/viewport";

export class HorusMolstarViewportComponent extends PluginUIComponent {
  override render() {
    return (
      <>
        <ViewportCanvas />
        <ViewportControls />
        <BackgroundTaskProgress />
        <div className="msp-viewport-top-left-controls flex flex-col gap-1">
          <Smiles2DMolstarViewportComponent />
          <div className="flex flex-row">
            <AnimationViewportControls />
            <TrajectoryViewportControls />
          </div>
        </div>
        <div className="msp-highlight-toast-wrapper">
          <LociLabels />
          <Toasts />
        </div>
      </>
    );
  }
}
