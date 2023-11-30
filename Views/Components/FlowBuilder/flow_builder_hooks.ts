import { horusGet } from "../../Utils/utils";
import {
  Block,
  BlockVarPair,
  HorusPlugin,
  PluginVariableTypes,
  VariableConnection,
} from "./flow_builder_types";
import {
  DragEndEvent,
  DragStartEvent,
  useSensor,
  useSensors,
  getClientRect,
  MeasuringConfiguration,
  PointerSensor,
} from "@dnd-kit/core";
import { useRef, useState, useEffect } from "react";
import type { PointerEvent } from "react";

/**
 * An extended "PointerSensor" that prevent some
 * interactive html element(button, input, textarea, select, option...) from dragging
 */
class SmartPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as any,
      handler: ({ nativeEvent: event }: PointerEvent) => {
        if (
          !event.isPrimary ||
          event.button !== 0 ||
          isInteractiveElement(event.target as Element)
        ) {
          return false;
        }

        return true;
      },
    },
  ];
}

/**
 * Helper function to check if an element is interactive
 * @param element The element to check
 * @returns Whether the element is interactive or not
 */
function isInteractiveElement(element: Element | null) {
  const interactiveElements = [
    "button",
    "input",
    "textarea",
    "select",
    "option",
    "rect",
  ];

  if (
    element?.tagName &&
    interactiveElements.includes(element.tagName.toLowerCase())
  ) {
    return true;
  }

  return false;
}

/**
 * The controller for the Flow Builder component.
 */
class FlowBuilderController {
  constructor() {}

  /**
   * Fetches the list of available blocks from the server.
   * @returns A promise that resolves to an array of Block objects.
   */
  public async fetchBlocks(): Promise<Array<Block>> {
    const response = await horusGet("/api/plugins/list");

    const data = await response.json();

    const plugins: Array<HorusPlugin> = data.plugins;
    // Parse the data into the blockList
    const blockList: Array<Block> = [];
    plugins.forEach((plugin: HorusPlugin) => {
      plugin.blocks.forEach((block: Block) => {
        const newBlock: Block = {
          ...block,
          plugin: plugin,
          isPlaced: false,
          position: { x: 0, y: 0 },
          connectedTo: [],
          connectedToReference: [],
          variableConnections: [],
          variableConnectionsReference: [],
        };
        blockList.push(newBlock);
      });
    });

    return blockList;
  }

  /**
   * Filters the list of blocks based on a search query.
   * @param query - The search query to filter the blocks by.
   * @param blockList - The list of blocks to filter.
   * @returns An array of Block objects that match the search query.
   */
  filterBlocks(query: string, blockList: Array<Block>): Array<Block> {
    if (!query) {
      return blockList;
    }

    const filtered = blockList.filter((block) => {
      const blockName = block.name.toLowerCase();
      const blockPlugin = block.plugin.name.toLowerCase();
      const blockDescription = block.description.toLowerCase();
      return (
        blockName.includes(query.toLowerCase()) ||
        blockPlugin.includes(query.toLowerCase()) ||
        blockDescription.includes(query.toLowerCase())
      );
    });

    return filtered;
  }

  moveBlock(block: Block, delta = { x: 0, y: 0 }) {
    // Set the new position
    const newBlock: Block = {
      ...block,
      position: {
        x: block.position.x + delta.x,
        y: block.position.y + delta.y,
      },
    };

    return newBlock;
  }
}

const useDNDTweaks = () => {
  // DND tweaks
  const mouseSensor = useSensor(SmartPointerSensor, {
    activationConstraint: {
      distance: 5,
    },
  });

  const sensors = useSensors(mouseSensor);

  const measuring: MeasuringConfiguration = {
    droppable: {
      measure: getClientRect,
    },
  };

  return { sensors, measuring };
};

const flowBuilderController = new FlowBuilderController();

// Create a new flow builder hook
const useFlowBuilder = () => {
  const dndTweaks = useDNDTweaks();

  const [placedBlocks, setPlacedBlocks] = useState<Array<Block>>([]);
  const [draggingBlock, setDraggingBlock] = useState<Block>();

  const mousePos = useRef({ x: 0, y: 0 });

  const [saved, _setSaved] = useState(true);
  const currentSaved = useRef(saved);

  // Events
  useEffect(() => {
    // Set a window event listener for the mousemove event
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  const setSaved = (value: boolean) => {
    currentSaved.current = value;
    _setSaved(value);
  };

  const placedIDCounter = useRef(1);

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingBlock(undefined);

    const { active, over, delta } = event;

    // Check for an variable-variable / block-block connection
    if (active.data.current.type === "connector") {
      handleVariableConnectionAllowed(event);
      handleArrowBlockConnection(event);
      return;
    }

    // Get the current dragged block
    const currentBlock = active.data.current?.block;

    if (!currentBlock) {
      return;
    }

    setSaved(false);

    // If its already placed, its a moving operations
    if (currentBlock.isPlaced) {
      handleBlockMove(event);
      return;
    }

    // If it is dropped inside the flow reciver
    // we add it to the current flow
    if (
      over &&
      over.id === "flow-reciver" &&
      currentBlock.parent === undefined
    ) {
      addBlockToFlow(currentBlock, event);
      return;
    }

    // Get the over block
    const overBlock = over?.data?.current?.block;

    if (!overBlock) {
      return;
    }
  };

  const handleArrowBlockConnection = (event: DragEndEvent) => {
    const { active, over } = event;

    // Get the current dragged variable
    const dragging = active.data.current?.blockVarPair as BlockVarPair;

    if (!dragging) {
      return;
    }

    // If the dragged variable is not an output, connect the blocks instead of the variables
    if (!dragging.variableID) {
      const destinationBlock = over.data.current?.block as Block;

      if (!destinationBlock) {
        return;
      }

      connectBlocks(dragging.placedID, destinationBlock.placedID);
      return;
    }

    // Get the over variable
    const destination = over?.data?.current?.blockVarPair as BlockVarPair;

    if (!destination) {
      return;
    }

    // Else connect the variables
    connectVars(dragging, destination);
  };

  const handleBlockMove = (event: DragEndEvent) => {
    const { active, delta } = event;

    // Get the current dragged block
    const currentBlock = active.data.current?.block as Block;

    if (!currentBlock) {
      return;
    }

    // Get the current position
    const currentPosition = currentBlock.position;

    if (!currentPosition) {
      return;
    }

    const { over } = event;

    // If the over block is not the flow reciver, we don't move the block
    if (!over?.id) {
      return;
    }

    // Set the new position
    const newBlock: Block = flowBuilderController.moveBlock(
      currentBlock,
      delta
    );

    // Update the state
    setPlacedBlocks((blocks: Array<Block>) => {
      return blocks.map((b) => {
        if (b.placedID === currentBlock?.placedID) {
          return newBlock;
        }
        return b;
      });
    });

    // Update the saved state
    setSaved(false);
  };

  // Helper function
  function convertRemToPixels(rem) {
    return (
      rem * parseFloat(getComputedStyle(document.documentElement).fontSize)
    );
  }

  const addBlockToFlow = (block: Block, event: DragEndEvent) => {
    const newBlock: Block = {
      ...block,
      isPlaced: true,
      placedID: placedIDCounter.current,
      position: {
        x: mousePos.current.x - convertRemToPixels(20),
        y: mousePos.current.y - convertRemToPixels(5 + 3.34),
      },
      variables: block.variables.map((variable) => {
        return {
          ...variable,
          placedID: placedIDCounter.current,
        };
      }),
    };

    const newPlacedBlocks = [...placedBlocks, newBlock];

    // Update the state
    setPlacedBlocks(newPlacedBlocks);

    // Update the placedIDCounter
    placedIDCounter.current += 1;
  };

  const handleBlockDrag = (event: DragStartEvent) => {
    // Get the current dragged block
    const { active } = event;

    if (active.data.current.type === "connector") {
      handleVariableConnectionAllowed(event);
      return;
    }

    const currentBlock = event.active.data.current.block;

    if (currentBlock.isPlaced) {
      return;
    }

    setDraggingBlock(currentBlock);
  };

  const handleMouseMove = (event) => {
    mousePos.current = {
      x: event.clientX - event.target.offsetLeft,
      y: event.clientY - event.target.offsetTop,
    };
  };

  const unconnectBlocks = (currentBlock: Block, connectedBlock: Block) => {
    // First find the real blocks from the placedBlocks array

    const originBlock = placedBlocks.find((b) => {
      return b.placedID === currentBlock.placedID;
    });

    const destinationBlock = placedBlocks.find((b) => {
      return b.placedID === connectedBlock.placedID;
    });

    // Remove the connection from the "destination" block
    const newDestinationBlock: Block = {
      ...destinationBlock,
      connectedTo: destinationBlock.connectedTo.filter((b) => {
        return b !== originBlock.placedID;
      }),
    };

    // Remove the connection reference from the "origin" block
    const newOriginBlock: Block = {
      ...originBlock,
      connectedTo: originBlock.connectedTo.filter((b) => {
        return b !== destinationBlock.placedID;
      }),
    };

    // Update the state
    setPlacedBlocks((blocks: Array<Block>) => {
      return blocks.map((b: Block) => {
        if (b.placedID === newDestinationBlock.placedID) {
          return newDestinationBlock;
        }
        if (b.placedID === newOriginBlock.placedID) {
          return newOriginBlock;
        }
        return b;
      });
    });

    setSaved(false);
  };

  const updateCyclesCount = (destination: BlockVarPair, cycles: number) => {
    // Get the destination block
    const destinationBlock = placedBlocks.find((b) => {
      return b.placedID === destination.placedID;
    });

    // Get the connection that is cyclic
    const connection = destinationBlock.variableConnections.find((vc) => {
      return (
        vc.destination.variableID === destination.variableID && vc.isCyclic
      );
    });

    // Update the cycles
    const newConnection = {
      ...connection,
      cycles: cycles,
      currentCycle: 0,
    };

    // Update the state
    setPlacedBlocks((blocks: Array<Block>) => {
      return blocks.map((b: Block) => {
        if (b.placedID === destinationBlock.placedID) {
          return {
            ...b,
            variableConnections: b.variableConnections.map((vc) => {
              if (
                vc.destination.variableID === destination.variableID &&
                vc.isCyclic
              ) {
                return newConnection;
              }
              return vc;
            }),
          };
        }
        return b;
      });
    });

    setSaved(false);
  };

  const unconnectVariables = (connection: VariableConnection) => {
    // First find the real blocks from the placedBlocks array

    const originBlock = placedBlocks.find((b) => {
      return b.placedID === connection.origin.placedID;
    });

    const destinationBlock = placedBlocks.find((b) => {
      return b.placedID === connection.destination.placedID;
    });

    // Check if at any point the connection is cyclic
    const cyclic = checkCyclicFlow(originBlock, destinationBlock);

    if (cyclic && !connection.isCyclic) {
      alert("Remove the cyclic connection first");
      return;
    }

    // Remove the connection from the "destination" block
    const newDestinationBlock: Block = {
      ...destinationBlock,
      variableConnections: destinationBlock.variableConnections.filter((b) => {
        // Delete the connection that comes from the same block
        const sameBlock = b.origin.placedID === originBlock.placedID;
        // Delete the connection that comes from the same variable
        const sameVar = b.origin.variableID === connection.origin.variableID;

        return !(sameBlock && sameVar);
      }),
    };

    // Remove the connection reference from the "origin" block
    const newOriginBlock: Block = {
      ...originBlock,
      variableConnectionsReference:
        originBlock.variableConnectionsReference.filter((b) => {
          // Delete the connection that goes to the same block
          const sameBlock =
            b.destination.placedID === destinationBlock.placedID;

          // Delete the connection that goes to the same variable
          const sameVar =
            b.destination.variableID === connection.destination.variableID;

          return !(sameBlock && sameVar);
        }),
    };

    // Update the state
    setPlacedBlocks((blocks: Array<Block>) => {
      return blocks.map((b: Block) => {
        if (b.placedID === newDestinationBlock.placedID) {
          return newDestinationBlock;
        }
        if (b.placedID === newOriginBlock.placedID) {
          return newOriginBlock;
        }
        return b;
      });
    });

    setSaved(false);
  };

  function connectBlocks(originPlacedID: number, destinationPlacedID: number) {
    // For outputs that do not have a variable,
    // we can still connect the blocks so the
    // new block can run after the previous one,
    // independently of the output (no output)

    // Check that the blocks are not the same
    if (originPlacedID === destinationPlacedID) {
      return;
    }

    // Find the actual blocks
    const originBlock = placedBlocks.find((b) => {
      return b.placedID === originPlacedID;
    });

    const destinationBlock = placedBlocks.find((b) => {
      return b.placedID === destinationPlacedID;
    });

    // Check that the destination is not an input block
    if (destinationBlock.type === "input" || originBlock.type === "input") {
      return;
    }

    // Initialize the connectTo aray if does not exists
    let connectedTo = originBlock.connectedTo || [];

    // Check that they are not already connected
    if (
      connectedTo.find((placedID) => {
        return placedID === destinationPlacedID;
      })
    ) {
      return;
    }

    // Connect
    const newOriginBlock: Block = {
      ...originBlock,
      connectedTo: [...connectedTo, destinationPlacedID],
    };

    const newDestinationBlock: Block = {
      ...destinationBlock,
      connectedToReference: [
        ...destinationBlock.connectedToReference,
        originPlacedID,
      ],
    };

    // Update the state
    setPlacedBlocks((blocks: Array<Block>) => {
      return blocks.map((b: Block) => {
        if (b.placedID === newOriginBlock.placedID) {
          return newOriginBlock;
        }

        if (b.placedID === newDestinationBlock.placedID) {
          return newDestinationBlock;
        }

        return b;
      });
    });
  }

  function checkCyclicFlow(origin: Block, destination: Block) {
    // Loop over the destination block connections
    // if the origin block is found, there is a cycle

    // If one of the connections is already cyclic, exit early to
    // prevent infinite loops
    if (
      destination.variableConnections.find((vc) => {
        return vc.isCyclic;
      })
    ) {
      return true;
    }

    // Check that the destination block has connections
    if (!destination.variableConnectionsReference) {
      return false;
    }

    const nextBlocks = destination.variableConnectionsReference.map((vc) => {
      return vc.destination.placedID;
    });

    if (nextBlocks.includes(origin.placedID)) {
      return true;
    }

    // Check the next blocks
    for (const nextBlock of nextBlocks) {
      if (
        checkCyclicFlow(
          origin,
          placedBlocks.find((b) => b.placedID === nextBlock)
        )
      ) {
        return true;
      }
    }

    return false;
  }

  function connectVars(origin: BlockVarPair, destination: BlockVarPair) {
    // Prevent connecting to the same block
    if (origin.placedID === destination.placedID) {
      return;
    }

    // Get the origin block
    const originBlock = placedBlocks.find((b) => {
      return b.placedID === origin.placedID;
    });

    // Get the destination block
    const destinationBlock = placedBlocks.find((b) => {
      return b.placedID === destination.placedID;
    });

    // Check that is not already connected
    if (
      destinationBlock.variableConnections.find((vc) => {
        return vc.origin.placedID === destination.placedID;
      })
    ) {
      return;
    }

    // Check if its the second connection to the same variable
    // const cyclic = !!destinationBlock.variableConnections.find((vc) => {
    //   return vc.destination.variableID === destination.variableID;
    // });

    const cyclic = checkCyclicFlow(originBlock, destinationBlock);

    // If its not cyclic, and the destination variable is already connected
    // to another variable, we don't allow the connection
    if (
      !cyclic &&
      destinationBlock.variableConnections.find((vc) => {
        return (
          vc.destination.variableID === destination.variableID && !vc.isCyclic
        );
      })
    ) {
      return;
    }

    // Set the variableConnections to the overBlock
    // Create a new block with the new connection
    let newDestinationBlock: Block = {
      ...destinationBlock,
      variableConnections: [
        ...destinationBlock.variableConnections,
        {
          origin: origin,
          destination: destination,
          isCyclic: cyclic,
          cycles: 1,
          currentCycle: 0,
        },
      ],
    };

    // Add a reference to the connection on the dragged block
    let newOriginBlock: Block = {
      ...originBlock,
      variableConnectionsReference: [
        ...originBlock.variableConnectionsReference,
        {
          origin: origin,
          destination: destination,
          isCyclic: cyclic,
          cycles: 1,
          currentCycle: 0,
        },
      ],
    };

    // Update the state
    setPlacedBlocks((blocks) => {
      return blocks.map((b) => {
        if (b.placedID === newDestinationBlock.placedID) {
          return newDestinationBlock;
        }
        if (b.placedID === newOriginBlock.placedID) {
          return newOriginBlock;
        }
        return b;
      });
    });
  }

  const [tryingToConnect, setTryingToConnect] = useState<{
    variableID: string;
    variableType: PluginVariableTypes;
    variableAllowedValues: Array<string>;
  } | null>(null);

  const [isConnecting, setIsConnecting] = useState(false);

  const handleVariableConnectionAllowed = (event: DragStartEvent) => {
    const { active } = event;

    const id = active.id as string;
    if (id.includes("-connector")) {
      const blockVarPair = active.data.current.blockVarPair as BlockVarPair;
      setIsConnecting(true);
      setTryingToConnect({
        variableID: blockVarPair.variableID,
        variableType: blockVarPair.variableType,
        variableAllowedValues: blockVarPair.variableAllowedValues,
      });
      return;
    }

    setIsConnecting(false);
    setTryingToConnect(null);
  };

  return {
    handleMouseMove,
    placedBlocks,
    draggingBlock,
    saved,
    setSaved,
    handleDragEnd,
    handleBlockDrag,
    flowBuilderController,
    setPlacedBlocks,
    currentSaved,
    placedIDCounter,
    dndTweaks,
    unconnectBlocks,
    unconnectVariables,
    updateCyclesCount,
    isConnecting,
    tryingToConnect,
    // handleBlockDragOver,
  };
};

export { FlowBuilderController, useFlowBuilder };
