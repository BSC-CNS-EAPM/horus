import { Block } from "./block";
import { BlockProps, FlowReciverProps } from "./flow_builder_interfaces";
import { useEffect, useRef, useState } from "react";
import { horusGet, horusPost } from "../../Utils/utils";
import { RotatingLines } from "react-loader-spinner";

// Import the dndkit
import { DndContext, useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

function FlowReciver(props: FlowReciverProps) {
  // Modal state
  const [flowName, setFlowName] = useState("New flow");

  // Saved flow vars
  const savedID = useRef(props.savedID ? props.savedID : "new_flow");
  const flowPath = useRef(props.flowPath);

  // Executing state
  const [executingAll, setExecutingAll] = useState(false);

  // Saved state
  const [saved, setSaved] = useState(false);

  const { setNodeRef } = useDroppable({
    id: "flow-reciver",
  });

  const handleSave = async () => {
    const body = JSON.stringify({
      name: flowName,
      blocks: props.placedBlocks,
      savedID: savedID.current,
      path: flowPath.current,
    });

    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const response = await horusPost("/saveflow", headers, body);
    var savedFlow = await response.json();

    if (!savedFlow.ok) {
      alert(savedFlow.error);
      return;
    }

    const overwrite = savedFlow.overwrite;
    const existingName = savedFlow.existingName;
    const path = overwrite ? savedFlow.path : flowPath.current;

    if (
      overwrite &&
      !confirm(
        "Flow with the same name already exists. Are you sure you want to overwrite the flow?"
      )
    ) {
      return;
    }

    if (overwrite) {
      const overwriteBody = JSON.stringify({
        name: overwrite ? existingName : savedFlow.name,
        blocks: props.placedBlocks,
        savedID: savedID.current,
        path: path,
        overwrite: true,
      });

      const overwriteResponse = await horusPost(
        "/saveflow",
        headers,
        overwriteBody
      );
      savedFlow = await overwriteResponse.json();

      if (!savedFlow.ok) {
        alert(savedFlow.error);
        return;
      }
    }

    setSaved(true);
    setFlowName(savedFlow.name);
    savedID.current = savedFlow.savedID;
    flowPath.current = savedFlow.path;
  };

  const executeInternal = async (block) => {
    // Get the updated block variables
    const variables = block.variables.reduce((acc, variable) => {
      // Return a dictionary with the variable name and value {name: value}
      acc[variable.id] = variable.value;
      return acc;
    }, {});

    const body = JSON.stringify({
      blockID: block.id,
      variables: variables,
      path: flowPath.current,
    });

    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const response = await horusPost("/plugins/executeblock", headers, body);

    const data = await response.json();

    return data;
  };

  const executeBlock = async (block) => {
    // Check that the flow is saved
    if (!saved) {
      // Save the flow
      await handleSave();
    }

    // Set the running spinner for the current block
    toggleSpinner();

    const result = await executeInternal(block);

    // Check any error status code
    !result.ok ? toggleError() : toggleError(false);

    // Execute the subblocks
    if (block.placedSubBlocks?.length > 0) {
      for (const subBlock of block.placedSubBlocks) {
        const subresult = await executeInternal(subBlock);
        // Check any error status code
        if (!subresult.ok) {
          toggleError();
          break;
        } else {
          toggleError(false);
        }
      }
    }

    // Set the running button to false
    toggleSpinner(false);

    function toggleSpinner(status = true) {
      props.setPlacedBlocks(
        props.placedBlocks.map((b) => {
          if (b.placedID === block.placedID) {
            b.isRunning = status;
          }
          return b;
        })
      );
    }

    function toggleError(status = true) {
      props.setPlacedBlocks(
        props.placedBlocks.map((b) => {
          if (b.placedID === block.placedID) {
            b.runError = status;
          }
          return b;
        })
      );
    }
  };

  const handleExecuteAll = async () => {
    // Set the executing state to true
    setExecutingAll(true);

    //Loop over the blocks and execute them
    for (const block of props.placedBlocks) {
      await executeBlock(block);
    }

    // Set the executing state to false
    setExecutingAll(false);
  };

  const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFlowName(e.target.value);
    setSaved(false);
  };

  const handleDelete = (block: BlockProps) => {
    // Delete a block from the current flow
    props.setPlacedBlocks(
      props.placedBlocks.filter((b) => b.placedID !== block.placedID)
    );

    // If the block has a parent, delete the block from the parent
    if (block.parent !== undefined) {
      props.setPlacedBlocks(
        props.placedBlocks.map((b) => {
          if (b.placedID === block.parent.placedID) {
            b.placedSubBlocks = b.placedSubBlocks.filter(
              (s) => s.placedID !== block.placedID
            );
          }
          return b;
        })
      );
    }

    setSaved(false);
  };

  const onblockChange = () => setSaved(false);

  const loadFlow = async () => {
    const response = await horusGet("/openflow");
    const data = await response.json();

    if (!data.ok) {
      alert(data.error);
      return;
    }

    const openedFlow = data.flow;

    if (!openedFlow) {
      return;
    }

    // Set the flow name
    setFlowName(openedFlow.name);
    savedID.current = openedFlow.savedID;
    flowPath.current = openedFlow.path;

    // Set the placed blocks
    props.setPlacedBlocks(openedFlow.blocks);

    // Set the saved state
    setSaved(true);
  };

  useEffect(() => {
    // Load a flow if the openFlow prop is set
    if (props.openFlow === true) {
      loadFlow();
    }
  }, [props.openFlow]);

  const topBarTitle = (
    <h1 className="flex flex-row">
      <input
        className="flow-name"
        type="text"
        id="flow-name"
        placeholder={props.flowName}
        onChange={onNameChange}
        value={flowName}
      />
      <button onClick={handleSave} className="flow-button">
        {saved ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="var(--light-orange)"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
            />
          </svg>
        )}
      </button>
      <button onClick={handleExecuteAll} className="flow-button">
        {executingAll ? (
          <RotatingLines
            strokeColor="grey"
            strokeWidth="5"
            animationDuration="0.75"
            width="40"
          />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z"
            />
          </svg>
        )}
      </button>
    </h1>
  );

  const sortableFlow = () => {
    return (
      <div className="flex flex-col align-items-center mt-4">
        <SortableContext
          items={props.placedBlocks || []}
          strategy={verticalListSortingStrategy}
        >
          {props.placedBlocks.map((block, index) => (
            <Block
              key={`${block.placedID}-${block.id}`}
              {...block}
              onChange={onblockChange}
              execute={executeBlock}
              index={index}
              deleteBlock={handleDelete}
            />
          ))}
        </SortableContext>
        <div className="plugin-block block-placeholder">
          Drag and drop a blocks here
        </div>
      </div>
    );
  };

  return (
    <div ref={setNodeRef} className="current-flow">
      {topBarTitle}
      {sortableFlow()}
    </div>
  );
}

export { FlowReciver };
