// Horus components
import SidebarView from "../../SidebarView/sidebar_view";

// Flow status
import { FlowStatusView } from "../../FlowStatus/flow_status";

// TS types
import { Block, FlowStatus } from "../flow.types";
import AppButton from "../../appbutton";
import { BlurredModal } from "../../reusable";

type SlurmOutputModalViewProps = {
  block: Block;
  handleChange: (value: any, id: string, groupID?: string) => void;
  handleClose?: () => void;
};

export function SlurmOutputModalView(props: SlurmOutputModalViewProps) {
  const { block } = props;

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
      // case "IDLE":
      //   return <FlowStatusView status={FlowStatus.IDLE} />;
      default:
        return <div className="font-semibold">Status: {block.status} </div>;
    }
  };

  const getGroupedVariables = () => {
    groupedViews["Status"] = [
      <div
        className="flex flex-row gap-2 flex-wrap p-2 shadow-md"
        style={{
          background: "var(--grey-white)",
          borderRadius: "10px",
          borderColor: "lightgray",
          fontFamily: "Poppins",
        }}
      >
        {block.detailedStatus ? (
          <div>{worldList()}</div>
        ) : (
          <span className="text-center w-full"> No job status </span>
        )}
      </div>,
    ];

    groupedViews["Output"] = [
      <div
        className="flex flex-row gap-2 flex-wrap p-2 shadow-md"
        style={{
          background: "var(--grey-white)",
          borderRadius: "10px",
          borderColor: "lightgray",
          fontFamily: "Poppins",
        }}
      >
        {block.stdOut ? (
          <pre className="pb-2">{block.stdOut}</pre>
        ) : (
          <span className="text-center w-full">No output during execution</span>
        )}
      </div>,
    ];

    groupedViews["Error"] = [
      <div
        className="flex flex-row gap-2 flex-wrap p-2 shadow-md"
        style={{
          background: "var(--grey-white)",
          borderRadius: "10px",
          borderColor: "lightgray",
          fontFamily: "Poppins",
        }}
      >
        {block.stdErr ? (
          <pre className="pb-2">{block.stdErr}</pre>
        ) : (
          <span className="text-center w-full">No errors during execution</span>
        )}
      </div>,
    ];

    return groupedViews;
  };

  return (
    <BlurredModal
      show
      onHide={() => {
        props?.handleClose?.();
      }}
      maxContentSize={{
        height: "h-[85%]",
        width: "w-[60%]",
      }}
    >
      <div className="flex flex-col h-full">
        <div className="sticky top-0 z-10">
          <div className="variables-modal-title-search">
            <div
              className="font-semibold text-3xl"
              style={{
                color: "var(--digital-grey-IV)",
              }}
            >
              {block.name} - {block.jobID ?? "No job ID"}
            </div>
            <div className="flex flex-row gap-4 items-center">
              {parsedStatus()}
              <AppButton action={props.handleClose!}>Close</AppButton>
            </div>
          </div>
          <hr className="my-4 p-0"></hr>
        </div>
        <SidebarView views={getGroupedVariables()} />
      </div>
    </BlurredModal>
  );
}
