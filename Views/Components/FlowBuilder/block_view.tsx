import { useState, useEffect, useRef } from "react";
import RotatingLines from "../RotatingLines/rotatinglines";
import { HorusModal, HorusPopover } from "../reusable";
import { Block, PluginVariableTypes } from "./flow_builder_types";
import {
  PluginVariableView,
  InputOutputView,
  VariableBallView,
  OutputConnectView,
} from "./block_variables";
import "./block.css";

// Drag the blocks, drop the arrows
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ArrowBlockConnector } from "./arrow_connector";
import { useXarrow } from "react-xarrows";
import { SearchComponent } from "../Toolbar/toolbar";

interface DeleteBlockButtonProps {
  block: Block;
  onClick: (block: Block) => void;
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
      <div className="hover-description">Configure block</div>
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
      <div className="hover-description">Delete block</div>
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
            style={{
              height: "1.25rem",
            }}
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
      <div className="hover-description">Execute block</div>
    </HorusPopover>
  );
}

function InputRunningSpinner(props: { isRunning: boolean }) {
  if (props.isRunning) {
    return (
      <RotatingLines
        style={{
          height: "1.25rem",
        }}
      />
    );
  }
}

type VariableModalViewProps = {
  block: Block;
  handleChange: (value: any, id: string) => void;
};

function VariableModalView(props: VariableModalViewProps) {
  const { block, handleChange } = props;

  const variables = block.variables;

  const [filteredVariables, setFilteredVariables] = useState(variables);

  const filterVariables = (event: any) => {
    const value = event.target.value;
    const filteredVariables = variables.filter((variable) => {
      return (
        variable.name.toLowerCase().includes(value.toLowerCase()) ||
        variable.description.toLowerCase().includes(value.toLowerCase())
      );
    });

    setFilteredVariables(filteredVariables);
  };

  return (
    <div>
      {block.variables && block.variables.length > 0 && (
        <div>
          <div className="flex flex-row justify-between">
            <h4>Variables</h4>
            <SearchComponent
              placeholder="Search variables"
              onChange={filterVariables}
            />
          </div>
          <div>
            {filteredVariables.map((variable, index) => (
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
        </div>
      )}
      {block.inputs && (
        <div>
          <h4>Inputs</h4>
          <div>
            {block.inputs.map((variableGroup) =>
              variableGroup.variables.map((variable, index) => (
                <InputOutputView
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
                />
              ))
            )}
          </div>
        </div>
      )}
      {block.outputs && block.outputs.length > 0 && (
        <div>
          <h4>Outputs</h4>
          <div>
            {block.outputs.map((variable, index) => (
              <InputOutputView
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
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BlockView(block: Block) {
  // Track hovering on info button to display the description instead of the plugin
  const [isInfoHovering, setIsInfoHovering] = useState(false);

  const handleChange = (value: any, id: string) => {
    var hasChanged = false;
    // Update the variable value by searching the PluginVariable by id
    block.variables.map((variable) => {
      // THIS NEEDS TO BE REFACTORED BECAUSE IDK HOW IS THE STATE BEING UPDATED
      if (variable.id === id) {
        if (variable.value !== value) {
          hasChanged = true;
          variable.value = value;
        }
      }
      return variable;
    });

    // Update the block variables
    // block.variables = updatedVariables;

    // Call the onChange function
    if (hasChanged) {
      block?.onChange(block.placedID);
    }
  };

  const handleExecute = async () => {
    // Call the execute function
    await block?.execute(block);
  };

  const checkRemoteStatus = async (block: Block) => {
    await block?.checkRemoteStatus(block);
  };

  // If the block is a remote block and is running, fetch every 10 seconds the status
  // When the block stops running, stop fetching and proceed to execute the second
  // part of the remote block
  useEffect(() => {
    if (block.type === "slurm" && block.isRunning) {
      const interval = setInterval(() => {
        checkRemoteStatus(block);
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [block.isRunning]);

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
      header={
        <div className="text-xl font-bold">{block.name} - properties</div>
      }
      body={<VariableModalView block={block} handleChange={handleChange} />}
      footer={
        <div className="flex flex-row justify-end">
          <button className="app-button" onClick={closeVariablesModal}>
            Save
          </button>
        </div>
      }
    />
  );

  const hasPlayButton = () => {
    if (block.type === "input") {
      return false;
    }

    return true;

    let hasPlayButton = block?.connectedToReference?.length === 0;
    const hasVariablesConnected = block?.variableConnections?.length > 0;

    if (hasVariablesConnected) {
      // If the variables connected are all of them "input" type,
      // then the block can be executed
      hasPlayButton = block?.variableConnections?.every(
        (variableConnection) => variableConnection.origin.blockType === "input"
      );
    }
    return hasPlayButton;
  };

  const remoteStyle = block.type === "slurm" ? "remote-block" : "";

  return (
    <div
      id={`${block?.placedID}-${block.id}`}
      // ${
      //   block.isSubBlock && !block.isPlaced && !block.isOnAir ? "subblock" : ""
      // }
      className={`plugin-block ${block.isPlaced ? "" : "plugin-block-placed"}`}
    >
      {variablesModalView}
      <div className="flex flex-row justify-between ${remoteStyle} gap-2">
        <div style={{ fontWeight: "bold" }}>{block.name}</div>
        <div className="flex flex-row gap-1 items-center">
          {/* Play button to execute the block */}
          {/* Delete button to remove the block from the canvas */}
          {block.isPlaced && (
            <>
              {block.finishedExecution && (
                <FinishedCheck runError={block.runError} />
              )}
              {hasPlayButton() ? (
                <PlayBlockButton
                  isRunning={block.isRunning}
                  runError={block.runError}
                  onClick={handleExecute}
                />
              ) : (
                <InputRunningSpinner isRunning={block.isRunning} />
              )}
              {block.type !== "input" && (
                <BlockVariablesButton onClick={openVariablesModal} />
              )}

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
      </div>
      <div
        className={
          "text-gray-500 transition-opacity duration-300 " +
          (isInfoHovering || block.isPlaced ? "opacity-100" : "opacity-0")
        }
      >
        {isInfoHovering || (block.isPlaced && block.type !== "input") ? (
          <div>
            <div className="plugin-description">{block.description}</div>
            {block.type === "slurm" && (
              <div className="remote-block-cloud">
                <ServerIcon /> Slurm Block
              </div>
            )}
          </div>
        ) : null}

        {block.type === "input" && block.isPlaced && (
          <div>
            <PluginVariableView
              key={
                block.variables[0].id +
                "-" +
                0 +
                "-" +
                block.id +
                "-" +
                block.placedID
              }
              variable={block.variables[0]}
              onChange={handleChange}
              hideName={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function InputBlock(block: Block) {}

type DraggableBlockViewProps = {
  block: Block;
  isConnecting: boolean;
  tryingToConnect: {
    variableID: string;
    variableType: PluginVariableTypes;
    variableAllowedValues: Array<string>;
  };
  updateBlockSelectedGroup?: (blockID: number, selectedInputGroup) => void;
};

function DraggableBlockView(props: DraggableBlockViewProps) {
  const { block, updateBlockSelectedGroup } = props;

  const updateXarrow = useXarrow();
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: block.placedID ? `${block.placedID}-${block.id}` : block.id,
    data: {
      block: block,
      updateXarrow: updateXarrow,
    },
  });

  const { setNodeRef: setDropRef } = useDroppable({
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
  };

  if (block.isPlaced) {
    style.transform = `translate(${block?.position?.x}px, ${block?.position?.y}px)`;
  }

  if (transform && block.isPlaced) {
    const deltx = transform.x + block.position.x;
    const delty = transform.y + block.position.y;
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

  const outputConnectors = () => {
    return block.outputs.length === 0 ? (
      <ArrowBlockConnector from={ref} block={block} />
    ) : (
      <OutputConnectView
        key={"output-connectors-" + block.id + "-" + block.placedID}
        block={block}
      />
    );
  };

  const handleSelectedInputGroupChange = (direction: "up" | "down") => {
    if (block.inputs.length === 1) {
      return;
    }

    // Get the selected group index
    const selectedInputGroupIndex = block.inputs.findIndex((input) => {
      return input.id === block.selectedInputGroup;
    });

    let newIndex = selectedInputGroupIndex;
    if (direction === "up") {
      if (selectedInputGroupIndex === block.inputs.length - 1) {
        newIndex = 0;
      } else {
        newIndex++;
      }
    }

    if (direction === "down") {
      if (selectedInputGroupIndex === 0) {
        newIndex = block.inputs.length - 1;
      } else {
        newIndex--;
      }
    }

    // Get the selected group
    let selectedInputGroup = block.inputs[0].id;
    block.inputs.forEach((input, index) => {
      if (index === newIndex) {
        selectedInputGroup = input.id;
      }
    });

    // Update the block state
    updateBlockSelectedGroup(block.placedID, selectedInputGroup);

    // Call the onChange function of the block
    block.onChange(block.placedID);
  };

  const visibleInputs = block.inputs.find(
    (inputGroup) => inputGroup.id === block.selectedInputGroup
  );

  const variablesConnectorView = () => {
    if (block.type === "input") {
      return <>{outputConnectors()}</>;
    }

    return (
      <>
        <div className="flex flex-row gap-1">
          <VariableBallView
            key={block.id + "-" + block.placedID}
            variables={visibleInputs.variables}
            isConnecting={props.isConnecting}
            tryingToConnect={props.tryingToConnect}
            placedID={block.placedID}
            block={block}
            handleSelectedInputGroupChange={handleSelectedInputGroupChange}
            // updateXarrow={updateXarrow}
          />
          {outputConnectors()}
          {/* {block.outputs && (
            <OutputConnectView
              key={"output-connectors-" + block.id + "-" + block.placedID}
              block={block}
            />
          )} */}
        </div>
      </>
    );
  };

  return (
    <div
      ref={ref}
      style={style}
      {...listeners}
      {...attributes}
      className={block.isPlaced ? "absolute" : "relative"}
    >
      <BlockView {...block} />
      {block.isPlaced && variablesConnectorView()}
    </div>
  );
}

export { BlockView, DraggableBlockView };

function FinishedCheck(props: { runError: boolean }) {
  if (props.runError) {
    return (
      <div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="red"
          className="w-5 h-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="green"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    </div>
  );
}

function ServerIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-6 h-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z"
      />
    </svg>
  );
}
