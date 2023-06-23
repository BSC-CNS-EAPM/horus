import { useState, useEffect, useRef } from "react";
import { RotatingLines } from "react-loader-spinner";
import { HorusModal, HorusPopover } from "../reusable";
import { BlockProps } from "./flow_builder_interfaces";
import { PluginVariableType } from "./flow_builder_interfaces";
import { PluginVariableView } from "./block_variables";
import "./block.css";

// Drag the blocks, drop the arrows
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ArrowBlockConnector } from "./arrow_connector";
import { useXarrow } from "react-xarrows";

interface DeleteBlockButtonProps {
  block: BlockProps;
  onClick: (block: BlockProps) => void;
}

interface PlayBlockButtonProps {
  isRunning: boolean;
  runError: boolean;
  onClick: () => Promise<void>;
}

function BlockVariablesButton({ onClick }) {
  return (
    <HorusPopover
      trigger={
        <button onClick={onClick}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      }
    >
      <div className="plugin-description">Configure block</div>
    </HorusPopover>
  );
}

function DeleteBlockButton({ block, onClick }: DeleteBlockButtonProps) {
  const deleteBlock = () => {
    onClick(block);
  };

  return (
    <HorusPopover
      trigger={
        <button onClick={deleteBlock}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="red"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      }
    >
      <div className="plugin-description">Delete block</div>
    </HorusPopover>
  );
}

function PlayBlockButton({
  isRunning,
  runError,
  onClick,
}: PlayBlockButtonProps) {
  return (
    <HorusPopover
      trigger={
        isRunning ? (
          <RotatingLines
            strokeColor="grey"
            strokeWidth="5"
            animationDuration="0.75"
            width="20"
          />
        ) : (
          <button onClick={onClick}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill={runError ? "red" : "current"}
              className="w-5 h-5"
            >
              <path
                fillRule="evenodd"
                d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm6.39-2.908a.75.75 0 01.766.027l3.5 2.25a.75.75 0 010 1.262l-3.5 2.25A.75.75 0 018 12.25v-4.5a.75.75 0 01.39-.658z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )
      }
    >
      <div className="plugin-description">Execute block</div>
    </HorusPopover>
  );
}

function Block(block: BlockProps) {
  // Track hovering on info button to display the description instead of the plugin
  const [isInfoHovering, setIsInfoHovering] = useState(false);

  const handleChange = (value: PluginVariableType, id: string) => {
    var hasChanged = false;
    // Update the variable value by searching the PluginVariable by id
    const updatedVariables = block.variables.map((variable) => {
      if (variable.id === id) {
        if (variable.placedID === block.placedID) {
          if (variable.value !== value) {
            hasChanged = true;
            variable.value = value;
          }
        }
      }
      return variable;
    });

    // Update the block variables
    block.variables = updatedVariables;

    // Call the onChange function
    if (hasChanged) {
      block?.onChange();
    }
  };

  const handleExecute = async () => {
    // Call the execute function
    await block?.execute(block);
  };

  const [variablesModal, setVariablesModal] = useState(false);

  const openVariablesModal = () => {
    // Open the variables modal
    setVariablesModal(true);
  };

  const closeVariablesModal = () => {
    // Close the variables modal
    setVariablesModal(false);
  };

  const variablesModalView = (
    <HorusModal
      show={variablesModal}
      onHide={closeVariablesModal}
      header={<div className="text-xl font-bold">Variables</div>}
      body={
        <div>
          {block.variables.map((variable, index) => (
            <PluginVariableView
              key={
                variable.id +
                "-" +
                index +
                "-" +
                block.id +
                "-" +
                block.placedID
              }
              variable={variable}
              onChange={handleChange}
            />
          ))}
        </div>
      }
      footer={
        <div className="flex flex-row justify-end">
          <button className="app-button" onClick={closeVariablesModal}>
            Close
          </button>
        </div>
      }
    />
  );

  return (
    <div
      id={`${block?.placedID}-${block.id}`}
      className={`${
        block.isSubBlock && !block.isPlaced && !block.isOnAir ? "subblock" : ""
      } plugin-block ${block.isPlaced ? "" : "plugin-block-placed"}`}
    >
      {variablesModalView}
      <div className="flex flew-row justify-between">
        <div style={{ fontWeight: "bold" }}>{block.name}</div>
        <div className="flex flex-row gap-1">
          {/* Play button to execute the block */}
          {/* Delete button to remove the block from the canvas */}
          {block.isPlaced && (
            <>
              <PlayBlockButton
                isRunning={block.isRunning}
                runError={block.runError}
                onClick={handleExecute}
              />
              <BlockVariablesButton onClick={openVariablesModal} />
              <DeleteBlockButton
                block={block}
                onClick={() => block.deleteBlock(block)}
              />
            </>
          )}

          {!block.isPlaced && (
            <div
              onMouseOver={() => setIsInfoHovering(true)}
              onMouseLeave={() => setIsInfoHovering(false)}
              className="cursor-help"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          )}
        </div>
        {/* <button className="nbd-btn" onClick={handleBlockConnection}>
          Connect block
        </button> */}
      </div>
      {block.isPlaced && (
        <div>
          {block.variables.map((variable, index) => (
            <PluginVariableView
              key={variable.id}
              variable={variable}
              onChange={handleChange}
            />
          ))}
        </div>
      )}
      <div
        className={
          "text-gray-500 transition-opacity duration-300 " +
          (isInfoHovering || block.isPlaced ? "opacity-100" : "opacity-0")
        }
      >
        {isInfoHovering || block.isPlaced ? block.description : null}
      </div>
    </div>
  );
}

function DraggableBlock(block: BlockProps) {
  const updateXarrow = useXarrow();

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: block.placedID ? `${block.placedID}-${block.id}` : block.id,
    data: {
      block: block,
      updateXarrow: updateXarrow,
    },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: block.placedID ? `${block.placedID}-${block.id}` : block.id,
    data: {
      block: block,
    },
  });

  var style = {
    transform: null,
    top: 0,
    left: 0,
    cursor: "grab",
    zIndex: 10,
  };

  if (block.isPlaced) {
    style.transform = `translate(${block?.coords?.x}px, ${block?.coords?.y}px)`;
  }

  if (transform && block.isPlaced) {
    const deltx = transform.x + block.coords.x;
    const delty = transform.y + block.coords.y;
    style.transform = `translate(${deltx}px, ${delty}px)`;
  }

  if (transform) {
    style.cursor = "grabbing";
  }

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDropRef(ref.current);
    setNodeRef(ref.current);
  }, [ref]);

  return (
    <div
      ref={ref}
      style={style}
      {...listeners}
      {...attributes}
      className={block.isPlaced ? "absolute" : "relative"}
    >
      <Block {...block} />
      {block.isPlaced && <ArrowBlockConnector from={ref} block={block} />}
    </div>
  );
}

export { Block, DraggableBlock };
