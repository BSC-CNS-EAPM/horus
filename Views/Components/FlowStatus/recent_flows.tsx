// React imports
import { useState, useCallback, useEffect, useRef } from "react";

// Horus web-server
import { horusGet } from "../../Utils/utils";

// Horus components
import { FlowStatusView } from "./flow_status";
import WorkingView from "../MainApp/working_view";
import { Flow } from "../FlowBuilder/flow.types";

type RecentUserFlowProps = {
  flows: Flow[];
};

export const openFlow = (flow: Flow) => {
  // Set the working view
  const startWorkingEvent = new CustomEvent("start-working", {
    detail: (
      <WorkingView
        flowToOpen={{
          savedID: flow.savedID!,
          path: flow.path!,
        }}
      />
    ),
  });

  window.dispatchEvent(startWorkingEvent);
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
      path.pop();
      return (
        <div className="flex flex-row gap-1 overflow-x-scroll justify-start">
          {path.map((p, index) => {
            return (
              <div
                key={index}
                className="flex flex-row gap-1 predefined-flow-plugin m-0"
              >
                {index > 0 && <div>▸</div>}
                <div>{p}</div>
              </div>
            );
          })}
        </div>
      );
    }

    return <div>Unknown path</div>;
  };

  return (
    <div className="flex flex-col gap-1">
      {flows?.length > 0 ? (
        flows.map((flow) => (
          <div
            key={flow.savedID ?? "Unknown flow ID"}
            onClick={() => {
              openFlow(flow);
            }}
            className="predefined-flow w-full h-full"
          >
            <div className="flex flex-row justify-between">
              <div className="predefined-flow-name">{flow.name}</div>
              <div className="text-base">
                <FlowStatusView status={flow.status} />
              </div>
            </div>
            <div className="predefined-flow-plugin">
              {<ParsedFlowPath flow={flow} />}
            </div>
          </div>
        ))
      ) : (
        <div className="predefined-flow-name">No recent flows</div>
      )}
    </div>
  );
}

export function PredefinedFlows(props: RecentUserFlowProps) {
  return (
    <div className="flex flex-col gap-1">
      {props.flows?.map((flow) => (
        <div
          key={flow.savedID}
          onClick={() => {
            openFlow(flow);
          }}
          className="predefined-flow"
        >
          <div className="predefined-flow-name">{flow.name}</div>
          <div className="predefined-flow-plugin">{flow.pluginName}</div>
        </div>
      ))}
    </div>
  );
}

export function useGetRecentFlows(
  webAppFlows: boolean = false
): [boolean, Flow[], Flow[], () => Promise<void>, (active: boolean) => void] {
  const [fetchingRecents, setFetchingRecents] = useState(true);
  const [recentFlows, setRecentFlows] = useState<Flow[]>([]);
  const [predefinedFlows, setPredefinedFlows] = useState<Flow[]>([]);
  const interval = useRef<Timer | null>(null);

  const internalGetRecentFlows = useCallback(async () => {
    let recentFlowsResponse;
    if (webAppFlows) {
      recentFlowsResponse = await horusGet("/users/flows");
    } else {
      recentFlowsResponse = await horusGet("/api/recentflows");
    }

    if (!recentFlowsResponse) {
      return;
    }

    const recentFlowsData = await recentFlowsResponse.json();

    if (!recentFlowsData.ok) {
      return;
    }

    const flows: Flow[] = recentFlowsData.flows;

    // Sort the flows by the flow.date field (yyyy-mm-dd hh:mm:ss)
    flows.sort((a: Flow, b: Flow) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);

      return dateB.getTime() - dateA.getTime();
    });

    setRecentFlows(flows);
  }, [webAppFlows]);

  const getFlows = useCallback(async () => {
    setFetchingRecents(true);

    const responsePredefined = await horusGet("/api/plugins/flows");

    if (!responsePredefined) {
      return;
    }

    const data = await responsePredefined.json();

    if (!responsePredefined.ok) {
      alert("Error getting flows: " + data.msg);
      return;
    }

    setPredefinedFlows(data.flows);

    // Fetch the recent flows
    internalGetRecentFlows();

    setFetchingRecents(false);
  }, [internalGetRecentFlows]);

  // Toggle the interval
  const toggleInterval = useCallback(
    (active: boolean) => {
      // Clear the interval if it was set
      if (interval.current) {
        clearInterval(interval.current);
      }
      // If active, set the interval
      if (active) {
        interval.current = setInterval(internalGetRecentFlows, 10000);
      }
    },
    [internalGetRecentFlows]
  );

  useEffect(() => {
    // Get the recent flows every 10 seconds
    toggleInterval(true);

    return () => {
      toggleInterval(false);
    };
  }, [toggleInterval]);

  // Get the flows
  useEffect(() => {
    getFlows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [
    fetchingRecents,
    recentFlows,
    predefinedFlows,
    getFlows,
    toggleInterval,
  ];
}
