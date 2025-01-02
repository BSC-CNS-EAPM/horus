// Horus components
import SidebarView from "../../SidebarView/sidebar_view";

// Flow status
import { FlowStatusView } from "../../FlowStatus/flow_status";

// TS types
import { Block, BlockTypes, FlowStatus } from "../flow.types";
import { HorusLazyLog } from "../../HorusLazyLog/HorusLazyLog";
import { HorusViewTabs, Tab } from "@/Components/Tabs";
import { ReactNode } from "react";
import LogFile from "@/Components/Toolbar/Icons/LogFile";

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
  const tabs = () => {
    const t: { [key: string]: Tab } = {};

    t["logs"] = {
      title: "Block",
      icon: <LogFile />,
      view: <RegularBlockLogs block={block} />,
    };

    block.jobID?.forEach((jobID) => {
      const words = block.detailedStatus?.[jobID]?.split(" ");
      let status = words?.find((word) => word.startsWith("JobState="));
      status = status?.split("=")[1] ?? "Unknown";

      const parsedStatus = () => {
        // We need to use a different flow status for slurm
        // because for the IDLE we do not want to use the "Saved" status
        switch (status) {
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
            return <div className="font-semibold">Status: {status} </div>;
        }
      };

      const statusNode = parsedStatus();

      t[jobID] = {
        title: `${jobID}`,
        icon: statusNode,
        view: (
          <SingleSlurmJobView
            block={block}
            jobID={jobID}
            detailedStatus={block.detailedStatus?.[jobID]}
            status={statusNode}
            stdOut={block.stdOut?.[jobID]}
            stdErr={block.stdErr?.[jobID]}
          />
        ),
      };
    });
    return t;
  };

  return <HorusViewTabs tabs={tabs()} />;
}

function SingleSlurmJobView({
  block,
  jobID,
  status,
  detailedStatus,
  stdOut,
  stdErr,
}: {
  block: Block;
  jobID: number;
  status: ReactNode;
  detailedStatus?: string;
  stdOut?: string;
  stdErr?: string;
}) {
  const groupedViews: Record<string, React.ReactNode[]> = {};

  const worldList = () => {
    const words = detailedStatus?.split(" ");
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

  const getGroupedVariables = () => {
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
            logText={stdOut ?? ""}
            filename={`${block.id}-${block.placedID}-${jobID}-slurm.out`}
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
            logText={stdErr ?? ""}
            filename={`${block.id}-${block.placedID}-${jobID}-slurm.err`}
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
            {block.name} - {jobID ?? "No job ID"}
          </div>
          <div className="flex flex-row gap-4 items-center">{status}</div>
        </div>
        <hr className="my-4 p-0"></hr>
      </div>
      <SidebarView views={getGroupedVariables()} />
    </div>
  );
}
