// Components
import { FlowStatusView } from "../FlowStatus/flow_status";
import { openFlow, useGetRecentFlows } from "../FlowStatus/recent_flows";
import RotatingLines from "../RotatingLines/rotatinglines";
import HorusContainer from "../HorusContainer/horus_container";

// Icons
import TrashIcon from "../Toolbar/Icons/Trash";

// Types
import { Flow, FlowStatus } from "../FlowBuilder/flow.types";

// Styling
import "./webappflows.css";
import CloudDownload from "../Toolbar/Icons/CloudDownload";
import { useState } from "react";
import { BlurredModal } from "../reusable";
import { render, unmountComponentAtNode } from "react-dom";
import { horusPost } from "../../Utils/utils";
import OpenFlowIcon from "../Toolbar/Icons/Open";

export default function WebAppUserFlows() {
  // Get the recent flows with the custom hook
  const [, recentFlows, , getFlows] = useGetRecentFlows();

  if (recentFlows.length === 0) {
    return null;
  }

  return (
    <HorusContainer
      className="w-full flex flex-col justify-center items-center gap-2"
      style={{
        maxWidth: "1075px",
        minWidth: "650px",
      }}
    >
      <h1 className="text-xl font-semibold">Your Flows</h1>
      <div className="flow-table w-full p-2 svg-container">
        <div className="header-row">Name</div>
        <div className="header-row">Date</div>
        <div className="header-row">Size</div>
        <div className="header-row">Duration</div>
        <div className="header-row">Status</div>
        <div className="header-row">Open</div>
        <div className="header-row">Download</div>
        <div className="header-row">Delete</div>
        <hr className="p-0 m-0 w-full"></hr>
        <hr className="p-0 m-0 w-full"></hr>
        <hr className="p-0 m-0 w-full"></hr>
        <hr className="p-0 m-0 w-full"></hr>
        <hr className="p-0 m-0 w-full"></hr>
        <hr className="p-0 m-0 w-full"></hr>
        <hr className="p-0 m-0 w-full"></hr>
        <hr className="p-0 m-0 w-full"></hr>
        {recentFlows.map((flow) => (
          <FlowRowView key={flow.savedID} flow={flow} getFlows={getFlows} />
        ))}
      </div>
    </HorusContainer>
  );
}

function FlowRowView({
  flow,
  getFlows,
}: {
  flow: Flow;
  getFlows: () => Promise<void>;
}) {
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadFlow = async () => {
    setIsDownloading(true);

    try {
      // Generate the tar file
      const body = JSON.stringify({
        path: flow.path,
      });

      const response = await horusPost("/users/downloadflow", null, body);

      if (!response) {
        return;
      }

      const data = await response.json();

      if (!data.ok) {
        alert("Error downloading flow: " + data.msg);
        return;
      }

      // Get the link from the response
      const downloadPath = data.path;

      // Create a link to download the file
      const link = document.createElement("a");
      link.href = `/users/downloadflow?path=${downloadPath}`;

      // Add the link to the document
      document.body.appendChild(link);

      // Click the link
      link.click();

      // Remove the link from the document
      document.body.removeChild(link);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <div className="text-center">{flow.name}</div>
      <div className="text-center">{flow.date}</div>
      <FlowSize size={flow.size} status={flow.status} />
      <FlowElapsed
        startedTime={flow.startedTime}
        finishedTime={flow.finishedTime}
        status={flow.status}
      />
      <div className="text-center">
        <FlowStatusView status={flow.status} />
      </div>
      <OpenFlowIcon
        className="cursor-pointer w-6 h-6"
        onClick={() => {
          openFlow(flow);
        }}
      />
      {isDownloading ? (
        <RotatingLines
          size="25px"
          style={{
            // Center the loading icon
            margin: "0 auto",
          }}
        />
      ) : (
        <CloudDownload
          className="cursor-pointer w-6 h-6"
          style={{
            color: "var(--pop-code)",
          }}
          onClick={downloadFlow}
        />
      )}
      <TrashIcon
        className="w-6 h-6 text-center cursor-pointer items-center justify-center"
        onClick={() => {
          DeleteFlowModal({ flow, getFlows });
        }}
        style={{
          color: "var(--danger-red)",
        }}
      />
    </>
  );
}

function FlowSize({
  size,
  status,
}: {
  size: number | undefined;
  status: FlowStatus;
}) {
  if (status === FlowStatus.FINISHED) {
    // The size are MB, but if higher than 1000, then it's GB
    if (size && size > 1000) {
      return <div>{(size / 1000).toFixed(2)} GB</div>;
    } else {
      return <div>{size ?? 0} MB</div>;
    }
  }

  if (status === FlowStatus.RUNNING) {
    return (
      <RotatingLines
        size="25px"
        style={{
          // Center the loading icon
          margin: "0 auto",
        }}
      />
    );
  }

  return <div>-</div>;
}

function FlowElapsed({
  startedTime,
  finishedTime,
  status,
}: {
  startedTime: number | undefined;
  finishedTime: number | undefined;
  status: FlowStatus;
}) {
  if (status === FlowStatus.FINISHED && startedTime && finishedTime) {
    const elapsedSeconds = finishedTime - startedTime;
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = Math.floor(elapsedSeconds % 60);

    return (
      <div>{`${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`}</div>
    );
  }

  if (status === FlowStatus.RUNNING) {
    return (
      <RotatingLines
        size="25px"
        style={{
          // Center the loading icon
          margin: "0 auto",
        }}
      />
    );
  }

  return <div>-</div>;
}

function DeleteFlowModal({
  flow,
  getFlows,
}: {
  flow: Flow;
  getFlows: () => Promise<void>;
}) {
  // Attach the modal to the body of the document
  const modal = document.createElement("div") as HTMLDivElement;
  modal.id = "delete-flow-modal";
  document.body.appendChild(modal);
  // Render the modal
  render(<_DeleteFlowModal flow={flow} getFlows={getFlows} />, modal);
}

function _DeleteFlowModal({
  flow,
  getFlows,
}: {
  flow: Flow;
  getFlows: () => Promise<void>;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  // Get the modal element
  const modal = document.getElementById("delete-flow-modal") as HTMLDivElement;

  const removeFlow = async () => {
    setIsDeleting(true);

    try {
      const body = JSON.stringify({
        path: flow.path,
      });

      const response = await horusPost("/users/deleteflow", null, body);

      if (!response) {
        setIsDeleting(false);
        return;
      }

      const data = await response.json();

      if (!data.ok) {
        alert("Error deleting flow: " + data.msg);
      } else {
        // Get the flows again
        await getFlows();

        setIsDeleting(false);

        unmountComponentAtNode(modal);
        modal.remove();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <BlurredModal
      show={true}
      onHide={() => {
        // Prevent hidding by clicking outside the modal. Instead, use the buttons
        // This is to prevent the user going back to the main page while deleting a flow
        // unmountComponentAtNode(modal);
        // modal.remove();
      }}
    >
      <div className="flex flex-col gap-2">
        <div
          className="text-xl font-semibold flow-title"
          style={{
            height: "unset",
          }}
        >
          Delete Flow
        </div>
        <hr
          style={{
            width: "100%",
            margin: "0 0",
          }}
        ></hr>
        <p className="text-center">
          <div>Are you sure you want to delete this flow?</div> Everything will
          be removed.
        </p>
        <p className="text-center font-semibold">{flow.name}</p>
        <div className="flex flex-row justify-center gap-2">
          {isDeleting ? (
            <>
              <RotatingLines />
            </>
          ) : (
            <>
              <button
                className="app-button btn-danger"
                style={{
                  color: "var(--danger-red)",
                }}
                onClick={() => {
                  removeFlow();
                }}
              >
                Delete
              </button>
              <button
                className="app-button btn-secondary"
                onClick={() => {
                  unmountComponentAtNode(modal);
                  modal.remove();
                }}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </BlurredModal>
  );
}
