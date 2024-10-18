// React
import { useState, useEffect, useRef, ReactNode } from "react";
import { createPortal } from "react-dom";

// Horus components
import RotatingLines from "../../RotatingLines/rotatinglines";
import ServerIcon from "../../Toolbar/Icons/Server";
import { HorusPopover, MovingChevron } from "../../reusable";

// Utilities
import { modifierKey } from "../../Toolbar/toolbar";

// Variables
import { PluginVariableView } from "../Variables/variables";
import {
  VariableModalView,
  PlacedBlockVariables,
} from "../Variables/variable_connections";
import { BlockLogsModalView } from "../Logs/logs_connections";

// Typescript types
import { Block, BlockTypes, ExtensionsToOpen, PluginPage } from "../flow.types";

// Block style
import "./block.css";

// Drag the blocks, drop the arrows
import { BlockViewProps, BlockViewState, useBlockView } from "./block.hooks";
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
import ErrorLogFile from "../../Toolbar/Icons/ErrorLogFile";
import { socket } from "../../../Utils/socket";

export function BlockView(props: BlockViewProps) {
  const { block, blockHooks, isFlowActive } = props;

  const blockState = useBlockView(props);

  return (
    <BlockWrapper blockState={blockState} block={block}>
      <BlockVariablesModalView block={block} blockState={blockState} />
      <BlockExtensionsView block={block} />
      <BlockBox block={block}>
        <BlockTopBar>
          <BlockNameAndPlacedID block={block} />
          <BlockToolbar
            block={block}
            blockState={blockState}
            blockHooks={blockHooks}
            isPaused={props.isPaused}
          />
        </BlockTopBar>
        {block.type !== BlockTypes.GHOST && (
          <BlockDescription
            description={block.description}
            show={block.isPlaced || blockState.blockViewHooks.isInfoHovering}
            animate={!block.isPlaced}
          />
        )}
        <BlockRemotes block={block} blockHooks={blockHooks} />
        <BlockBody
          block={block}
          blockState={blockState}
          isFlowActive={isFlowActive}
        />
      </BlockBox>
      <BlockVariablesAndConnections
        block={block}
        blockState={blockState}
        blockHooks={blockHooks}
      />
    </BlockWrapper>
  );
}

function BlockBox({ block, children }: { block: Block; children: ReactNode }) {
  return (
    <div
      id={`placed-${block.placedID}`}
      className={`plugin-block ${block.isPlaced && "plugin-block-placed"} ${
        block.error && "plugin-block-failed"
      }`}
    >
      {children}
    </div>
  );
}

function BlockWrapper({
  blockState,
  block,
  children,
}: BlockViewProps & { children: ReactNode; blockState: BlockViewState }) {
  return (
    // Outer div nedded fro DnD to work
    <div>
      <div
        ref={blockState.div.ref}
        style={blockState.div.style}
        {...blockState.div.listeners}
        {...blockState.div.attributes}
        className={`flex flex-col gap-1 ${
          block.isPlaced ? "absolute z-1" : "relative"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

type BlockRemotesProps = {
  block: Block;
  blockHooks?: BlockHooks;
};

function BlockVariablesAndConnections({
  block,
  blockState,
  blockHooks,
}: {
  block: Block;
  blockState: BlockViewState;
  blockHooks?: BlockHooks;
}) {
  if (!block.isPlaced || !blockHooks) {
    return null;
  }

  return (
    <PlacedBlockVariables
      block={block}
      blockHooks={blockHooks}
      handleSelectedInputGroupChange={
        blockState.blockViewHooks.handleSelectedInputGroupChange
      }
    />
  );
}

export function BlockRemotes(props: BlockRemotesProps) {
  // Do not chose any remote if the only available one is the "Local"
  if (
    !props.block.isPlaced ||
    !props.blockHooks ||
    props.blockHooks.remotesOptions.length === 1
  ) {
    return null;
  }

  return (
    <div className="remote-block-cloud items-center border-t border-gray-300 pt-1">
      <RemoteIcon />
      <div className="plugin-variable-value">
        <select
          value={props.block.selectedRemote}
          onChange={(e) => {
            props.blockHooks?.setBlockRemote(
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

function FinishedCheck(props: { error: boolean; blockLogs?: string }) {
  if (props.error) {
    return null;
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
      className="max-w-14"
      style={{
        transform: "translateY(-2px)",
      }}
    >
      {formatInterval(props.time || 0)}
    </div>
  );
}

function BlockNameAndPlacedID({ block }: { block: Block }) {
  return (
    <div
      className="block-name break-word flex flex-row gap-2 items-start"
      style={{
        transform: block.isPlaced ? "translateY(-2px)" : "",
      }}
    >
      <BreakLongUnderscoreNames name={block.name} />
      {block.isPlaced && window.horusSettings["showPlacedID"]?.value && (
        <span className="text-gray-400" style={{}}>
          {" "}
          {block.placedID}
        </span>
      )}
    </div>
  );
}

function BlockToolbar({
  block,
  blockState,
  blockHooks,
  isPaused,
}: {
  block: Block;
  blockState: BlockViewState;
  blockHooks?: BlockHooks;
  isPaused?: boolean;
}) {
  return (
    <div className="flex flex-row gap-1 items-start cursor-auto">
      {/* Play button to execute the block */}
      {/* Delete button to remove the block from the canvas */}
      {block.isPlaced && (
        <>
          {block.finishedExecution && (
            <>
              <BlockTime time={block.time} />
              <FinishedCheck error={block.error} blockLogs={block.blockLogs} />
            </>
          )}

          <BlockLogs block={block} blockState={blockState} />

          {block.type !== BlockTypes.GHOST && (
            <PlayBlockButton
              isRunning={block.isRunning}
              isPaused={isPaused ?? false}
              onClick={(resetFlow) => {
                blockHooks?.executeFlow(block.placedID, resetFlow);
              }}
            />
          )}
          {block.variables.length > 0 && block.type !== BlockTypes.INPUT && (
            <BlockVariablesButton
              onClick={blockState.blockViewHooks.toggleVariablesModal}
            />
          )}

          <DeleteBlockButton
            block={block}
            onClick={() => blockHooks?.handleDelete(block)}
          />
        </>
      )}

      {!block.isPlaced && (
        <div
          onMouseOver={() => blockState.blockViewHooks.setIsInfoHovering(true)}
          onMouseLeave={() =>
            blockState.blockViewHooks.setIsInfoHovering(false)
          }
          className="cursor-help"
        >
          <InfoIcon />
        </div>
      )}
    </div>
  );
}

function BlockTopBar({ children }: { children: React.ReactNode }) {
  return (
    <div className={`flex flex-row justify-between gap-2`}>{children}</div>
  );
}

type LogsData = {
  message: string;
  blockID: string;
  placedID: number;
};

function BlockLogs({
  block,
  blockState,
}: {
  block: Block;
  blockState: BlockViewState;
}) {
  const [updatedBlockLogs, setUpdatedBlockLogs] = useState(block.blockLogs);

  // Setup a socket listener for the "blockLogs" event
  useEffect(() => {
    const parseLogs = (logs: LogsData) => {
      const { blockID, placedID, message } = logs;

      if (blockID === block.id && placedID === block.placedID) {
        setUpdatedBlockLogs((latestLogs) => {
          return latestLogs + message;
        });
      }
    };
    socket.on("blockLogs", parseLogs);

    return () => {
      socket.off("blockLogs", parseLogs);
    };
  }, [block.id, block.placedID]);
  useEffect(() => {
    setUpdatedBlockLogs(block.blockLogs);
  }, [block.blockLogs]);

  const blockLogsView = blockState.blockViewHooks.blockLogsModal
    ? createPortal(
        <BlockLogsModalView
          block={{ ...block, blockLogs: updatedBlockLogs }}
          handleClose={() => {
            blockState.blockViewHooks.toggleBlockLogsModal();
          }}
        />,
        document.getElementById(GLOBAL_IDS.FLOW_BUILDER_DIV)!
      )
    : null;

  return (
    <>
      {blockLogsView}
      <HorusPopover
        triggerClassName="pointer-events-auto"
        trigger={
          block.error ? (
            <ErrorLogFile
              className="w-5 h-5 cursor-pointer"
              color="var(--red-error)"
              onClick={blockState.blockViewHooks.toggleBlockLogsModal}
            />
          ) : (
            <LogFileIcon
              style={{
                transform: "translateY(-1px)",
              }}
              className="w-5 h-5 cursor-pointer"
              onClick={blockState.blockViewHooks.toggleBlockLogsModal}
            />
          )
        }
      >
        <div className="hover-description">Block logs</div>
      </HorusPopover>
    </>
  );
}

function BlockDescription({
  description,
  show,
  animate,
}: {
  description: string;
  show: boolean;
  animate: boolean;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(animate ? "0px" : "auto");

  useEffect(() => {
    if (animate) {
      if (show) {
        // If show is true, set the height to the scrollHeight of the content
        setHeight(`${contentRef.current?.scrollHeight}px`);
      } else {
        // Otherwise, set it to 0px to collapse
        setHeight("0px");
      }
    }
  }, [show, animate]);

  return (
    <div
      ref={contentRef}
      className="plugin-description"
      style={{
        overflow: "hidden", // Hide overflowing content
        height: height,
        transition: "height 0.3s ease", // Animate the height change
      }}
    >
      {description}
    </div>
  );
}

function BlockBody({
  block,
  blockState,
  isFlowActive,
}: {
  block: Block;
  blockState: BlockViewState;
  isFlowActive?: boolean;
}) {
  if (!block.isPlaced) {
    return null;
  }

  const renderBlockView = () => {
    switch (block.type) {
      case BlockTypes.INPUT:
        return (
          <PluginVariableView
            key={`${block.variables[0]?.id}-0-${block.id}-${block.placedID}`}
            variable={block.variables[0]!}
            onChange={blockState.blockViewHooks.handleVariableChange}
            hideName={true}
            hideDescription={true}
            applyStyle={false}
            isFlowActive={isFlowActive}
          />
        );
      case BlockTypes.SLURM:
        return (
          <div className="remote-block-cloud border-t border-gray-300 pt-1">
            <ServerIcon /> Slurm Block - {block.status}
          </div>
        );
      case BlockTypes.GHOST:
        return (
          <div className="grid grid-cols-1 place-items-center">
            <ErrorIcon className="w-10 h-10 text-red-500" />
            <span className="text-red-500">{block.description}</span>
          </div>
        );
      default:
        return null;
    }
  };

  const content = renderBlockView();

  return content ? (
    <div
      className={
        "mt-2" +
        (block.type !== BlockTypes.SLURM && " border-t border-gray-300 pt-2")
      }
    >
      {content}
    </div>
  ) : null;
}

interface DeleteBlockButtonProps {
  block: Block;
  onClick: (block: Block) => void;
}

interface PlayBlockButtonProps {
  isRunning: boolean;
  isPaused: boolean;
  onClick: (resetFlow: boolean) => void;
}

function BlockVariablesModalView({
  block,
  blockState,
}: {
  block: Block;
  blockState: BlockViewState;
}) {
  // Create a portal to show the variables modal on top of the flow builder
  if (blockState.blockViewHooks.variablesModal) {
    return createPortal(
      <VariableModalView
        block={block}
        handleChange={blockState.blockViewHooks.handleVariableChange}
        handleClose={() => {
          blockState.blockViewHooks.toggleVariablesModal();
        }}
      />,
      document.getElementById("flow-builder-div")!
    );
  }

  return null;
}

function BlockVariablesButton({ onClick }: { onClick: () => void }) {
  return (
    <HorusPopover
      trigger={
        <button
          onClick={onClick}
          style={{
            position: "relative",
            top: "-1px",
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
