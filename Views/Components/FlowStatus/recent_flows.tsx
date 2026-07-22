// React imports
import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

// AgGrid
import { AgGridReact } from "ag-grid-react";
import { ColDef, RowClickedEvent } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

// Horus web-server
import { horusGet } from "../../Utils/utils";

// Horus components
import { FlowStatusView } from "./flow_status";
import { MinimalFlow, FlowStatus } from "../FlowBuilder/flow.types";
import { FileData } from "chonky";
import { BreakLongUnderscoreNames } from "../FlowBuilder/Blocks/block.view";
import { HorusLink } from "../reusable";
import { navigateTo } from "@/Utils/navigationService";

type RecentUserFlowProps = {
  flows: MinimalFlow[];
};

export default function RecentUserFlows(props: RecentUserFlowProps) {
  const { flows } = props;

  const getURL = (flow: MinimalFlow) => {
    const open = window.location.search.includes("open=true") ? "yes" : "true";
    return `/flow?open=${open}&flowID=${flow.savedID}&path=${flow.path}`;
  };

  const columnDefs = useMemo<ColDef<MinimalFlow>[]>(
    () => [
      {
        headerName: "Name",
        field: "name",
        flex: 2,
        cellRenderer: (params: { value: string }) => (
          <BreakLongUnderscoreNames name={params.value} />
        )
      },
      {
        headerName: "Status",
        field: "status",
        width: 120,
        cellRenderer: (params: { value: FlowStatus }) => (
          <FlowStatusView status={params.value} />
        ),
        filterValueGetter: (params) => params.data?.status ?? ""
      },
      {
        headerName: "Date",
        field: "date",
        width: 110,
        valueFormatter: (params) =>
          params.value
            ? new Date(params.value).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric"
              })
            : ""
      },
      {
        headerName: "Path",
        field: "path",
        flex: 1,
        valueFormatter: (params) => {
          if (!params.value) return "Unknown path";
          const parts = (params.value as string)
            .split("/")
            .filter((p: string) => p.length > 0);
          return parts.join(" ▸ ");
        }
      }
    ],
    []
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({ sortable: true, filter: true, resizable: true }),
    []
  );

  const onRowClicked = useCallback(
    (e: RowClickedEvent<MinimalFlow>) => {
      if (e.data) navigateTo(getURL(e.data));
    },
    []
  );

  if (!flows || flows.length === 0) {
    return (
      <div className="h-full flex justify-center items-center">
        No recent flows
      </div>
    );
  }

  return (
    <div className="ag-theme-quartz w-full">
      <AgGridReact
        rowData={flows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        domLayout="autoHeight"
        rowStyle={{ cursor: "pointer" }}
        suppressCellFocus
        onRowClicked={onRowClicked}
        getRowId={(params) => params.data.savedID ?? params.data.name}
        pagination
        paginationPageSize={10}
        paginationPageSizeSelector={[10, 25, 50, 100]}
      />
    </div>
  );
}

export function PredefinedFlows(props: RecentUserFlowProps) {
  const getURL = (flow: MinimalFlow) => {
    const open = window.location.search.includes("open=true") ? "yes" : "true";
    return `/flow?open=${open}&flowID=${flow.savedID}`;
  };

  return (
    <div className="flex flex-col gap-1">
      {props.flows?.map((flow) => (
        <HorusLink
          to={getURL(flow)}
          key={flow.savedID}
          className="predefined-flow"
        >
          <div className="predefined-flow-name max-w-[380px] cut-text">
            <BreakLongUnderscoreNames name={flow.name} />
          </div>
          <div className="predefined-flow-plugin">{flow.pluginName}</div>
        </HorusLink>
      ))}
    </div>
  );
}

export type CorruptedFlow = FileData & {
  reason: string;
};

export function useGetRecentFlows(webAppFlows: boolean = false): {
  isLoading: boolean;
  recentFlows: MinimalFlow[] | null;
  presetFlows: MinimalFlow[] | null;
  templates: MinimalFlow[] | null;
  otherDirectories: FileData[] | null;
  corruptedFlows: CorruptedFlow[] | null;
  refetch: () => void;
} {
  // Fetch recent flows
  const {
    data: recentFlowsData,
    isLoading: fetchingRecents,
    refetch
  } = useQuery({
    queryKey: ["recentFlows", webAppFlows],
    queryFn: async () => {
      const endpoint = webAppFlows ? "/users/flows" : "/api/recentflows";
      const response = await horusGet(endpoint);
      const data = await response.json();
      if (!data.ok) throw new Error(data.msg || "Failed to fetch recent flows");
      const flows = data.flows.sort(
        (a: MinimalFlow, b: MinimalFlow) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      return {
        flows,
        otherDirectories: data.otherDirectories || [],
        corruptedFlows: data.corruptedFlows || []
      };
    },
    refetchInterval: 10000
  });

  // Fetch predefined flows
  const { data: predefinedFlowsData } = useQuery({
    queryKey: ["predefinedFlows"],
    queryFn: async () => {
      const response = await horusGet("/api/plugins/flows");

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.msg || "Failed to fetch predefined flows");
      }
      return data.flows;
    }
  });

  // Fetch templates
  const { data: templatesData } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const response = await horusGet("/api/templates");
      const data = await response.json();
      if (!data.ok) throw new Error(data.msg || "Failed to fetch templates");
      return data.templates || [];
    }
  });

  return {
    isLoading: fetchingRecents,
    recentFlows: recentFlowsData?.flows ?? null,
    presetFlows: predefinedFlowsData ?? null,
    templates: templatesData ?? null,
    otherDirectories: recentFlowsData?.otherDirectories ?? null,
    corruptedFlows: recentFlowsData?.corruptedFlows ?? null,
    refetch
  };
}
