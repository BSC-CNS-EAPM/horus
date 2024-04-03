import RotatingLines from "../RotatingLines/rotatinglines";
import { FlowStatus } from "../FlowBuilder/flow.types";
import ErrorIcon from "../Toolbar/Icons/Error";
import CheckMark from "../Toolbar/Icons/CheckMark";
import ChronoIcon from "../Toolbar/Icons/Chrono";
import StopIcon from "../Toolbar/Icons/Stop";
import PausedIcon from "../Toolbar/Icons/Paused";

type FlowStatusViewProps = {
  status: FlowStatus;
} & React.HTMLAttributes<HTMLDivElement>;

function FlowStatusView(props: FlowStatusViewProps) {
  const { status } = props;

  switch (status) {
    case FlowStatus.RUNNING:
      return <RunningFlowStatus />;
    case FlowStatus.PAUSED:
      return <PausedFlowStatus />;
    case FlowStatus.STOPPED:
      return <StoppedFlowStatus />;
    case FlowStatus.FINISHED:
      return <FinishedFlowStatus />;
    case FlowStatus.ERROR:
      return <ErrorFlowStatus />;
    case FlowStatus.QUEUED:
      return <QueuedFlowStatus />;
    case FlowStatus.CANCELLING:
      return <CancellingFlowStatus />;
    case FlowStatus.IDLE:
      return <IdleFlowStatus />;
    default:
      return null;
  }
}

type FlowStatusBaseProps = {
  children: React.ReactNode;
  color: "red" | "orange" | "blue" | "green" | "purple" | "black";
};

function FlowStatusBase(props: FlowStatusBaseProps) {
  const colorStyle = {
    red: "text-red-500",
    orange: "text-orange-500",
    blue: "text-blue-500",
    green: "text-green-500",
    purple: "text-purple-500",
    black: "",
  };

  const classColorName = colorStyle[props.color];

  const className = `flow-status ${classColorName}`;

  return (
    <div
      className={className}
      style={{
        color: props.color === "black" ? "var(--digital-grey-IV)" : "",
      }}
    >
      {props.children}
    </div>
  );
}

function IdleFlowStatus() {
  return (
    <FlowStatusBase color="black">
      <div>Saved</div>
      <CheckMark />
    </FlowStatusBase>
  );
}

function QueuedFlowStatus() {
  return (
    <FlowStatusBase color="purple">
      <div>Queued</div>
      <ChronoIcon />
    </FlowStatusBase>
  );
}

function RunningFlowStatus() {
  return (
    <FlowStatusBase color="blue">
      <div>Running</div>
      <RotatingLines size={"1.5rem"} />
    </FlowStatusBase>
  );
}

function PausedFlowStatus() {
  return (
    <FlowStatusBase color="orange">
      <div>Paused</div>
      <PausedIcon />
    </FlowStatusBase>
  );
}

function StoppedFlowStatus() {
  return (
    <FlowStatusBase color="red">
      <div>Stopped</div>
      <StopIcon />
    </FlowStatusBase>
  );
}

function CancellingFlowStatus() {
  return (
    <FlowStatusBase color="red">
      <div>Cancelling</div>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 9.563C9 9.252 9.252 9 9.563 9h4.874c.311 0 .563.252.563.563v4.874c0 .311-.252.563-.563.563H9.564A.562.562 0 019 14.437V9.564z"
        />
      </svg>
    </FlowStatusBase>
  );
}

function FinishedFlowStatus() {
  return (
    <FlowStatusBase color="green">
      Finished
      <CheckMark />
    </FlowStatusBase>
  );
}

function ErrorFlowStatus() {
  return (
    <FlowStatusBase color="red">
      Failed
      <ErrorIcon />
    </FlowStatusBase>
  );
}

export { FlowStatusView };
