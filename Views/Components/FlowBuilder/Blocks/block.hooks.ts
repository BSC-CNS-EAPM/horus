// React
import {
  useState,
  useEffect,
  useRef,
  CSSProperties,
  useContext,
  useCallback
} from "react";

// TS types
import { Block, CustomVariable, PluginVariable } from "../flow.types";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { BlockHooks } from "../flow.hooks";
import { useXarrow } from "react-xarrows";
import {
  addPanel,
  DockContext,
  PANEL_REGISTRY
} from "@/Components/MainApp/PanelView";

export function blockLogsPanelID(block: Block) {
  return `${PANEL_REGISTRY.blockLogs.id}-${block.id}-${block.placedID}`;
}

export type BlockViewProps = {
  block: Block;
  blockHooks?: BlockHooks;
  onAir?: boolean;
  scale?: number;
  isPaused?: boolean;
  isFlowActive?: boolean;
};

export type BlockViewState = {
  div: {
    ref: React.RefObject<HTMLDivElement | null>;
    attributes: any; // Replace `any` with a more specific type if available
    listeners: any; // Replace `any` with a more specific type if available
    style: CSSProperties;
  };
  blockViewHooks: {
    isInfoHovering: boolean;
    setIsInfoHovering: React.Dispatch<React.SetStateAction<boolean>>;
    toggleVariablesModal: () => void;
    toggleBlockLogsModal: () => void;
    handleVariableChange: (
      value: any,
      variable: PluginVariable,
      groupID?: string,
      options?: { buttonTitle?: string }
    ) => void;
    handleSelectedInputGroupChange: (direction: "up" | "down") => void;
  };
  settings: {
    showPlacedID: boolean;
  };
};

export function useBlockView({
  block,
  blockHooks,
  onAir,
  scale,
  isFlowActive
}: BlockViewProps): BlockViewState {
  // Trigger xarrow update when block is moved
  useXarrow();

  const ref = useRef<HTMLDivElement | null>(null);

  const { dockApi } = useContext(DockContext);

  // Track hovering on info button to display the description instead of the plugin
  const [isInfoHovering, setIsInfoHovering] = useState(false);

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: block.placedID ? `${block.placedID}-${block.id}` : block.id,
    data: {
      block: block
    }
  });

  const { setNodeRef: setDropRef } = useDroppable({
    id: block.placedID ? `${block.placedID}-${block.id}` : block.id,
    data: {
      block: block
    }
  });

  const panelID = `${PANEL_REGISTRY.blockVariables.id}-${block.id}-${block.placedID}`;

  const toggleVariablesModal = () => {
    // Open the variables modal
    addPanel({
      dockApi,
      component: PANEL_REGISTRY.blockVariables.component,
      panelID: `${PANEL_REGISTRY.blockVariables.id}-${block.id}-${block.placedID}`,
      params: {
        placedID: block.placedID,
        block: block,
        handleVariableChange
      }
    });
  };

  const toggleBlockLogsModal = () => {
    // Open the block logs modal
    addPanel({
      dockApi,
      component: PANEL_REGISTRY.blockLogs.component,
      panelID: blockLogsPanelID(block),
      params: {
        placedID: block.placedID,
        block: block
      }
    });
  };

  // Update the params of the block logs panel when opened
  useEffect(() => {
    const logsPanelID = blockLogsPanelID(block);
    const exists = dockApi?.getPanel(logsPanelID);
    exists?.api.updateParameters({
      block: block
    });
  }, [block, dockApi]);

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
    let selectedInputGroup = block.inputs[0]?.id;
    block.inputs.forEach((input, index) => {
      if (index === newIndex) {
        selectedInputGroup = input.id;
      }
    });

    if (!selectedInputGroup) {
      return;
    }

    // Update the block state
    blockHooks?.setBlockInputGroup(block.placedID, selectedInputGroup);
  };

  const handleVariableChange = useCallback(
    (value: any, variableToChange: PluginVariable, groupID?: string, { buttonTitle }: { buttonTitle?: string } = {}) => {
      if (isFlowActive) {
        return;
      }

      // Get the latest block state from blockHooks to avoid stale closure
      const latestBlocks = blockHooks?.findBlocks([block.placedID]);
      const latestBlock = latestBlocks?.[0];

      if (!latestBlock) {
        return;
      }

      let hasChanged = false;
      const updateValue = (variable: PluginVariable) => {
        if (
          variable.id === variableToChange.id &&
          variable.placedID === variableToChange.placedID
        ) {
          if (variable.value !== value) {
            hasChanged = true;
            variable.value = value;
          }
        }
        return variable;
      };

      // Update the variable value by searching the PluginVariable by id
      if (groupID) {
        latestBlock.variables.map((variable: PluginVariable) => {
          if (variable.id === groupID) {
            variable.variables?.map(updateValue);
          }
        });
      } else {
        latestBlock.variables.map(updateValue);
      }

      // Update the button title if it's a custom variable, and was provided
      if (buttonTitle) {
        latestBlock.variables.map((variable: PluginVariable) => {
          if (
            variable.id === variableToChange.id &&
            variable.placedID === variableToChange.placedID &&
            variable.isCustom
          ) {
            hasChanged = true;
            (variable as CustomVariable).buttonTitle = buttonTitle;
          }
        });
      }

      // Call the onChange function with the latest block state
      if (hasChanged) {
        blockHooks?.handleBlockChanges([latestBlock]);
      }
    },
    [block.placedID, blockHooks, isFlowActive]
  );

  // Update the params of the block variables panel when opened
  useEffect(() => {
    const exists = dockApi?.getPanel(panelID);
    exists?.api.updateParameters({
      handleVariableChange,
      block: block
    });
  }, [block, dockApi, handleVariableChange, panelID]);

  const style: CSSProperties = {
    top: 0,
    left: 0,
    cursor: "grab"
  };

  if (block.isPlaced) {
    style.transform = `translate(${block?.position?.x}px, ${block?.position?.y}px)`;
  }

  if (transform && block.isPlaced) {
    const deltx = transform.x * (1 / (scale || 1)) + block.position.x;
    const delty = transform.y * (1 / (scale || 1)) + block.position.y;
    style.transform = `translate(${deltx}px, ${delty}px)`;
  }

  if (transform || onAir) {
    style.cursor = "grabbing";
  }

  const showPlacedID = window.horusSettings["showPlacedID"]?.value ?? false;

  useEffect(() => {
    setDropRef(ref.current);
    setNodeRef(ref.current);
  }, [ref]);

  return {
    div: {
      ref: ref,
      attributes: attributes,
      listeners: listeners,
      style: style
    },
    blockViewHooks: {
      isInfoHovering: isInfoHovering,
      setIsInfoHovering: setIsInfoHovering,
      toggleVariablesModal: toggleVariablesModal,
      toggleBlockLogsModal: toggleBlockLogsModal,
      handleVariableChange: handleVariableChange,
      handleSelectedInputGroupChange: handleSelectedInputGroupChange
    },
    settings: {
      showPlacedID: showPlacedID
    }
  };
}
