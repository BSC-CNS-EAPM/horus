// Components
import { FlowStatusView } from "../FlowStatus/flow_status";
import { CorruptedFlow, useGetRecentFlows } from "../FlowStatus/recent_flows";
import RotatingLines from "../RotatingLines/rotatinglines";
import HorusContainer from "../HorusContainer/horus_container";
import { BlurredModal, HorusLink } from "../reusable";
import { FlowElapsed } from "../FlowStatus/flow_elapsed";

// Icons
import TrashIcon from "../Toolbar/Icons/Trash";
import OpenFlowIcon from "../Toolbar/Icons/Open";
import CopyIcon from "../Toolbar/Icons/Copy";

// Types
import { Flow, FlowStatus } from "../FlowBuilder/flow.types";

// Styling
import "./webappflows.css";
import CloudDownload from "../Toolbar/Icons/CloudDownload";

// React
import { useEffect, useState } from "react";
import { render, unmountComponentAtNode } from "react-dom";

// Utils
import { horusPost } from "../../Utils/utils";
import { FileData } from "chonky";
import { useAlert } from "../HorusPrompt/horus_alert";
import { useConfirm } from "../HorusPrompt/horus_confirm";

export default function WebAppUserFlows() {
  // Get the recent flows with the custom hook
  const {
    isLoading: fetchingRecents,
    recentFlows,
    otherDirectories,
    corruptedFlows,
    refetch: getFlows,
  } = useGetRecentFlows(true);

  const [hasFetchedInitally, setHasFetchedInitally] = useState(false);

  useEffect(() => {
    if (recentFlows) {
      setHasFetchedInitally(true);
    }
  }, [recentFlows]);

  if (fetchingRecents && !hasFetchedInitally) {
    return (
      <div className="mt-16 grid place-items-center">
        <RotatingLines />
        <span
          className="text-xl font-semibold"
          style={{
            color: "var(--digital-grey-IV)",
          }}
        >
          Loading flows
        </span>
      </div>
    );
  }

  return (
    <>
      {recentFlows && recentFlows.length > 0 && (
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
            <div className="header-row">Clone</div>
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
            <hr className="p-0 m-0 w-full"></hr>
            {recentFlows.map((flow) => (
              <FlowRowView key={flow.savedID} flow={flow} getFlows={getFlows} />
            ))}
          </div>
        </HorusContainer>
      )}
      {corruptedFlows && corruptedFlows.length > 0 && (
        <HorusContainer
          className="w-full flex flex-col justify-center items-center gap-2"
          style={{
            maxWidth: "1075px",
            minWidth: "650px",
          }}
        >
          <h1 className="text-xl font-semibold">Corrupted flows</h1>
          <div className="download-file-table w-full p-2 svg-container">
            <div className="header-row">Name</div>
            <div className="header-row">Date</div>
            <div className="header-row">Size</div>
            <div className="header-row">Reason</div>
            <div className="header-row">Download</div>
            <div className="header-row">Delete</div>
            <hr className="p-0 m-0 w-full"></hr>
            <hr className="p-0 m-0 w-full"></hr>
            <hr className="p-0 m-0 w-full"></hr>
            <hr className="p-0 m-0 w-full"></hr>
            <hr className="p-0 m-0 w-full"></hr>
            <hr className="p-0 m-0 w-full"></hr>
            {corruptedFlows.map((corr) => (
              <CorruptedFlowView
                key={corr.id}
                corruptedFlow={corr}
                getFlows={getFlows}
              />
            ))}
          </div>
        </HorusContainer>
      )}
      {otherDirectories && otherDirectories.length > 0 && (
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

function CorruptedFlowView(props: {
  corruptedFlow: CorruptedFlow;
  getFlows: () => void;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const horusConfirm = useConfirm();

  const downloadFile = async () => {
    setIsDownloading(true);

    try {
      // Create a link to download the file
      const link = document.createElement("a");
      const safeURL = encodeURIComponent(props.corruptedFlow["path"]);
      link.href = `${window.__HORUS_ROOT__}/users/downloadfile?path=${safeURL}`;

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

  const horusAlert = useAlert();

  const deleteFile = async () => {
    setIsDeleting(true);

    try {
      const body = JSON.stringify({
        path: props.corruptedFlow["path"],
      });

      const response = await horusPost("/users/deletefile", null, body);

      if (!response) {
        setIsDeleting(false);
        return;
      }

      const data = await response.json();

      if (!data.ok) {
        await horusAlert("Error deleting file: " + data.msg);
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
      <div className="overflow-x-auto">{props.corruptedFlow.name}</div>
      <div>{props.corruptedFlow.modDate?.toString().split(".")[0] ?? "-"}</div>
      <div>
        <FlowSize size={props.corruptedFlow.size} />
      </div>
      <div className="overflow-x-auto">{props.corruptedFlow.reason}</div>
      <CloudDownload
        className="cursor-pointer w-6 h-6"
        style={{
          color: "var(--pop-code)",
        }}
        onClick={downloadFile}
      />
      <TrashIcon
        className="w-6 h-6 text-center cursor-pointer items-center justify-center"
        onClick={async () => {
          if (
            await horusConfirm(
              "Do you want to delete this corrupted flow? This action is irreversible.",
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

function OtherFileView(props: { directory: FileData; getFlows: () => void }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const downloadFile = async () => {
    setIsDownloading(true);

    try {
      // Create a link to download the file
      const link = document.createElement("a");
      const safeURL = encodeURIComponent(props.directory["path"]);
      link.href = `${window.__HORUS_ROOT__}/users/downloadfile?path=${safeURL}`;

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

  const horusAlert = useAlert();
  const horusConfirm = useConfirm();

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
        await horusAlert("Error deleting file: " + data.msg);
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
      <div className="overflow-x-auto">{props.directory.name}</div>
      <div>{props.directory.modDate?.toString().split(".")[0] ?? "-"}</div>
      <div>
        <FlowSize size={props.directory.size} />
      </div>
      <div>
        {props.directory.isDir ? "Folder" : (props.directory.ext ?? "Unknown")}
      </div>
      <CloudDownload
        className="cursor-pointer w-6 h-6"
        style={{
          color: "var(--pop-code)",
        }}
        onClick={downloadFile}
      />
      <TrashIcon
        className="w-6 h-6 text-center cursor-pointer items-center justify-center"
        onClick={async () => {
          if (
            await horusConfirm(
              "Do you want to delete this file? This action is irreversible.",
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

function FlowRowView({ flow, getFlows }: { flow: Flow; getFlows: () => void }) {
  return (
    <>
      <div className="text-center overflow-x-auto">{flow.name}</div>
      <div className="text-center">{flow.date}</div>
      <FlowSize size={flow.size} />
      <FlowElapsed
        startedTime={flow.startedTime}
        finishedTime={flow.finishedTime}
        elapsed={flow.elapsed}
      />
      <div className="text-center flex justify-center items-baseline">
        <FlowStatusView status={flow.status} />
      </div>
      <HorusLink
        to={`/flow?open=true&flowID=${flow.savedID}&path=${flow.path}`}
      >
        <OpenFlowIcon className="cursor-pointer w-6 h-6" />
      </HorusLink>
      <FlowClone flow={flow} getFlows={getFlows} />
      <FlowDownload flow={flow} />
      <DeleteFlow flow={flow} getFlows={getFlows} />
    </>
  );
}

function DeleteFlow({ flow, getFlows }: { flow: Flow; getFlows: () => void }) {
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

  const horusAlert = useAlert();

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
        await horusAlert("Error downloading flow: " + data.msg);
        return;
      }

      // Create a link to download the file
      const link = document.createElement("a");
      const safeURL = encodeURIComponent(data.path);
      link.href = `${window.__HORUS_ROOT__}/users/downloadflow?path=${safeURL}`;

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

  return (
    <div className="h-6 text-center cursor-pointer items-center justify-center flex">
      {isDownloading ? (
        <RotatingLines size="25px" />
      ) : (
        <CloudDownload
          className="cursor-pointer w-6 h-6"
          style={{
            color: "var(--pop-code)",
          }}
          onClick={downloadFlow}
        />
      )}
    </div>
  );
}

function FlowClone({ flow, getFlows }: { flow: Flow; getFlows: () => void }) {
  const [isCloning, setIsCloning] = useState(false);

  const horusAlert = useAlert();

  const cloneFlow = async () => {
    setIsCloning(true);

    try {
      // Generate the tar file
      const body = JSON.stringify({
        path: flow.path,
      });

      const response = await horusPost("/users/clone_flow", null, body);

      if (!response) {
        return;
      }

      const data = await response.json();

      if (!data.ok) {
        await horusAlert("Error cloning flow: " + data.msg);
        return;
      }

      getFlows();
    } finally {
      setIsCloning(false);
    }
  };

  if (flow.status === FlowStatus.RUNNING || flow.status === FlowStatus.QUEUED) {
    return <div>-</div>;
  }

  if (isCloning) {
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

  return <CopyIcon className="cursor-pointer w-6 h-6" onClick={cloneFlow} />;
}

function FlowSize({ size }: { size?: number }) {
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
  getFlows: () => void;
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
  getFlows: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  // Get the modal element
  const modal = document.getElementById("delete-flow-modal") as HTMLDivElement;

  const horusAlert = useAlert();

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
        await horusAlert("Error deleting flow: " + data.msg);
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
                className="app-button btn-secondary"
                onClick={() => {
                  unmountComponentAtNode(modal);
                  modal.remove();
                }}
              >
                Cancel
              </button>
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
            </>
          )}
        </div>
      </div>
    </BlurredModal>
  );
}
