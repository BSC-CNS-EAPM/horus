// React
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// Horus components
import RotatingLines from "../../RotatingLines/rotatinglines";
import AppButton from "../../appbutton";
import ServerIcon from "../../Toolbar/Icons/Server";
import { BlurredModal, HorusPopover, MovingChevron } from "../../reusable";

// Utilities
import { modifierKey } from "../../Toolbar/toolbar";

// Variables
import { PluginVariableView } from "../Variables/variables";
import {
  VariableModalView,
  PlacedBlockVariables,
} from "../Variables/variable_connections";
import { SlurmOutputModalView } from "../Logs/logs_connections";

// Typescript types
import { Block, BlockTypes, ExtensionsToOpen, PluginPage } from "../flow.types";

// Block style
import "./block.css";

// Drag the blocks, drop the arrows
import { BlockViewProps, useBlockView } from "./block.hooks";
import { BlockHooks } from "../flow.hooks";
import InfoIcon from "../../Toolbar/Icons/Info";
import RemoteIcon from "../../Toolbar/Icons/Remote";
import TrashIcon from "../../Toolbar/Icons/Trash";
import SettingsIcon from "../../Toolbar/Icons/Settings";
import LogFileIcon from "../../Toolbar/Icons/LogFile";
import CheckMark from "../../Toolbar/Icons/CheckMark";
import ErrorIcon from "../../Toolbar/Icons/Error";
import PlayIcon from "../../Toolbar/Icons/Play";
import { GLOBAL_IDS } from "../../../Utils/globals";
import PausedIcon from "../../Toolbar/Icons/Paused";

export function BlockView(props: BlockViewProps) {
  const blockState = useBlockView(props);

  // Create a portal to show the variables modal on top of the flow builder
  const VariableModal = blockState.blockViewHooks.variablesModal
    ? createPortal(
        <VariableModalView
          block={props.block}
          handleChange={blockState.blockViewHooks.handleVariableChange}
          handleClose={() => {
            blockState.blockViewHooks.toggleVariablesModal();
          }}
        />,
        document.getElementById("flow-builder-div")!
      )
    : null;

  const SlurmOutputModal = blockState.blockViewHooks.slurmOutputModal
    ? createPortal(
        <SlurmOutputModalView
          block={props.block}
          handleChange={blockState.blockViewHooks.handleVariableChange}
          handleClose={() => {
            blockState.blockViewHooks.toggleSlurmOutputModal();
          }}
        />,
        document.getElementById("flow-builder-div")!
      )
    : null;

  return (
    <div>
      <div
        ref={blockState.div.ref}
        style={blockState.div.style}
        {...blockState.div.listeners}
        {...blockState.div.attributes}
        className={`flex flex-col gap-1 ${
          props.block.isPlaced ? "absolute z-1" : "relative"
        }`}
      >
        {VariableModal}
        <BlockExtensionsView block={props.block} />
        <div
          id={`placed-${props.block.placedID}`}
          className={`plugin-block ${
            props.block.isPlaced && "plugin-block-placed"
          } ${props.block.runError && "plugin-block-failed"}`}
        >
          <div className={`flex flex-row justify-between gap-2`}>
            <div
              className="block-name break-word flex flex-row gap-2 items-start"
              style={{
                transform: props.block.isPlaced ? "translateY(-2px)" : "",
              }}
            >
              <BreakLongUnderscoreNames name={props.block.name} />
              {props.block.isPlaced &&
                window.horusSettings["showPlacedID"]?.value && (
                  <span className="text-gray-400" style={{}}>
                    {" "}
                    {props.block.placedID}
                  </span>
                )}
            </div>
            <div className="flex flex-row gap-1 items-start cursor-auto">
              {/* Play button to execute the block */}
              {/* Delete button to remove the block from the canvas */}
              {props.block.isPlaced && (
                <>
                  {props.block.finishedExecution && (
                    <>
                      <BlockTime time={props.block.time} />
                      <FinishedCheck
                        runError={props.block.runError}
                        runErrorMessage={props.block.runErrorMessage}
                      />
                    </>
                  )}

                  <PlayBlockButton
                    isRunning={props.block.isRunning}
                    isPaused={props.isPaused ?? false}
                    runError={props.block.runError}
                    onClick={(resetFlow) => {
                      props.blockHooks?.executeFlow(
                        props.block.placedID,
                        resetFlow
                      );
                    }}
                  />
                  {props.block.variables.length > 0 &&
                    props.block.type !== BlockTypes.INPUT && (
                      <BlockVariablesButton
                        onClick={blockState.blockViewHooks.toggleVariablesModal}
                      />
                    )}

                  <DeleteBlockButton
                    block={props.block}
                    onClick={() => props.blockHooks?.handleDelete(props.block)}
                  />
                </>
              )}

              {!props.block.isPlaced && (
                <div
                  onMouseOver={() =>
                    blockState.blockViewHooks.setIsInfoHovering(true)
                  }
                  onMouseLeave={() =>
                    blockState.blockViewHooks.setIsInfoHovering(false)
                  }
                  className="cursor-help"
                >
                  <InfoIcon />
                </div>
              )}
            </div>
          </div>
          <div
            className={
              "text-gray-500 transition-opacity duration-300 " +
              (blockState.blockViewHooks.isInfoHovering || props.block.isPlaced
                ? "opacity-100"
                : "opacity-0")
            }
          >
            <div className="flex flex-row gap-1 items-center cursor-auto ">
              {blockState.blockViewHooks.isInfoHovering ||
              props.block.isPlaced ? (
                <div className="w-full">
                  <div className="plugin-description">
                    {props.block.description}
                  </div>
                  {props.block.type === BlockTypes.SLURM &&
                    props.block.isPlaced && (
                      <div className="remote-block-cloud">
                        {SlurmOutputModal}
                        <ServerIcon /> Slurm Block - {props.block.status}
                        <div style={{ position: "absolute", right: "15px" }}>
                          <SlurmLoggingButton
                            onClick={
                              blockState.blockViewHooks.toggleSlurmOutputModal
                            }
                          />
                        </div>
                      </div>
                    )}
                  {props.block.isPlaced && (
                    <div>
                      <hr className="mt-1 mb-1" />
                      <BlockRemotes
                        block={props.block}
                        blockHooks={props.blockHooks!}
                      />
                      {props.block.type === BlockTypes.INPUT && (
                        <hr className="mt-1 mb-1" />
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {props.block.type === BlockTypes.INPUT && props.block.isPlaced && (
              <PluginVariableView
                key={
                  props.block.variables[0]?.id +
                  "-" +
                  0 +
                  "-" +
                  props.block.id +
                  "-" +
                  props.block.placedID
                }
                variable={props.block.variables[0]!}
                onChange={blockState.blockViewHooks.handleVariableChange}
                hideName={true}
                hideDescription={true}
                applyStyle={false}
              />
            )}
          </div>
        </div>
        {props.block.isPlaced && (
          <PlacedBlockVariables
            block={props.block}
            blockHooks={props.blockHooks!}
            handleSelectedInputGroupChange={
              blockState.blockViewHooks.handleSelectedInputGroupChange
            }
          />
        )}
      </div>
    </div>
  );
}
type BlockRemotesProps = {
  block: Block;
  blockHooks: BlockHooks;
};

export function BlockRemotes(props: BlockRemotesProps) {
  return (
    <div className="remote-block-cloud items-center mt-0">
      <RemoteIcon />
      <div className="plugin-variable-value">
        <select
          value={props.block.selectedRemote}
          onChange={(e) => {
            props.blockHooks.setBlockRemote(
              props.block.placedID,
              e.target.value
            );
          }}
        >
          {props.blockHooks.remotesOptions.map((remote) => (
            <option key={remote} value={remote}>
              {remote}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function BlockExtensionsView(props: { block: Block }) {
  const block = props.block;

  const [shown, setShown] = useState(false);

  if (block.extensionsToOpen.length === 0) {
    return null;
  }

  const openExtension = (extension: ExtensionsToOpen) => {
    // Emit an extension event to the iFrame
    const reconstructedPage: PluginPage = {
      name: extension.title,
      url: extension.url,
      plugin: extension.pluginID,
      id: extension.pageID,
      description: "Block extension",
      hidden: false,
    };

    const event = new CustomEvent("loadExtension", {
      detail: { page: reconstructedPage, data: extension.data },
    });

    window.dispatchEvent(event);
  };

  return (
    <div
      className="w-full h-full"
      style={{
        transform: "translateY(-2rem)",
        position: "absolute",
        pointerEvents: "all",
      }}
    >
      {block.extensionsToOpen.map((extension, index) => {
        return (
          <div
            key={index}
            className="w-full mb-2 extensions-box cursor-pointer"
            style={{
              top: shown ? `-${(index + 1) * 2}rem` : 0,
              opacity: shown ? 1 : 0,
              transition: "opacity 0.2s ease-in-out, top 0.2s ease-in-out",
            }}
            onClick={() => {
              if (shown) {
                openExtension(extension);
              }
            }}
          >
            {extension.title ?? "Open results"}
          </div>
        );
      })}
      <div className="w-full flex flex-row justify-between extensions-box px-2">
        Extensions
        <div
          onClick={() => {
            setShown(!shown);
          }}
        >
          <MovingChevron down={shown} />
        </div>
      </div>
    </div>
  );
}

function FinishedCheck(props: { runError: boolean; runErrorMessage?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  if (props.runError) {
    return (
      <>
        {isOpen &&
          createPortal(
            <BlurredModal
              show={isOpen}
              onHide={() => {
                setIsOpen(false);
              }}
              maxContentSize={{
                height: "h-[85%]",
              }}
            >
              <div className="flex flex-col h-full justify-between">
                <div className="sticky top-0 z-10">
                  <div
                    id="block-error-title"
                    className="font-semibold text-3xl"
                    style={{
                      color: "var(--digital-grey-IV)",
                    }}
                  >
                    The block failed with the following error
                  </div>
                  <hr className="my-4 p-0"></hr>
                </div>
                <pre className="h-full select-text">
                  {props.runErrorMessage}
                </pre>
                <hr className="p-2"></hr>
                <div className="flex items-center justify-center">
                  <AppButton
                    action={() => {
                      setIsOpen(false);
                    }}
                  >
                    Close
                  </AppButton>
                </div>
              </div>
            </BlurredModal>,
            document.getElementById(GLOBAL_IDS.FLOW_BUILDER_DIV)!
          )}
        <div
          onClick={() => {
            setIsOpen(true);
          }}
          className="cursor-pointer"
          style={{
            position: "relative",
            top: "-2px",
          }}
        >
          <ErrorIcon color="var(--red-error)" className="w-5 h-5" />
        </div>
      </>
    );
  }

  return (
    <CheckMark
      color="var(--pop-code)"
      style={{
        transform: "translateY(-3px)",
      }}
    />
  );
}

function BlockTime(props: { time?: number }) {
  const formatTime = (time: number) => {
    return time < 10 ? "0" + time : time;
  };
  const formatInterval = (interval: number) => {
    // If no number is passed, return nothing
    if (!interval || interval === 0) {
      return null;
    }

    // If the interval has less than 1 second, show ms without decimals
    if (interval < 1) {
      return `${Math.floor(interval * 1000)}ms`;
    }

    // Converts the interval (s) to hh:mm:ss
    const seconds = Math.floor(interval % 60);

    // If the interval has less than 1 minute, show seconds
    if (interval < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(interval / 60) % 60;

    // If the interval has less than 1 hour, show minutes and seconds
    if (interval < 3600) {
      return `${formatTime(minutes)}:${formatTime(seconds)}`;
    }

    const hours = Math.floor(interval / 3600);

    return `${formatTime(hours)}:${formatTime(minutes)}:${formatTime(seconds)}`;
  };

  return (
    <div
      className="overflow-scroll max-w-14"
      style={{
        transform: "translateY(-2px)",
      }}
    >
      {formatInterval(props.time || 0)}
    </div>
  );
}

interface DeleteBlockButtonProps {
  block: Block;
  onClick: (block: Block) => void;
}

interface PlayBlockButtonProps {
  isRunning: boolean;
  runError: boolean;
  isPaused: boolean;
  onClick: (resetFlow: boolean) => void;
}

function BlockVariablesButton({ onClick }: { onClick: () => void }) {
  return (
    <HorusPopover
      trigger={
        <button
          onClick={onClick}
          style={{
            position: "relative",
            top: "-2px",
            right: "-1px",
          }}
        >
          <SettingsIcon className="w-5 h-5" />
        </button>
      }
    >
      <div className="hover-description">Setup variables</div>
    </HorusPopover>
  );
}
function SlurmLoggingButton({ onClick }: { onClick: () => void }) {
  return (
    <HorusPopover
      trigger={
        <button
          onClick={onClick}
          style={{
            pointerEvents: "all",
            right: 0,
            position: "absolute",
            marginLeft: "auto",
          }}
        >
          <LogFileIcon />
        </button>
      }
    >
      <div className="hover-description">Job info</div>
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
        <button
          onClick={deleteBlock}
          style={{
            position: "relative",
            top: "-2px",
          }}
        >
          <TrashIcon
            color="var(--red-error)"
            style={{
              height: "1.35rem",
              width: "1.35rem",
            }}
          />
        </button>
      }
    >
      <div className="hover-description">Delete block</div>
    </HorusPopover>
  );
}

function PlayBlockButton({
  isRunning,
  isPaused,
  onClick,
}: PlayBlockButtonProps) {
  const [executeDescription, setExecuteDescription] = useState("Execute block");
  const isModifierPressed = useRef(false);

  const handleClick = () => {
    onClick(isModifierPressed.current);
  };

  // If the user presses the "Alt / option" key, change the description to
  // "Reset flow and execute block"
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.getModifierState(modifierKey)) {
        setExecuteDescription("Reset flow and execute block");
        isModifierPressed.current = true;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!event.getModifierState(modifierKey)) {
        setExecuteDescription("Execute block");
        isModifierPressed.current = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  if (isRunning && isPaused) {
    return (
      <PausedIcon
        className="w-5 h-5 text-orange-500"
        style={{
          position: "relative",
          top: "-1px",
          right: "-3px",
        }}
      />
    );
  }

  if (isRunning) {
    return (
      <RotatingLines
        size={"1.5rem"}
        style={{
          position: "relative",
          top: "-4px",
        }}
      />
    );
  }

  return (
    <HorusPopover
      trigger={
        <button
          onClick={handleClick}
          style={{
            position: "relative",
            right: "-2px",
          }}
        >
          <PlayIcon />
        </button>
      }
    >
      <div className="hover-description">{executeDescription}</div>
    </HorusPopover>
  );
}

export function BreakLongUnderscoreNames(props: { name: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.innerHTML = container.innerHTML.replace(/_/g, "_<wbr>");
    }
  }, [props.name]);

  return <span ref={containerRef}>{props.name}</span>;
}
