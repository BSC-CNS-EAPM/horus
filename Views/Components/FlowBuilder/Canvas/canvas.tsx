// DND
import { useDroppable } from "@dnd-kit/core";

// Types
import { DroppableEntity, FlowStatus } from "../flow.types";

// Hooks
import { FlowHooks, HandleMouseHooks } from "../flow.hooks";

// Icons
import ZoomInIcon from "../../Toolbar/Icons/ZoomIn";
import ZoomOutIcon from "../../Toolbar/Icons/ZoomOut";
import Slider from "rc-slider";

// Flow status view and stop button
import StopIcon from "../../Toolbar/Icons/Stop";
import SaveIcon from "../../Toolbar/Icons/Save";
import { FlowStatusView } from "../../FlowStatus/flow_status";

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
    <div className="flex flex-row top-bar-flow-reciver gap-2">
      <input
        style={{
          // Set the border color to red if the flow is not saved
          borderColor: props.flowHooks.saved
            ? "var(--digital-grey-IV)"
            : "orange",
          minWidth: "200px",
        }}
        className="flow-name flow-title"
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
      <div
        className={`flex flex-col gap-0 items-center text-center justify-center bg-white flow-name ${
          props.flowHooks.flow.status === FlowStatus.RUNNING ||
          props.flowHooks.flow.status === FlowStatus.QUEUED
            ? "cursor-pointer"
            : "cursor-default"
        }`}
        onClick={() => {
          (props.flowHooks.flow.status === FlowStatus.RUNNING ||
            props.flowHooks.flow.status === FlowStatus.QUEUED) &&
            props.flowHooks.stopFlow();
        }}
        style={{
          borderColor: props.flowHooks.saved
            ? "var(--digital-grey-IV)"
            : "orange",
          minWidth: "200px",
        }}
      >
        <div className="flex flex-row gap-1 items-center justify-center">
          {(props.flowHooks.flow.status === FlowStatus.RUNNING ||
            props.flowHooks.flow.status === FlowStatus.QUEUED) && (
            <>
              <StopIcon className="text-red-500 w-6 h-6" />
              <div
                className="h-6 mx-2"
                style={{
                  border: "0.5px solid var(--digital-grey-IV)",
                }}
              ></div>{" "}
            </>
          )}
          {props.flowHooks.saved ? (
            <FlowStatusView status={props.flowHooks.flow.status} />
          ) : (
            <div
              className="flex flex-row gap-2"
              style={{
                color: "orange",
              }}
            >
              <SaveIcon />
              <div>Unsaved</div>
            </div>
          )}
        </div>
        {props.flowHooks.flow.pendingActions.length > 0 && (
          <div
            className="text-xs text-green-500 text-center"
            style={{
              position: "absolute",
              bottom: "-1.5rem",
            }}
          >
            Applying actions
          </div>
        )}
      </div>
    </div>
  );
}
