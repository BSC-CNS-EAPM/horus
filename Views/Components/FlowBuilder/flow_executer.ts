import { Block, BlockTypes, BlockVarPair } from "./flow_builder_types";
import { horusPost } from "../../Utils/utils";

type ExecuteResponse = {
  ok: boolean;
  error?: string;
  outputs?: {
    [key: string]: any;
  };
};

export default class FlowExecuter {
  public placedBlocks: Array<Block> = [];
  private flowPath: string = "";
  private flowSavedID: string = "";
  public currentExecuting: number | null = null;
  public stopExecute: boolean = false;

  private _setCurrentExecuting: React.Dispatch<
    React.SetStateAction<number | null>
  >;
  private setCurrentExecuting = (blockID: number | null) => {
    this._setCurrentExecuting(blockID);
    this.currentExecuting = blockID;
  };
  private setPlacedBlocks: React.Dispatch<React.SetStateAction<Array<Block>>>;
  // private setExecutingAll: React.Dispatch<React.SetStateAction<boolean>>;
  private handleSave: () => Promise<void>;

  private setExecutingAll(status: boolean) {
    console.log("Setting executing all to: ", status);
  }

  constructor(
    setCurrentExecuting: React.Dispatch<React.SetStateAction<number | null>>,
    setPlacedBlocks: React.Dispatch<React.SetStateAction<Array<Block>>>,
    setExecutingAll: React.Dispatch<React.SetStateAction<boolean>>,
    handleSave: () => Promise<void>
  ) {
    this._setCurrentExecuting = setCurrentExecuting;
    this.setPlacedBlocks = setPlacedBlocks;
    // this.setExecutingAll = setExecutingAll;
    this.handleSave = handleSave;
  }

  public updatePlacedBlocks(placedBlocks: Array<Block>) {
    this.placedBlocks = placedBlocks;
  }

  public updateFlowPath(flowPath: string) {
    this.flowPath = flowPath;
  }

  public setSavedID(flowSavedID: string) {
    this.flowSavedID = flowSavedID;
  }

  private async executeBlockServer(
    block: Block,
    resetRemote: boolean
  ): Promise<ExecuteResponse> {
    // Set current executing block
    this.setCurrentExecuting(block.placedID);

    // Get the updated block variables
    const variables = block.variables.reduce((acc, variable) => {
      // Return a dictionary with the variable name and value {name: value}
      acc[variable.id] = variable.value;
      return acc;
    }, {});

    // Get the updated inputs from the connected blocks
    let inputs: { [key: string]: any } = {};
    block.variableConnections.forEach((connection) => {
      const fromBlock = connection.origin.placedID;
      const fromRealBlock = this.placedBlocks.find(
        (b) => b.placedID === fromBlock
      );

      // Set the variable for this block
      // to the output from the connected block
      try {
        if (fromRealBlock.finishedExecution) {
          inputs[connection.destination.variableID] =
            fromRealBlock.storedOutputs[connection.origin.variableID];
          console.log(
            "Setting input: ",
            connection.destination.variableID,
            " to ",
            fromRealBlock.storedOutputs[connection.origin.variableID],
            "from placedID: ",
            fromRealBlock.placedID
          );
        }
      } catch (e) {
        alert("Error receiving inputs from block " + fromRealBlock.name);
      }
    });

    const body = JSON.stringify({
      blockID: block.id,
      variables: variables,
      path: this.flowPath,
      inputs: inputs,
      flowSavedID: this.flowSavedID,
      resetRemote: resetRemote,
      blockPlacedID: block.placedID,
    });

    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const response = await horusPost("/plugins/executeblock", headers, body);

    const data: ExecuteResponse = await response.json();

    // setCurrentExecuting(null);

    // Save the flow with the current executing block
    // await handleSave();

    return data;
  }

  private async executeInputs(
    realBlock: Block,
    vc: {
      origin: BlockVarPair;
      destination: BlockVarPair;
      isCyclic: boolean;
      cycles: number;
    }
  ) {
    const realOriginBlock = this.placedBlocks.find(
      (b) => b.placedID === vc.origin.placedID
    );
    if (
      !realOriginBlock.finishedExecution ||
      realOriginBlock.type === BlockTypes.INPUT
    ) {
      // If its cyclic, execute the first input. But when the block has been already executed, execute the second input.
      if (vc.isCyclic && !realBlock.finishedExecution) {
        return true;
      } else {
        // Execute the block
        return await this.executeBlock(realOriginBlock.placedID);
      }
    }
    return true;
  }

  public async executeBlock(placedID: number, resetRemote: boolean = false) {
    // this.setExecutingAll(true);

    // IF stopExecute is true, stop the execution
    if (this.stopExecute) {
      this.setCurrentExecuting(null);
      // this.setExecutingAll(false);
      return false;
    }

    // Find the actual block in the placedBlocks array
    const realBlock: Block = this.placedBlocks.find(
      (b) => b.placedID === placedID
    );

    // If the block is connected to input variables,
    // execute the connected blocks first
    for (var i = 0; i < realBlock.variableConnections.length; i++) {
      const vc = realBlock.variableConnections[i];
      const result = await this.executeInputs(realBlock, vc);
      if (!result) return result;
    }

    // Execute the block
    let result = await this.executeBlockServer(realBlock, resetRemote);

    let newBlock: Block = {
      ...realBlock,
      finishedExecution: true,
      storedOutputs: result.outputs,
      runError: !result.ok,
    };

    // If the block was a remote block, update the state
    // if its the first time executing it

    if (realBlock.type === "slurm" && resetRemote) {
      newBlock = {
        ...newBlock,
        finishedExecution: false,
        isRunning: true,
      };
      this.setCurrentExecuting(newBlock.placedID);
    }

    // Update the placedBlocks array
    this.placedBlocks = this.placedBlocks.map((b) => {
      if (b.placedID === placedID) {
        return newBlock;
      } else {
        return b;
      }
    });

    // Update the state
    this.setPlacedBlocks(this.placedBlocks);

    // Stop the execution if there was an error
    if (!result.ok) {
      alert("Error executing block '" + newBlock.name + "': " + result.error);
      this.setCurrentExecuting(null);
      this.setExecutingAll(false);
      return false;
    }

    // If the block is a remote block, exit
    if (realBlock.type === "slurm" && resetRemote) {
      this.setExecutingAll(true);
      this.setCurrentExecuting(newBlock.placedID);
      // this.handleSave();
      return true;
    }

    this.setCurrentExecuting(null);

    // Execute the connected block to the output
    if (
      realBlock.variableConnectionsReference &&
      realBlock.variableConnectionsReference.length > 0 &&
      realBlock.type !== "input"
    ) {
      for (const varConnection of realBlock.variableConnectionsReference) {
        const result = await this.executeBlock(
          varConnection.destination.placedID,
          true
        );
        if (!result) {
          return false;
        }
      }
    }

    // Execute the regular connected blocks (does not do nothing because blocks only can be connected
    // via variables)
    if (realBlock.connectedTo && realBlock.connectedTo.length > 0) {
      for (const connected of realBlock.connectedTo) {
        const result = await this.executeBlock(connected, true);
        if (!result) {
          return false;
        }
      }
    }

    this.setExecutingAll(false);

    return true;
  }

  public async checkRemoteBlock(block: Block) {
    const header = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const body = JSON.stringify({
      flowSavedID: this.flowSavedID,
      blockPlacedID: block.placedID,
    });

    const response = await horusPost("/plugins/checkRemoteBlock", header, body);

    const data = await response.json();

    if (!data.ok) {
      alert("Error checking remote block: " + data.error);
      this.stopExecute = true;
    }

    const status = data.status || "UNKNOWN";

    if (status.includes("COMPLETED") && !this.stopExecute) {
      // Continue executing the block
      this.executeBlock(block.placedID);
    }

    if (
      status.includes("FAILED") ||
      status.includes("CANCELLED") ||
      this.stopExecute
    ) {
      // Update the block state
      const newBlock: Block = {
        ...block,
        finishedExecution: true,
        runError: true,
        isRunning: false,
      };

      // Update the placedBlocks array
      this.placedBlocks = this.placedBlocks.map((b) => {
        if (b.placedID === block.placedID) {
          return newBlock;
        } else {
          return b;
        }
      });

      this.setCurrentExecuting(null);

      // Update the state
      this.setPlacedBlocks(this.placedBlocks);

      this.setExecutingAll(false);

      // Save
      // this.handleSave();
    }
  }
}
