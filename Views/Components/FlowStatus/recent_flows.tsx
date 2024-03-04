// React imports
import { useState, useCallback } from "react";

// Horus web-server
import { horusGet } from "../../Utils/utils";

// Horus components
import { FlowStatusView } from "./flow_status";
import WorkingView from "../MainApp/working_view";
import { Flow } from "../FlowBuilder/flow.types";

type RecentUserFlowProps = {
  flows: Flow[];
};

const openFlow = (flow: Flow) => {
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
        <div className="flex flex-row gap-1">
          {path.map((p, index) => {
            return (
              <div key={index} className="predefined-flow-plugin">
                {index > 0 && <>▸ </>}
                {p}
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
              <FlowStatusView status={flow.status} />
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

export function useGetRecentFlows(): [
  boolean,
  Flow[],
  Flow[],
  () => Promise<void>
] {
  const [fetchingRecents, setFetchingRecents] = useState(true);
  const [recentFlows, setRecentFlows] = useState<Flow[]>([]);
  const [predefinedFlows, setPredefinedFlows] = useState<Flow[]>([]);

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

    const recentFlowsResponse = await horusGet("/api/recentflows");

    if (!recentFlowsResponse) {
      alert("Error getting recent flows");
      return;
    }

    const recentFlowsData = await recentFlowsResponse.json();

    if (!recentFlowsData.ok) {
      alert("Error getting recent flows: " + recentFlowsData.msg);
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
    setFetchingRecents(false);
  }, []);

  return [fetchingRecents, recentFlows, predefinedFlows, getFlows];
}
