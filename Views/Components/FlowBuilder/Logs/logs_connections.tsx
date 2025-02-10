// React
import { useState } from "react";

// Horus components
import SidebarView from "../../SidebarView/sidebar_view";
import AppButton from "@/Components/appbutton";
import { horusGet } from "@/Utils/utils";
import LogFile from "@/Components/Toolbar/Icons/LogFile";

// Flow status
import { FlowStatusView } from "../../FlowStatus/flow_status";

// TS types
import {
  Block,
  BlockTypes,
  FlowStatus,
  Status,
  SlurmJob,
  JobStatus,
} from "../flow.types";
import { HorusLazyLog } from "../../HorusLazyLog/HorusLazyLog";
import { HorusViewTabs, Tab } from "@/Components/Tabs";

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

    block.jobs?.forEach((job) => {
      const statusNode = (() => {
        // We need to use a different flow status for slurm
        // because for the IDLE we do not want to use the "Saved" status
        switch (job.JobState) {
          case Status.COMPLETED:
            return <FlowStatusView status={FlowStatus.FINISHED} />;
          case Status.FAILED:
            return <FlowStatusView status={FlowStatus.ERROR} />;
          case Status.PENDING:
            return <FlowStatusView status={FlowStatus.QUEUED} />;
          case Status.RUNNING:
            return <FlowStatusView status={FlowStatus.RUNNING} />;
          case Status.CANCELLED:
            return <FlowStatusView status={FlowStatus.STOPPED} />;
          default:
            return <div className="font-semibold">Status: {job.JobState} </div>;
        }
      })();

      t[job.JobId] = {
        title: `${job.JobId}`,
        icon: statusNode,
        view: <SingleSlurmJobView block={block} job={job} />,
      };
    });
    return t;
  };

  return <SidebarView tabs={tabs()} />;
}

function SingleSlurmJobView({ block, job }: { block: Block; job: SlurmJob }) {
  const groupedViews: Record<string, Tab> = {};

  const detailedStatus = (() => {
    // Filter keys to appear on the detailed status page
    const FILTER = ["StdOutContent", "StdErrContent", "SubmissionScript"];

    const words = Object.keys(job).filter((k) => !FILTER.includes(k)) as Array<
      keyof SlurmJob
    >;

    return (
      <div>
        {words?.map((key) => {
          return (
            <tr key={key}>
              <td className="select-auto" style={{ paddingLeft: "15px" }}>
                {key}
              </td>
              <td
                className="select-auto"
                style={{ paddingLeft: "25px" }}
              >{`${job[key]}`}</td>
            </tr>
          );
        })}
      </div>
    );
  })();

  const getGroupedVariables = () => {
    groupedViews["Slurm status"] = {
      title: "Status",
      view: (
        <div
          className="flex flex-row flex-wrap p-2"
          style={{
            background: "var(--grey-white)",
            borderRadius: "10px",
            borderColor: "lightgray",
            fontFamily: "Poppins",
            height: "100%",
            overflowY: "auto",
          }}
        >
          {detailedStatus}
        </div>
      ),
    };

    groupedViews["Slurm script"] = {
      title: "Script",
      view: (
        <div
          key={"slurm-script"}
          style={{
            background: "var(--grey-white)",
            borderRadius: "10px",
            borderColor: "lightgray",
            fontFamily: "Poppins",
            overflow: "hidden",
            height: "100%",
          }}
        >
          <HorusLazyLog
            logText={job.SubmissionScript ?? ""}
            filename={`${block.id}-${block.placedID}-${job.JobId}-slurm.sh`}
            format="shell"
          />
        </div>
      ),
    };

    groupedViews["Slurm output"] = {
      title: "Output",
      view: (
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
          <HorusLazyLog
            logText={job.StdOutContent ?? ""}
            filename={`${block.id}-${block.placedID}-${job.JobId}-slurm.out`}
          />
        </div>
      ),
    };

    groupedViews["Slurm error"] = {
      title: "Error",
      view: (
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
          <HorusLazyLog
            logText={job.StdErrContent ?? ""}
            filename={`${block.id}-${block.placedID}-${job.JobId}-slurm.err`}
          />
        </div>
      ),
    };

    return groupedViews;
  };

  const isJobRunning = JobStatus.RUNNING_STATUSES().includes(job.JobState);

  const [cancelling, setCancelling] = useState(false);

  return (
    <div className="flex flex-col h-full p-4">
      <div className="sticky top-0 z-10">
        <div className="variables-modal-title-search gap-2">
          <div
            className="font-semibold text-3xl break-all"
            style={{
              color: "var(--digital-grey-IV)",
            }}
          >
            {block.name} - {job.JobId}
          </div>
          {isJobRunning && (
            <AppButton
              disabled={cancelling}
              action={() => {
                setCancelling(true);
                const path = "/api/plugins/cancel-job";
                const searchParams = new URLSearchParams();
                searchParams.append("jobID", job.JobId);
                searchParams.append("remote", block.selectedRemote);

                horusGet(`${path}?${searchParams.toString()}`)
                  .then((r) => r.json())
                  .then((d) => {
                    if (!d.ok) {
                      alert(`${d.msg}`);
                    }
                  })
                  .catch((e) => alert(e))
                  .finally(() => setCancelling(false));
              }}
            >
              {cancelling ? "Cancelling" : "Cancel"}
            </AppButton>
          )}
        </div>
        <hr className="my-4 p-0"></hr>
      </div>
      <HorusViewTabs tabs={getGroupedVariables()} />
    </div>
  );
}
