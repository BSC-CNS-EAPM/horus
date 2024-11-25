// React
import { useState, useEffect, useRef, CSSProperties } from "react";

// TS types
import { Block, PluginVariable } from "../flow.types";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { BlockHooks } from "../flow.hooks";
import { useXarrow } from "react-xarrows";

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
    ref: React.RefObject<HTMLDivElement>;
    attributes: any; // Replace `any` with a more specific type if available
    listeners: any; // Replace `any` with a more specific type if available
    style: CSSProperties;
  };
  blockViewHooks: {
    isInfoHovering: boolean;
    setIsInfoHovering: React.Dispatch<React.SetStateAction<boolean>>;
    variablesModal: boolean;
    toggleVariablesModal: () => void;
    blockLogsModal: boolean;
    toggleBlockLogsModal: () => void;
    handleVariableChange: (value: any, id: string, groupID?: string) => void;
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
  isFlowActive,
}: BlockViewProps): BlockViewState {
  // Trigger xarrow update when block is moved
  useXarrow();

  const ref = useRef<HTMLDivElement | null>(null);

  // When the block variables are shown, disable drag
  const [disableDrag, setDisableDrag] = useState(false);

  // Track hovering on info button to display the description instead of the plugin
  const [isInfoHovering, setIsInfoHovering] = useState(false);

  const [variablesModal, setVariablesModal] = useState(false);
  const [blockLogsModal, setBlockLogsModal] = useState(false);

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: block.placedID ? `${block.placedID}-${block.id}` : block.id,
    data: {
      block: block,
    },
    disabled: disableDrag,
  });

  const { setNodeRef: setDropRef } = useDroppable({
    id: block.placedID ? `${block.placedID}-${block.id}` : block.id,
    data: {
      block: block,
    },
  });

  const toggleVariablesModal = () => {
    // Open the variables modal
    if (setDisableDrag) {
      setDisableDrag(!variablesModal);
    }
    setVariablesModal(!variablesModal);
  };

  const toggleBlockLogsModal = () => {
    if (setDisableDrag) {
      setDisableDrag(!blockLogsModal);
    }
    setBlockLogsModal(!blockLogsModal);
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

  const handleVariableChange = (value: any, id: string, groupID?: string) => {

    if (isFlowActive) {
      return
    }

    let hasChanged = false;

    const updateValue = (variable: PluginVariable) => {
      if (variable.id === id) {
        if (variable.value !== value) {
          hasChanged = true;
          variable.value = value;
        }
      }
      return variable;
    };

    // Update the variable value by searching the PluginVariable by id
    if (groupID) {
      block.variables.map((variable) => {
        if (variable.id === groupID) {
          variable.variables?.map(updateValue);
        }
      });
    } else {
      block.variables.map(updateValue);
    }

    // Call the onChange function
    if (hasChanged) {
      blockHooks?.handleBlockChanges([block]);
    }
  };

  const style: CSSProperties = {
    top: 0,
    left: 0,
    cursor: "grab",
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

  // useEffect(() => {
  //   if (block.isPlaced) {
  //     updateXarrow();
  //   }
  // }, []);

  return {
    div: {
      ref: ref,
      attributes: attributes,
      listeners: listeners,
      style: style,
    },
    blockViewHooks: {
      isInfoHovering: isInfoHovering,
      setIsInfoHovering: setIsInfoHovering,
      variablesModal,
      toggleVariablesModal: toggleVariablesModal,
      blockLogsModal: blockLogsModal,
      toggleBlockLogsModal: toggleBlockLogsModal,
      handleVariableChange: handleVariableChange,
      handleSelectedInputGroupChange: handleSelectedInputGroupChange,
    },
    settings: {
      showPlacedID: showPlacedID,
    },
  };
}
