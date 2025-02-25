// React
import { useEffect, useState } from "react";

// Components
import Xarrow from "react-xarrows";
import CrossIcon from "../../Toolbar/Icons/Cross";

// Types
import { DroppableEntity, VariableConnection } from "../flow.types";
import { BlockVarPair } from "../flow.types";
import { BlockHooks } from "../flow.hooks";
import { compareAllowedValues } from "../Variables/variable_connections";
import { useSettings } from "@/Main/app";

type ConnectedArrows = {
  blockHooks: BlockHooks;
  connection: VariableConnection;
  scale: number;
};

export function ConnectedArrows(props: ConnectedArrows) {
  const start = `output-drag-${props.connection.origin.variableID}-${props.connection.origin.placedID}-connector`;
  const end = `connect-${props.connection.destination.variableID}-${props.connection.destination.placedID}`;

  const settings = useSettings();

  const [isHovering, setIsHovering] = useState<boolean>(false);

  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const arrowAppareance = settings?.["arrowLook"]?.value ?? "Curved";
  const path =
    arrowAppareance === "Curved" || arrowAppareance === "Extra curved"
      ? "smooth"
      : "grid";
  const curveness = arrowAppareance === "Extra curved" ? 1 : 0.35;

  const allowedConnection = compareAllowedValues(
    props.connection.origin.variableType,
    props.connection.destination.variableType,
    props.connection.origin.variableAllowedValues ?? [],
    props.connection.destination.variableAllowedValues ?? [],
  );

  const arrowColor = allowedConnection
    ? props.connection.isCyclic
      ? "var(--waring-orange)"
      : "var(--pop-code)"
    : "var(--red-error)";

  // If either the end or start node do not exist, return
  const originNode = document.getElementById(start);
  const destinationNode = document.getElementById(end);
  if (!originNode || !destinationNode) return null;

  return (
    <div
      key={`arrow-container-${start + end}`}
      className="absolute"
      onMouseOver={(event) => {
        if (isHovering) return;

        // If the hoversing div is not the "<path>" component, return
        if (!(event.target instanceof SVGPathElement)) return;

        setIsHovering(true);

        // Get the canvas rect
        const canvasRect = document
          .getElementById(DroppableEntity.SCALED_CANVAS)
          ?.getBoundingClientRect();

        // Get the mouse position relative to the canvas
        setMousePos({
          x: event.clientX - (canvasRect!.left + 15),
          y: event.clientY - (canvasRect!.top + 15),
        });
      }}
      onMouseLeave={() => setIsHovering(false)}
    >
      <Xarrow
        strokeWidth={4 * props.scale}
        start={start}
        end={end}
        key={start + end}
        startAnchor={["right", "top", "bottom"]}
        showHead={false}
        path={path}
        color={arrowColor}
        curveness={curveness}
        labels={{
          middle: props.connection.isCyclic ? (
            <CyclesView
              scale={props.scale}
              cycleNumber={props.connection.cycles}
              setCycles={props.blockHooks.updateCyclesCount}
              destination={props.connection.destination}
              currentCycle={props.connection.currentCycle}
            />
          ) : null,
        }}
      />
      <div
        className="flex flex-row gap-1 items-center absolute z-10"
        style={{
          left: mousePos.x,
          top: mousePos.y,
        }}
      >
        <div
          onClick={() => props.blockHooks.unconnectVariables(props.connection)}
          className={`rounded-full bg-white flex justify-center items-center border border-gray-300
                 ${
                   isHovering ? "opacity-100" : "opacity-0"
                 } transition-opacity duration-200 ease-in-out`}
        >
          <CrossIcon
            style={{
              color: "var(--red-error)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function CyclesView(props: {
  currentCycle: number;
  cycleNumber: number;
  destination: BlockVarPair;
  scale: number;
  setCycles: (destination: BlockVarPair, cycleNumber: number) => void;
}) {
  const { destination, cycleNumber, setCycles, currentCycle } = props;

  const [inputValue, setInputValue] = useState(cycleNumber);

  const updateCycleNumber = (e: any) => {
    const value = parseInt(e.target.value);
    if (value > 0) {
      setCycles(destination, value);
      setInputValue(cycleNumber);
    }
  };

  const handleOnChangeEvent = (e: any) => {
    const value = parseInt(e.target.value);
    if (value > 0) {
      setInputValue(value);
    }
  };

  const handleBlur = (e: any) => {
    updateCycleNumber(e);
  };

  useEffect(() => {
    setInputValue(cycleNumber);
  }, [cycleNumber]);

  return (
    <div
      className="cycles-box flex flex-row gap-1 w-48 justify-around bg-white"
      id="cycles-view"
      style={{
        transform: `scale(${props.scale})`,
      }}
    >
      Cycles:
      <div className="text-center flex flex-row gap-2">
        <div>{currentCycle}</div>
        <div>/</div>
        <div className="w-12">
          <input
            type="number"
            value={inputValue}
            onChange={handleOnChangeEvent}
            onBlur={handleBlur}
          />
        </div>
      </div>
    </div>
  );
}
