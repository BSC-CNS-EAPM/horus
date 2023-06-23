import { Block, DraggableBlock } from "./block";
import { BlockProps, FlowReciverProps } from "./flow_builder_interfaces";
import { useEffect, useRef, useState } from "react";
import { horusGet, horusPost } from "../../Utils/utils";
import { RotatingLines } from "react-loader-spinner";
import { useDroppable, DndContext } from "@dnd-kit/core";
import Xarrow, { Xwrapper } from "react-xarrows";
import { HorusModal } from "../reusable";

function FlowReciver(props: FlowReciverProps) {
  // Modal state
  const [flowName, setFlowName] = useState("New flow");

  // Saved flow vars
  const savedID = useRef(props.savedID ? props.savedID : "new_flow");
  const flowPath = useRef(props.flowPath);
  const { currentSaved, setSaved } = props;

  // Executing state
  const [executingAll, setExecutingAll] = useState(false);

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

  const stopExecute = useRef(false);

  const executeBlock = async (block: BlockProps) => {
    if (stopExecute.current) {
      return;
    }

    setExecutingAll(true);

    // Check that the flow is saved
    if (!currentSaved.current) {
      // Save the flow
      await handleSave();
    }

    // Set the running spinner for the current block
    toggleSpinner();

    // Find the actual block in the placedBlocks array
    const realBlock = props.placedBlocks.find(
      (b) => b.placedID === block.placedID
    );

    const result = await executeInternal(realBlock);

    // Set the running button to false
    toggleSpinner(false);

    // Check any error status code
    !result.ok ? toggleError() : toggleError(false);

    // Execute the connected blocks
    if (realBlock.connectedTo && realBlock.connectedTo.length > 0) {
      for (const connected of realBlock.connectedTo) {
        await executeBlock(connected);
      }
    }

    setExecutingAll(false);

    stopExecute.current = false;

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

  const stopExecutingAll = async () => {
    if (!executingAll) {
      return;
    }

    if (!confirm("Are you sure you want to stop executing the flow?")) {
      return;
    }

    stopExecute.current = true;
  };

  const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFlowName(e.target.value);
    setSaved(false);
  };

  const handleDelete = (block: BlockProps) => {
    // Loop over the block "appearsOn" and delete the block from the connectedTo list
    if (block.appearsOn) {
      for (const aB of block.appearsOn) {
        props.setPlacedBlocks(
          props.placedBlocks.map((b) => {
            if (b.placedID === aB.placedID) {
              b.connectedTo = b.connectedTo.filter(
                (c) => c.placedID !== block.placedID
              );
            }
            return b;
          })
        );
      }
    }

    // Delete a block from the current flow
    props.setPlacedBlocks(
      props.placedBlocks.filter((b) => b.placedID !== block.placedID)
    );

    setSaved(false);
  };

  const onblockChange = () => {
    setSaved(false);
  };

  const openingFlow = useRef(false);

  const loadFlow = async () => {
    if (openingFlow.current) {
      return;
    }

    openingFlow.current = true;

    if (!currentSaved.current) {
      if (
        !confirm(
          "Current flow is not saved. Are you sure you want to open a new one?"
        )
      ) {
        openingFlow.current = false;
        return;
      }
    }

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

    // Set the placedIDCounter
    // Search for the highest placedID in the blocks and subblocks
    const placedIDs = openedFlow.blocks.map((b) => b.placedID);
    for (const block of openedFlow.blocks) {
      if (block.placedSubBlocks?.length > 0) {
        for (const subBlock of block.placedSubBlocks) {
          placedIDs.push(subBlock.placedID);
        }
      }
    }
    props.placedIDCounter.current = Math.max(...placedIDs) + 1;

    // Set the saved state
    setSaved(true);

    openingFlow.current = false;
  };

  const handlingNew = useRef(false);

  const handleNew = () => {
    if (handlingNew.current) {
      return;
    }

    handlingNew.current = true;

    if (!currentSaved.current) {
      if (
        !confirm(
          "Current flow is not saved. Are you sure you want to create a new flow?"
        )
      ) {
        handlingNew.current = false;
        return;
      }
    }
    setFlowName("New Flow");
    savedID.current = "new_flow";
    flowPath.current = "";
    props.setPlacedBlocks([]);
    props.placedIDCounter.current = 0;
    setSaved(true);
    handlingNew.current = false;
  };

  useEffect(() => {
    // Add an event listener to clear all the state when the "New" button is clicked in the toolbar
    window.addEventListener("newFlow", handleNew);

    // Add an event listener to load a flow when the "Open" button is clicked in the toolbar
    window.addEventListener("openFlow", loadFlow);

    // Clean the event listener when the component is unmounted
    return () => {
      window.removeEventListener("newFlow", handleNew);
      window.removeEventListener("openFlow", loadFlow);
    };
  }, []);

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
        {currentSaved.current ? (
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
      <button
        onClick={stopExecutingAll}
        className="flow-button"
        style={{
          cursor: executingAll ? "pointer" : "default",
        }}
      >
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

  const renderBlock = (block: BlockProps, index: number) => {
    const connectedToBlocks = block.connectedTo?.map((connectedBlock) => (
      <Xarrow
        start={`${block?.placedID}-${block.id}`}
        end={`${connectedBlock?.placedID}-${connectedBlock.id}`}
        key={`${block?.placedID}-${block.id}-${connectedBlock?.placedID}-${connectedBlock.id}`}
        startAnchor={["right"]}
        endAnchor={["left", "top", "bottom"]}
      />
    ));

    return (
      <>
        <DraggableBlock
          key={`${block.placedID}-${block.id}`}
          {...block}
          onChange={onblockChange}
          execute={executeBlock}
          index={index}
          deleteBlock={handleDelete}
        />
        {connectedToBlocks}
      </>
    );
  };

  const placedBlocksView = props.placedBlocks.map(renderBlock);

  return (
    <div className="current-flow">
      {topBarTitle}
      <div className="current-flow-canvas" ref={setNodeRef}>
        <Xwrapper>{placedBlocksView}</Xwrapper>
      </div>
    </div>
  );
}

export { FlowReciver };

{
  /* {block.connectedTo?.map((connectedBlock) => (
        <Xarrow
          start={`${block?.placedID}-${block.id}`}
          end={`${connectedBlock?.placedID}-${connectedBlock.id}`}
          key={`${block?.placedID}-${block.id}-${connectedBlock?.placedID}-${connectedBlock.id}`}
        />
      ))} */
}
