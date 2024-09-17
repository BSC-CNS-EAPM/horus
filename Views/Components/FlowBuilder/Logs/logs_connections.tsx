// Horus components
import SidebarView from "../../SidebarView/sidebar_view";

// Flow status
import { FlowStatusView } from "../../FlowStatus/flow_status";

// TS types
import { Block, BlockTypes, FlowStatus } from "../flow.types";
import AppButton from "../../appbutton";
import { BlurredModal } from "../../reusable";
import { HorusLazyLog } from "../../HorusLazyLog/HorusLazyLog";

type BlockLogsModalViewProps = {
  block: Block;
  handleClose: () => void;
};

export function BlockLogsModalView(props: BlockLogsModalViewProps) {
  const { block, handleClose } = props;

  return (
    <BlurredModal
      show
      noMargin={block.type !== BlockTypes.SLURM}
      onHide={() => {
        handleClose?.();
      }}
      maxContentSize={{
        height: "h-[85%]",
        width: "w-[60%]",
      }}
    >
      {block.type === BlockTypes.SLURM ? (
        <SlurmOutputModalView block={block} handleClose={handleClose} />
      ) : (
        <RegularBlockLogs logs={block.blockLogs} isRunning={block.isRunning} />
      )}
    </BlurredModal>
  );
}

function RegularBlockLogs({
  logs,
  isRunning,
}: {
  logs: string;
  isRunning: boolean;
}) {
  return (
    <div
      style={{
        height: "100%",
        borderRadius: "10px",
        overflow: "hidden",
      }}
    >
      <HorusLazyLog logText={logs ?? "No logs"} keepDisabled={!isRunning} />
    </div>
  );
}

function SlurmOutputModalView({
  block,
  handleClose,
}: {
  block: Block;
  handleClose: () => void;
}) {
  const groupedViews: Record<string, React.ReactNode[]> = {};

  const worldList = () => {
    const words = block?.detailedStatus?.split(" ");
    return (
      <div>
        {words?.map((word) => {
          let title = "Error";
          let value = "Error";
          try {
            title = word.split("=")[0] as string;
            value = word.split("=")[1] as string;
          } catch {}
          return (
            <tr>
              <td style={{ paddingLeft: "15px" }}>{title}</td>
              <td style={{ paddingLeft: "25px" }}>{value}</td>
            </tr>
          );
        })}
      </div>
    );
  };

  const parsedStatus = () => {
    // We need to use a different flow status for slurm
    // because for the IDLE we do not want to use the "Saved" status
    switch (block.status) {
      case "COMPLETED":
        return <FlowStatusView status={FlowStatus.FINISHED} />;
      case "FAILED":
        return <FlowStatusView status={FlowStatus.ERROR} />;
      case "PENDING":
        return <FlowStatusView status={FlowStatus.QUEUED} />;
      case "RUNNING":
        return <FlowStatusView status={FlowStatus.RUNNING} />;
      case "CANCELLED":
        return <FlowStatusView status={FlowStatus.STOPPED} />;
      default:
        return <div className="font-semibold">Status: {block.status} </div>;
    }
  };

  const getGroupedVariables = () => {
    groupedViews["Block logs"] = [
      <RegularBlockLogs logs={block.blockLogs} isRunning={block.isRunning} />,
    ];

    groupedViews["Slurm status"] = [
      <div
        className="flex flex-row gap-2 flex-wrap p-2"
        style={{
          background: "var(--grey-white)",
          borderRadius: "10px",
          borderColor: "lightgray",
          fontFamily: "Poppins",
          height: "100%",
          overflowY: "auto",
        }}
      >
        {block.detailedStatus ? (
          worldList()
        ) : (
          <span className="text-center w-full grid place-items-center h-full">
            No job status
          </span>
        )}
      </div>,
    ];

    groupedViews["Slurm output"] = [
      <div
        style={{
          background: "var(--grey-white)",
          borderRadius: "10px",
          borderColor: "lightgray",
          fontFamily: "Poppins",
          overflow: "hidden",
          height: "100%",
        }}
      >
        {block.stdOut ? (
          <HorusLazyLog
            logText={block.stdOut}
            keepDisabled={!block.isRunning}
          />
        ) : (
          <span className="text-center w-full grid place-items-center h-full">
            No output during execution
          </span>
        )}
      </div>,
    ];

    groupedViews["Slurm error"] = [
      <div
        style={{
          background: "var(--grey-white)",
          borderRadius: "10px",
          borderColor: "lightgray",
          fontFamily: "Poppins",
          overflow: "hidden",
          height: "100%",
        }}
      >
        {block.stdErr ? (
          <HorusLazyLog
            logText={block.stdErr}
            keepDisabled={!block.isRunning}
          />
        ) : (
          <span className="text-center w-full grid place-items-center h-full">
            No errors during execution
          </span>
        )}
      </div>,
    ];

    return groupedViews;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10">
        <div className="variables-modal-title-search">
          <div
            className="font-semibold text-3xl break-all"
            style={{
              color: "var(--digital-grey-IV)",
            }}
          >
            {block.name} - {block.jobID ?? "No job ID"}
          </div>
          <div className="flex flex-row gap-4 items-center">
            {parsedStatus()}
            <AppButton action={handleClose}>Close</AppButton>
          </div>
        </div>
        <hr className="my-4 p-0"></hr>
      </div>
      <SidebarView views={getGroupedVariables()} />
    </div>
  );
}
