// Components
import { FlowStatusView } from "../FlowStatus/flow_status";
import { openFlow, useGetRecentFlows } from "../FlowStatus/recent_flows";
import RotatingLines from "../RotatingLines/rotatinglines";
import HorusContainer from "../HorusContainer/horus_container";
import { BlurredModal } from "../reusable";
import { FlowElapsed } from "../FlowStatus/flow_elapsed";

// Icons
import TrashIcon from "../Toolbar/Icons/Trash";
import OpenFlowIcon from "../Toolbar/Icons/Open";

// Types
import { Flow, FlowStatus } from "../FlowBuilder/flow.types";

// Styling
import "./webappflows.css";
import CloudDownload from "../Toolbar/Icons/CloudDownload";

// React
import { useState } from "react";
import { render, unmountComponentAtNode } from "react-dom";

// Utils
import { horusPost } from "../../Utils/utils";
import { FileData } from "chonky";

export default function WebAppUserFlows() {
  // Get the recent flows with the custom hook
  const [, recentFlows, , getFlows, , otherDirectories] =
    useGetRecentFlows(true);

  if (recentFlows.length === 0) {
    return null;
  }

  return (
    <>
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
      {otherDirectories.length > 0 && (
        <HorusContainer
          className="w-full flex flex-col justify-center items-center gap-2"
          style={{
            maxWidth: "1075px",
            minWidth: "650px",
          }}
        >
          <h1 className="text-xl font-semibold">Other files</h1>
          <div className="download-file-table w-full p-2 svg-container">
            <div className="header-row">Name</div>
            <div className="header-row">Date</div>
            <div className="header-row">Size</div>
            <div className="header-row">Type</div>
            <div className="header-row">Download</div>
            <div className="header-row">Delete</div>
            <hr className="p-0 m-0 w-full"></hr>
            <hr className="p-0 m-0 w-full"></hr>
            <hr className="p-0 m-0 w-full"></hr>
            <hr className="p-0 m-0 w-full"></hr>
            <hr className="p-0 m-0 w-full"></hr>
            <hr className="p-0 m-0 w-full"></hr>
            {otherDirectories.map((dir) => (
              <OtherFileView key={dir.id} directory={dir} getFlows={getFlows} />
            ))}
          </div>
        </HorusContainer>
      )}
    </>
  );
}

function OtherFileView(props: {
  directory: FileData;
  getFlows: () => Promise<void>;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const downloadFile = async () => {
    setIsDownloading(true);

    try {
      // Create a link to download the file
      const link = document.createElement("a");
      link.href = `/users/downloadfile?path=${props.directory["path"]}`;

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

  const deleteFile = async () => {
    setIsDeleting(true);

    try {
      const body = JSON.stringify({
        path: props.directory["path"],
      });

      const response = await horusPost("/users/deletefile", null, body);

      if (!response) {
        setIsDeleting(false);
        return;
      }

      const data = await response.json();

      if (!data.ok) {
        alert("Error deleting file: " + data.msg);
      } else {
        // Get the flows again
        await props.getFlows();

        setIsDeleting(false);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (isDownloading || isDeleting) {
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

  return (
    <>
      <div>{props.directory.name}</div>
      <div>{props.directory.modDate?.toString().split(".")[0] ?? "-"}</div>
      <div>
        <FlowSize size={props.directory.size} status={FlowStatus.FINISHED} />
      </div>
      <div>{props.directory.isDir ? "Folder" : props.directory.ext}</div>
      <CloudDownload
        className="cursor-pointer w-6 h-6"
        style={{
          color: "var(--pop-code)",
        }}
        onClick={downloadFile}
      />
      <TrashIcon
        className="w-6 h-6 text-center cursor-pointer items-center justify-center"
        onClick={() => {
          if (
            confirm(
              "Do you want to delete this file? This action is irreversible."
            )
          ) {
            deleteFile();
          }
        }}
        style={{
          color: "var(--danger-red)",
        }}
      />
    </>
  );
}

function FlowRowView({
  flow,
  getFlows,
}: {
  flow: Flow;
  getFlows: () => Promise<void>;
}) {
  return (
    <>
      <div className="text-center">{flow.name}</div>
      <div className="text-center">{flow.date}</div>
      <FlowSize size={flow.size} status={flow.status} />
      <FlowElapsed
        startedTime={flow.startedTime}
        finishedTime={flow.finishedTime}
        elapsed={flow.elapsed}
      />
      <div className="text-center flex items-center justify-center">
        <FlowStatusView status={flow.status} />
      </div>
      <OpenFlowIcon
        className="cursor-pointer w-6 h-6"
        onClick={() => {
          openFlow(flow);
        }}
      />
      <FlowDownload flow={flow} />
      <DeleteFlow flow={flow} getFlows={getFlows} />
    </>
  );
}

function DeleteFlow({
  flow,
  getFlows,
}: {
  flow: Flow;
  getFlows: () => Promise<void>;
}) {
  if (flow.status === FlowStatus.RUNNING || flow.status === FlowStatus.QUEUED) {
    return <div>-</div>;
  }

  return (
    <TrashIcon
      className="w-6 h-6 text-center cursor-pointer items-center justify-center"
      onClick={() => {
        DeleteFlowModal({ flow, getFlows });
      }}
      style={{
        color: "var(--danger-red)",
      }}
    />
  );
}

function FlowDownload({ flow }: { flow: Flow }) {
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

  if (flow.status === FlowStatus.RUNNING || flow.status === FlowStatus.QUEUED) {
    return <div>-</div>;
  }

  if (isDownloading) {
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

  return (
    <CloudDownload
      className="cursor-pointer w-6 h-6"
      style={{
        color: "var(--pop-code)",
      }}
      onClick={downloadFlow}
    />
  );
}

function FlowSize({ size }: { size: number | undefined; status: FlowStatus }) {
  if (size || size === 0) {
    // The size are MB, but if higher than 1000, then it's GB
    if (size > 1000) {
      return <div>{(size / 1000).toFixed(2)} GB</div>;
    } else if (size < 1) {
      return <div>{(size * 1000).toFixed(2)} KB</div>;
    } else {
      return <div>{size.toFixed(2) ?? 0} MB</div>;
    }
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
