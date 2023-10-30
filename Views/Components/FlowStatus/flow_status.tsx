import RotatingLines from "../RotatingLines/rotatinglines";
import { FlowStatus } from "../FlowBuilder/flow_builder_types";

type FlowStatusViewProps = {
  status: FlowStatus;
};

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
    default:
      return null;
  }
}

type FlowStatusBaseProps = {
  children: React.ReactNode;
  color: "red" | "orange" | "blue" | "green";
};

function FlowStatusBase(props: FlowStatusBaseProps) {
  const colorStyle = {
    red: "text-red-500",
    orange: "text-orange-500",
    blue: "text-blue-500",
    green: "text-green-500",
  };

  const classColorName = colorStyle[props.color];

  const className = `flex flex-row gap-1 items-center ${classColorName}`;

  return <div className={className}>{props.children}</div>;
}

function RunningFlowStatus() {
  return (
    <FlowStatusBase color="blue">
      <RotatingLines
        style={{
          height: "1rem",
          width: "1rem",
        }}
      />
      <div>Running</div>
    </FlowStatusBase>
  );
}

function PausedFlowStatus() {
  return (
    <FlowStatusBase color="orange">
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
          d="M14.25 9v6m-4.5 0V9M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <div>Paused</div>
    </FlowStatusBase>
  );
}

function StoppedFlowStatus() {
  return (
    <FlowStatusBase color="red">
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
      <div>Stopped</div>
    </FlowStatusBase>
  );
}

function FinishedFlowStatus() {
  return (
    <FlowStatusBase color="green">
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
          d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      Finished
    </FlowStatusBase>
  );
}

export { FlowStatusView };
