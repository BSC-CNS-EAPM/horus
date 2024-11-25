// Horus components
import SidebarView from "../../SidebarView/sidebar_view";

// Flow status
import { FlowStatusView } from "../../FlowStatus/flow_status";

// TS types
import { Block, BlockTypes, FlowStatus } from "../flow.types";
import { HorusLazyLog } from "../../HorusLazyLog/HorusLazyLog";

type BlockLogsViewProps = {
  block: Block;
};

export type LogsData = {
  message: string;
  blockID: string;
  placedID: number;
};

export function BlockLogsView(props: BlockLogsViewProps) {
  const { block } = props;

  return block.type === BlockTypes.SLURM ? (
    <SlurmOutputModalView block={block} />
  ) : (
    <RegularBlockLogs block={block} />
  );
}

function RegularBlockLogs({ block }: { block: Block }) {
  return (
    <HorusLazyLog
      logText={block.blockLogs ?? "No logs"}
      filename={`${block.id}-${block.placedID}.log`}
    />
  );
}

function SlurmOutputModalView({ block }: { block: Block }) {
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
    groupedViews["Block logs"] = [<RegularBlockLogs block={block} />];

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
        key={"slurm-output"}
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
            filename={`${block.id}-${block.placedID}-slurm.out`}
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
        key={"slurm-error"}
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
            filename={`${block.id}-${block.placedID}-slurm.err`}
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
    <div className="flex flex-col h-full p-2">
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
          </div>
        </div>
        <hr className="my-4 p-0"></hr>
      </div>
      <SidebarView views={getGroupedVariables()} />
    </div>
  );
}
