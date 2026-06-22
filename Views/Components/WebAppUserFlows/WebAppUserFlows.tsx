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
import { FlowStatus, MinimalFlow } from "../FlowBuilder/flow.types";

// Styling
import "./webappflows.css";
import CloudDownload from "../Toolbar/Icons/CloudDownload";

// AgGrid
import { AgGridReact } from "ag-grid-react";
import { ColDef, ICellRendererParams } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

// React
import { useEffect, useMemo, useState } from "react";

// Ignore those errors until frontend-rewrite
// @ts-ignore
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
    refetch: getFlows
  } = useGetRecentFlows(true);

  const [hasFetchedInitally, setHasFetchedInitally] = useState(false);

  useEffect(() => {
    if (recentFlows) {
      setHasFetchedInitally(true);
    }
  }, [recentFlows]);

  const gridContext = useMemo(() => ({ getFlows }), [getFlows]);

  const flowColumnDefs = useMemo<ColDef<MinimalFlow>[]>(
    () => [
      {
        headerName: "Name",
        field: "name",
        flex: 2,
        cellRenderer: (p: ICellRendererParams<MinimalFlow>) => {
          if (!p.data) return p.value;
          return (
            <HorusLink
              to={`/flow?open=true&flowID=${p.data.savedID}&path=${p.data.path}`}
              className="text-decoration-none"
              style={{ color: "var(--pop-code)" }}
            >
              {p.data.name}
            </HorusLink>
          );
        }
      },
      {
        headerName: "Date",
        field: "date",
        width: 130,
        valueFormatter: (p) =>
          p.value
            ? new Date(p.value).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric"
              })
            : ""
      },
      {
        headerName: "Size",
        field: "size",
        width: 90,
        valueFormatter: (p) => formatSize(p.value)
      },
      {
        headerName: "Duration",
        field: "elapsed",
        width: 120,
        sortable: false,
        filter: false,
        cellRenderer: (p: ICellRendererParams<MinimalFlow>) => (
          <FlowElapsed
            startedTime={p.data?.startedTime}
            finishedTime={p.data?.finishedTime}
            elapsed={p.data?.elapsed ?? 0}
          />
        )
      },
      {
        headerName: "Status",
        field: "status",
        width: 120,
        cellRenderer: (p: ICellRendererParams<MinimalFlow>) => (
          <FlowStatusView status={p.data!.status} />
        ),
        filterValueGetter: (p) => p.data?.status ?? ""
      },
      {
        headerName: "Actions",
        field: "savedID",
        width: 150,
        sortable: false,
        filter: false,
        cellRenderer: FlowActionsCell
      }
    ],
    []
  );

  const corruptedColumnDefs = useMemo<ColDef<CorruptedFlow>[]>(
    () => [
      { headerName: "Name", field: "name", flex: 2 },
      {
        headerName: "Date",
        field: "modDate",
        width: 130,
        valueFormatter: (p) =>
          p.value != null ? (String(p.value).split(".")[0] ?? "-") : "-"
      },
      {
        headerName: "Size",
        field: "size",
        width: 90,
        valueFormatter: (p) => formatSize(p.value)
      },
      { headerName: "Reason", field: "reason", flex: 1 },
      {
        headerName: "Actions",
        field: "id",
        width: 90,
        sortable: false,
        filter: false,
        cellRenderer: CorruptedActionsCell
      }
    ],
    []
  );

  const otherFilesColumnDefs = useMemo<ColDef<FileData>[]>(
    () => [
      { headerName: "Name", field: "name", flex: 2 },
      {
        headerName: "Date",
        field: "modDate",
        width: 130,
        valueFormatter: (p) =>
          p.value != null ? (String(p.value).split(".")[0] ?? "-") : "-"
      },
      {
        headerName: "Size",
        field: "size",
        width: 90,
        valueFormatter: (p) => formatSize(p.value)
      },
      {
        headerName: "Type",
        field: "isDir",
        width: 90,
        valueFormatter: (p) =>
          p.data?.isDir ? "Folder" : (p.data?.ext ?? "Unknown")
      },
      {
        headerName: "Actions",
        field: "id",
        width: 90,
        sortable: false,
        filter: false,
        cellRenderer: OtherFileActionsCell
      }
    ],
    []
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({ sortable: true, resizable: true, filter: true }),
    []
  );

  if (fetchingRecents && !hasFetchedInitally) {
    return (
      <div className="mt-16 grid place-items-center">
        <RotatingLines />
        <span
          className="text-xl font-semibold"
          style={{
            color: "var(--digital-grey-IV)"
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
            minWidth: "650px"
          }}
        >
          <h1 className="text-xl font-semibold">Your Flows</h1>
          <div className="ag-theme-quartz w-full">
            <AgGridReact
              rowData={recentFlows}
              columnDefs={flowColumnDefs}
              defaultColDef={defaultColDef}
              context={gridContext}
              domLayout="autoHeight"
              suppressCellFocus
              pagination
              paginationPageSize={10}
              paginationPageSizeSelector={[10, 25, 50, 100]}
              getRowId={(p) => p.data.savedID ?? p.data.name}
            />
          </div>
        </HorusContainer>
      )}
      {corruptedFlows && corruptedFlows.length > 0 && (
        <HorusContainer
          className="w-full flex flex-col justify-center items-center gap-2"
          style={{ maxWidth: "1075px", minWidth: "650px" }}
        >
          <h1 className="text-xl font-semibold">Corrupted flows</h1>
          <div className="ag-theme-quartz w-full">
            <AgGridReact
              rowData={corruptedFlows}
              columnDefs={corruptedColumnDefs}
              defaultColDef={defaultColDef}
              context={gridContext}
              domLayout="autoHeight"
              suppressCellFocus
              pagination
              paginationPageSize={10}
              paginationPageSizeSelector={[10, 25, 50, 100]}
              getRowId={(p) => String(p.data.id ?? p.data.name)}
            />
          </div>
        </HorusContainer>
      )}
      {otherDirectories && otherDirectories.length > 0 && (
        <HorusContainer
          className="w-full flex flex-col justify-center items-center gap-2"
          style={{ maxWidth: "1075px", minWidth: "650px" }}
        >
          <h1 className="text-xl font-semibold">Other files</h1>
          <div className="ag-theme-quartz w-full">
            <AgGridReact
              rowData={otherDirectories}
              columnDefs={otherFilesColumnDefs}
              defaultColDef={defaultColDef}
              context={gridContext}
              domLayout="autoHeight"
              suppressCellFocus
              pagination
              paginationPageSize={10}
              paginationPageSizeSelector={[10, 25, 50, 100]}
              getRowId={(p) => String(p.data.id ?? p.data.name)}
            />
          </div>
        </HorusContainer>
      )}
    </>
  );
}

function CorruptedActionsCell(params: ICellRendererParams<CorruptedFlow>) {
  const corruptedFlow = params.data!;
  const { getFlows } = params.context as { getFlows: () => void };
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const horusAlert = useAlert();
  const horusConfirm = useConfirm();

  const downloadFile = async () => {
    setIsDownloading(true);
    try {
      const link = document.createElement("a");
      const safeURL = encodeURIComponent(corruptedFlow["path"]);
      link.href = `${window.__HORUS_ROOT__}/users/downloadfile?path=${safeURL}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsDownloading(false);
    }
  };

  const deleteFile = async () => {
    setIsDeleting(true);
    try {
      const body = JSON.stringify({ path: corruptedFlow["path"] });
      const response = await horusPost("/users/deletefile", null, body);
      if (!response) { setIsDeleting(false); return; }
      const data = await response.json();
      if (!data.ok) {
        await horusAlert("Error deleting file: " + data.msg);
      } else {
        await getFlows();
        setIsDeleting(false);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (isDownloading || isDeleting) {
    return (
      <div className="flex items-center h-full">
        <RotatingLines size="25px" />
      </div>
    );
  }

  return (
    <div className="flex flex-row gap-2 items-center h-full">
      <CloudDownload
        className="cursor-pointer w-5 h-5"
        style={{ color: "var(--pop-code)" }}
        onClick={downloadFile}
      />
      <TrashIcon
        className="cursor-pointer w-5 h-5"
        style={{ color: "var(--danger-red)" }}
        onClick={async () => {
          if (
            await horusConfirm(
              "Do you want to delete this corrupted flow? This action is irreversible."
            )
          ) {
            deleteFile();
          }
        }}
      />
    </div>
  );
}

function OtherFileActionsCell(params: ICellRendererParams<FileData>) {
  const directory = params.data!;
  const { getFlows } = params.context as { getFlows: () => void };
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const horusAlert = useAlert();
  const horusConfirm = useConfirm();

  const downloadFile = async () => {
    setIsDownloading(true);
    try {
      const link = document.createElement("a");
      const safeURL = encodeURIComponent(directory["path"]);
      link.href = `${window.__HORUS_ROOT__}/users/downloadfile?path=${safeURL}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsDownloading(false);
    }
  };

  const deleteFile = async () => {
    setIsDeleting(true);
    try {
      const body = JSON.stringify({ path: directory["path"] });
      const response = await horusPost("/users/deletefile", null, body);
      if (!response) { setIsDeleting(false); return; }
      const data = await response.json();
      if (!data.ok) {
        await horusAlert("Error deleting file: " + data.msg);
      } else {
        await getFlows();
        setIsDeleting(false);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (isDownloading || isDeleting) {
    return (
      <div className="flex items-center h-full">
        <RotatingLines size="25px" />
      </div>
    );
  }

  return (
    <div className="flex flex-row gap-2 items-center h-full">
      <CloudDownload
        className="cursor-pointer w-5 h-5"
        style={{ color: "var(--pop-code)" }}
        onClick={downloadFile}
      />
      <TrashIcon
        className="cursor-pointer w-5 h-5"
        style={{ color: "var(--danger-red)" }}
        onClick={async () => {
          if (
            await horusConfirm(
              "Do you want to delete this file? This action is irreversible."
            )
          ) {
            deleteFile();
          }
        }}
      />
    </div>
  );
}

function FlowActionsCell(params: ICellRendererParams<MinimalFlow>) {
  const flow = params.data!;
  const { getFlows } = params.context as { getFlows: () => void };
  const isActive =
    flow.status === FlowStatus.RUNNING || flow.status === FlowStatus.QUEUED;

  return (
    <div className="flex flex-row gap-2 items-center justify-center h-full">
      {/* <HorusLink
        to={`/flow?open=true&flowID=${flow.savedID}&path=${flow.path}`}
      >
        <OpenFlowIcon className="cursor-pointer w-5 h-5" />
      </HorusLink> */}
      {!isActive && (
        <>
          <FlowClone flow={flow} getFlows={getFlows} />
          <FlowDownload flow={flow} />
          <DeleteFlow flow={flow} getFlows={getFlows} />
        </>
      )}
    </div>
  );
}

function formatSize(size?: number): string {
  if (size !== undefined && size !== null) {
    if (size > 1000) return `${(size / 1000).toFixed(2)} GB`;
    if (size < 1) return `${(size * 1000).toFixed(2)} KB`;
    return `${size.toFixed(2)} MB`;
  }
  return "-";
}

function DeleteFlow({
  flow,
  getFlows
}: {
  flow: MinimalFlow;
  getFlows: () => void;
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
        color: "var(--danger-red)"
      }}
    />
  );
}

function FlowDownload({ flow }: { flow: MinimalFlow }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const horusAlert = useAlert();

  const downloadFlow = async () => {
    setIsDownloading(true);

    try {
      // Generate the tar file
      const body = JSON.stringify({
        path: flow.path
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
            color: "var(--pop-code)"
          }}
          onClick={downloadFlow}
        />
      )}
    </div>
  );
}

function FlowClone({
  flow,
  getFlows
}: {
  flow: MinimalFlow;
  getFlows: () => void;
}) {
  const [isCloning, setIsCloning] = useState(false);

  const horusAlert = useAlert();

  const cloneFlow = async () => {
    setIsCloning(true);

    try {
      // Generate the tar file
      const body = JSON.stringify({
        path: flow.path
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
          margin: "0 auto"
        }}
      />
    );
  }

  return <CopyIcon className="cursor-pointer w-6 h-6" onClick={cloneFlow} />;
}
function DeleteFlowModal({
  flow,
  getFlows
}: {
  flow: MinimalFlow;
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
  getFlows
}: {
  flow: MinimalFlow;
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
        path: flow.path
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
            height: "unset"
          }}
        >
          Delete Flow
        </div>
        <hr
          style={{
            width: "100%",
            margin: "0 0"
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
                  color: "var(--danger-red)"
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
