// DND
import { useDroppable } from "@dnd-kit/core";

// Horus components
import RotatingLines from "../../RotatingLines/rotatinglines";

// Types
import { DroppableEntity, FlowStatus } from "../flow.types";

// Hooks
import { FlowHooks, HandleMouseHooks } from "../flow.hooks";
import ZoomInIcon from "../../Toolbar/Icons/ZoomIn";
import ZoomOutIcon from "../../Toolbar/Icons/ZoomOut";
import Slider from "rc-slider";

type FlowCanvasProps = {
  flowHooks: FlowHooks;
  mouseHooks: HandleMouseHooks;
  children: React.ReactNode;
};

export function FlowCanvas(props: FlowCanvasProps) {
  // Extract the flow from the props
  const { isFlowActive } = props.flowHooks;
  const { mouseHooks, children } = props;

  const { setNodeRef } = useDroppable({
    id: DroppableEntity.CANVAS,
    disabled: isFlowActive,
  });

  return (
    <div className="current-flow" id="current-flow">
      <FlowTopBar flowHooks={props.flowHooks} />
      <div
        className="flow-canvas"
        ref={setNodeRef}
        id={DroppableEntity.CANVAS.valueOf()}
        onMouseDown={mouseHooks.handleMouseDown}
        onMouseUp={mouseHooks.handleMouseUp}
        onMouseLeave={mouseHooks.handleMouseUp}
        onMouseMove={mouseHooks.handleMousePan}
      >
        <div
          style={{
            pointerEvents: isFlowActive ? "none" : "auto",
            opacity: isFlowActive ? 0.8 : 1,
          }}
        >
          {children}
        </div>
      </div>
      <CanvasZoom flowHooks={props.flowHooks} />
    </div>
  );
}

function CanvasZoom({ flowHooks }: { flowHooks: FlowHooks }) {
  const { handleScaleChange, scale } = flowHooks;

  return (
    <div
      className="flex flex-row gap-2 w-48 items-center justify-center"
      style={{
        position: "absolute",
        bottom: "10px",
        right: "10px",
      }}
    >
      <div
        className="app-button bg-white"
        onClick={() => {
          handleScaleChange(scale - 0.1);
        }}
      >
        <ZoomOutIcon />
      </div>
      <div
        className="w-full h-full"
        onClick={() => {
          handleScaleChange(1);
        }}
      >
        <Slider
          min={0.1}
          max={1.5}
          step={0.01}
          value={scale}
          onChange={handleScaleChange}
          disabled={true}
        />
      </div>
      <div
        className="app-button bg-white"
        onClick={() => {
          handleScaleChange(scale + 0.1);
        }}
      >
        <ZoomInIcon />
      </div>
    </div>
  );
}

function FlowTopBar(props: { flowHooks: FlowHooks }) {
  return (
    <div className="flex flex-row top-bar-flow-reciver flow-title gap-2">
      <input
        style={{
          // Set the border color to red if the flow is not saved
          borderColor: props.flowHooks.saved
            ? "var(--digital-grey-IV)"
            : "orange",
        }}
        className="flow-name"
        type="text"
        id="flow-name"
        placeholder={"Flow Name"}
        onChange={(e) => {
          props.flowHooks.handleFlowChange({
            ...props.flowHooks.flow,
            name: e.target.value,
          });
        }}
        value={props.flowHooks.flow.name}
      />
      {props.flowHooks.isFlowActive && (
        <div className="flex flex-col gap-0 items-center text-center">
          <RotatingLines
            onClick={(_) => {
              props.flowHooks.flow.status !== FlowStatus.CANCELLING &&
                props.flowHooks.stopFlow();
            }}
            size="3rem"
            className="cursor-pointer"
            style={{
              cursor: props.flowHooks.isFlowActive
                ? "pointer !important"
                : "default",
            }}
          />

          {props.flowHooks.flow.status === FlowStatus.CANCELLING && (
            <div className="text-xs">Stopping</div>
          )}
          {props.flowHooks.flow.pendingActions.length > 0 && (
            <div className="text-xs text-green-500">Applying actions</div>
          )}
        </div>
      )}
    </div>
  );
}
