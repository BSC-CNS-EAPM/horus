import { Block, DraggableBlock } from "./block";
import { BlockProps, FlowReciverProps } from "./flow_builder_interfaces";
import { useEffect, useRef, useState } from "react";
import { horusGet, horusPost } from "../../Utils/utils";
import RotatingLines from "../RotatingLines/rotatinglines";
import { useDroppable, DndContext } from "@dnd-kit/core";
import Xarrow, { Xwrapper } from "react-xarrows";
import { connectArrowBlock } from "./flow_builder";

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

    // Stop the execution if there was an error
    if (!result.ok) {
      stopExecute.current = true;
    }

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

  const handleNew = (bypass: boolean = false) => {
    if (handlingNew.current) {
      return;
    }

    handlingNew.current = true;

    if (!currentSaved.current && !bypass) {
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
    props.placedIDCounter.current = 1;
    setSaved(true);
    resetHistory();
    handlingNew.current = false;
  };

  const handleTerminalCommand = (e: CustomEvent) => {
    const command = e.detail.command;
    const args = e.detail.args;

    if (command === "newflow") {
      if (args[0] === "-y") {
        handleNew(true);
      } else {
        handleNew();
      }
      return "Flow cleared";
    }

    if (command === "openflow") {
      loadFlow();
      return "Flow loaded";
    }

    if (command === "saveflow") {
      handleSave();
      return "Flow saved";
    }

    if (command === "del") {
      console.log(args);
      if (args[0] !== undefined) {
        // Get the block by the placedID
        const block = props.placedBlocks.find(
          (b) => b.placedID === parseInt(args[0])
        );

        console.log(props.placedBlocks);

        console.log(block);

        if (!block) {
          console.log("Block not found");
          return "Block not found";
        }
        handleDelete(block);
      }
      return "Block deleted";
    }

    if (command === "conn") {
      if (args[0] !== undefined && args[1] !== undefined) {
        // Find the block by the placedID
        const block1 = props.placedBlocks.find(
          (b) => b.placedID === parseInt(args[0])
        );

        if (!block1) {
          return "Block not found";
        }

        // Find the block by the placedID
        const block2 = props.placedBlocks.find(
          (b) => b.placedID === parseInt(args[1])
        );

        if (!block2) {
          return "Block not found";
        }

        connectArrowBlock(props.setPlacedBlocks, block1, block2);
      }
    }

    if (command === "run") {
      if (args[0] !== undefined) {
        // Get the block by the placedID
        const block = props.placedBlocks.find(
          (b) => b.placedID === parseInt(args[0])
        );
        if (!block) {
          return "Block not found";
        }
        executeBlock(block);
      }
      return "Flow executed";
    }

    return "Command executed";
  };

  useEffect(() => {
    // Add an event listener to clear all the state when the "New" button is clicked in the toolbar
    window.addEventListener("newFlow", (e) => {
      handleNew();
    });

    // Add an event listener to load a flow when the "Open" button is clicked in the toolbar
    window.addEventListener("openFlow", loadFlow);

    // Add an event listener to save a flow when the "Save" button is clicked in the toolbar
    window.addEventListener("saveFlow", handleSave);

    // Add an event listener for the terminal commands
    window.addEventListener("terminalCommand", handleTerminalCommand);

    // Add an event listener for the center view button
    window.addEventListener("centerView", centerView);

    // Clean the event listener when the component is unmounted
    return () => {
      window.removeEventListener("newFlow", (e) => {
        handleNew();
      });
      window.removeEventListener("openFlow", loadFlow);
      window.removeEventListener("saveFlow", handleSave);
      window.removeEventListener("terminalCommand", handleTerminalCommand);
      window.removeEventListener("centerView", centerView);
    };
  }, [props.placedBlocks]);

  const topBarTitle = (
    <h1 className="flex flex-row top-bar-flow-reciver">
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

  const [isPanning, setIsPanning] = useState(false);

  const [past, setPast] = useState<BlockProps[][]>([]);
  const [future, setFuture] = useState<BlockProps[][]>([]);
  const [present, setPresent] = useState<BlockProps[]>();

  const resetHistory = () => {
    setPast([]);
    setFuture([]);
    setPresent(props.placedBlocks);
  };

  const handleUndo = () => {
    if (past.length < 1) {
      return;
    }

    const undoTo = past[past.length - 1];

    if (undoTo === undefined) {
      return;
    }

    const newPast = past.slice(0, past.length - 1);

    setFuture([present, ...future]);
    props.setPlacedBlocks(undoTo);
    setPresent(undoTo);
    setPast(newPast);
    setSaved(false);
  };

  const handleRedo = () => {
    if (future.length < 1) {
      return;
    }

    const redoTo = future[0];

    if (redoTo === undefined) {
      return;
    }

    const newFuture = future.slice(1);

    setPast([...past, present]);
    props.setPlacedBlocks(redoTo);
    setPresent(redoTo);
    setFuture(newFuture);
    setSaved(false);
  };

  const updateHistory = (newPlacedBlocks: BlockProps[]) => {
    setPast((prevPast) => [...prevPast, present]);
    setPresent(newPlacedBlocks);
    setFuture([]);
  };

  useEffect(() => {
    function compareBlockLists(a: BlockProps[], b: BlockProps[]) {
      if (isPanning === true) {
        return true;
      }
      if (JSON.stringify(a) === JSON.stringify(b)) {
        return true;
      }
      return false;
    }

    // If the placed blocks change, we update the history
    if (!compareBlockLists(props.placedBlocks, present)) {
      updateHistory(props.placedBlocks);
    }

    window.addEventListener("undo", handleUndo);
    window.addEventListener("redo", handleRedo);
    return () => {
      window.removeEventListener("undo", handleUndo);
      window.removeEventListener("redo", handleRedo);
    };
  }, [props.placedBlocks, past, future, present]);

  const initialMousePosition = useRef({ x: 0, y: 0 });

  const style = {
    cursor: isPanning ? "grabbing" : "default",
  };

  return (
    <div className="current-flow cursor-grabbing">
      {topBarTitle}
      <div
        className="current-flow-canvas"
        ref={setNodeRef}
        id="current-flow-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMousePan}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={style}
      >
        <Xwrapper>{placedBlocksView}</Xwrapper>
      </div>
    </div>
  );

  function handleMouseDown(e) {
    // Check that the user is clicking over the canvas and not anything else
    if (e.target.id === "current-flow-canvas") {
      setIsPanning(true);
      document.onselectstart = function () {
        return false;
      };
      initialMousePosition.current = {
        x: e.clientX,
        y: e.clientY,
      };
    }
  }

  function handleMousePan(e) {
    // Move all blocks by delta
    if (isPanning) {
      // Get mouse delta
      const deltaX = e.clientX - initialMousePosition.current.x;
      const deltaY = e.clientY - initialMousePosition.current.y;

      initialMousePosition.current = {
        x: e.clientX,
        y: e.clientY,
      };
      moveBlocksPan(deltaX, deltaY);
    }
  }

  function centerView() {
    // Set the first block to be at the center of the canvas
    // Then move all blocks by delta respective to the first block
    const firstBlockPos = props.placedBlocks[0]?.coords;

    if (!firstBlockPos) {
      return;
    }

    // Get the center of the canvas
    const canvas = document.getElementById("current-flow-canvas");
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;

    const canvasCenter = {
      x: canvasWidth / 3,
      y: canvasHeight / 3,
    };

    const delta = {
      x: -firstBlockPos.x + canvasCenter.x,
      y: -firstBlockPos.y + canvasCenter.y,
    };

    moveBlocksPan(delta.x, delta.y);
  }

  function moveBlocksPan(deltaX: number, deltaY: number) {
    props.setPlacedBlocks((blocks) =>
      blocks.map((block) => {
        return {
          ...block,
          coords: {
            x: block.coords.x + deltaX,
            y: block.coords.y + deltaY,
          },
        };
      })
    );
  }

  function handleMouseUp(e) {
    setIsPanning(false);
    document.onselectstart = function () {
      return true;
    };
  }
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
