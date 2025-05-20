// React imports
import { useQuery } from "@tanstack/react-query";

// Horus web-server
import { horusGet } from "../../Utils/utils";

// Horus components
import { FlowStatusView } from "./flow_status";
import { Flow } from "../FlowBuilder/flow.types";
import { FileData } from "chonky";
import { BreakLongUnderscoreNames } from "../FlowBuilder/Blocks/block.view";
import { HorusLink } from "../reusable";

type RecentUserFlowProps = {
  flows: Flow[];
};

export default function RecentUserFlows(props: RecentUserFlowProps) {
  const { flows } = props;

  const ParsedFlowPath = ({ flow }: { flow: Flow }) => {
    if (flow.path) {
      const path = flow.path.split("/");
      // Remove from the path the first and last elements
      // As the flow is the full path /path/to/flow
      // After the split we have ["", "path", "to", "flow", "file.flow"]
      // For the first element we dont want to show it empty
      // For the last element we dont want to show the file name
      path.shift();
      return (
        <div className="flex flex-row gap-1 overflow-x-auto justify-start">
          {path.map((p, index) => {
            return (
              <div
                key={index}
                className="flex flex-row gap-1 predefined-flow-plugin m-0"
              >
                {index > 0 && <div>▸</div>}
                <span className="whitespace-nowrap">{p}</span>
              </div>
            );
          })}
        </div>
      );
    }

    return <div>Unknown path</div>;
  };

  const getURL = (flow: Flow) => {
    const open = window.location.search.includes("open=true") ? "yes" : "true";
    return `/flow?open=${open}&flowID=${flow.savedID}&path=${flow.path}`;
  };

  return (
    <div className="flex flex-col gap-1">
      {flows?.length > 0 ? (
        flows.map((flow) => (
          <HorusLink
            role="button"
            to={getURL(flow)}
            key={flow.savedID ?? "Unknown flow ID"}
            className="predefined-flow w-full h-full max-w-[380px]"
          >
            <div className="flex flex-row justify-between">
              <div className="predefined-flow-name max-w-[260px] cut-text">
                <BreakLongUnderscoreNames name={flow.name} />
              </div>
              <div className="text-base">
                <FlowStatusView status={flow.status} />
              </div>
            </div>
            <div className="predefined-flow-plugin break-keep	">
              {<ParsedFlowPath flow={flow} />}
            </div>
          </HorusLink>
        ))
      ) : (
        <div className="predefined-flow-name">No recent flows</div>
      )}
    </div>
  );
}

export function PredefinedFlows(props: RecentUserFlowProps) {
  const getURL = (flow: Flow) => {
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
  recentFlows: Flow[] | null;
  presetFlows: Flow[] | null;
  templates: Flow[] | null;
  otherDirectories: FileData[] | null;
  corruptedFlows: CorruptedFlow[] | null;
  refetch: () => void;
} {
  // Fetch recent flows
  const {
    data: recentFlowsData,
    isLoading: fetchingRecents,
    refetch,
  } = useQuery({
    queryKey: ["recentFlows", webAppFlows],
    queryFn: async () => {
      const endpoint = webAppFlows ? "/users/flows" : "/api/recentflows";
      const response = await horusGet(endpoint);
      const data = await response.json();
      if (!data.ok) throw new Error(data.msg || "Failed to fetch recent flows");
      const flows = data.flows.sort(
        (a: Flow, b: Flow) =>
          new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      return {
        flows,
        otherDirectories: data.otherDirectories || [],
        corruptedFlows: data.corruptedFlows || [],
      };
    },
    refetchInterval: 10000,
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
    },
  });

  // Fetch templates
  const { data: templatesData } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const response = await horusGet("/api/templates");
      const data = await response.json();
      if (!data.ok) throw new Error(data.msg || "Failed to fetch templates");
      return data.templates || [];
    },
  });

  return {
    isLoading: fetchingRecents,
    recentFlows: recentFlowsData?.flows ?? null,
    presetFlows: predefinedFlowsData ?? null,
    templates: templatesData ?? null,
    otherDirectories: recentFlowsData?.otherDirectories ?? null,
    corruptedFlows: recentFlowsData?.corruptedFlows ?? null,
    refetch,
  };
}
