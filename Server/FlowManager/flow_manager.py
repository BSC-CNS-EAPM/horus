"""
Flow manager
"""

# Basic imports
import os
import sys
import json
import typing
import uuid
import datetime
import logging
import multiprocessing
import time
import zipfile
import warnings

# Enum for the flow status
from enum import Enum

# Blocks from Horus
from HorusAPI import PluginBlock as Block, SlurmBlock

# The plugin manager
from Server.PluginManager import PluginManager, PrintCapturer

# The remote manager
from Server.RemotesManager import RemotesManager

# Import the settings manager
from Server.SettingsManager import SettingsManager

# Internal, development types
if typing.TYPE_CHECKING:
    from HorusAPI.src.plugins import BlockConnection  # pylint: disable=ungrouped-imports
    from Server.server import HorusSocket


class LoopException(Exception):
    """
    Custom loop exception
    """


class BlocksException(Exception):
    """
    Custom blocks exception
    """

    block: Block
    """
    The block that originated the exception
    """

    def __init__(self, block: Block, message: str):
        """
        An exception that is raised when a block is not valid.

        - block: The block that originated the exception
        - message: The error message
        """
        super().__init__(message)
        self.block = block


class ErrorRunningBlock(BlocksException):
    """
    Custom error running block exception
    """


class SlurmBlockException(BlocksException):
    """
    Tells the flow runner to stop the execution of the flow to wait for the slurm job to finish
    """


class StoppedFlowException(BlocksException):
    """
    Stops the flow from executing
    """

    message: str = (
        "The flow was stopped gracefully. "
        "Once the current block finishes executing, "
        "the flow will stop."
    )

    def __init__(self, block: Block):
        super().__init__(block, self.message)


# Define a overwrite exception for the saveFlow method
class OverwriteException(Exception):
    """
    Custom overwrite exception
    """

    def __init__(self, name: str, path: str, message: str):
        """
        An exception that is raised when trying to overwrite a file.

        - name: The name of the file (without extension)
        - path: The path to the file (with extension)
        - message: The error message
        """
        super().__init__(message)
        self.name = name
        self.path = path


class Flow:
    """
    The flow class stores the information about a flow
    - Saves and encodes the flow
    """

    name: str
    """
    The name of the flow
    """

    blocks: typing.List[Block]
    """
    The blocks of the flow
    """

    savedID: str
    """
    The savedID of the flow
    """

    path: str
    """
    The path to the flow
    """

    remote: str
    """
    The remote name where the flow is connected
    """

    currentExecuting: typing.Optional[int]
    """
    The current executing block (PlacedID)
    """

    date: str
    """
    The date the flow was last saved as a string (YYYY-MM-DD HH:MM:SS)
    """

    # WARNING: Properties added here may be updated by the blocks during their actions.
    # Please if you add any property here, make sure to update the PluginDeps.subprocessBlock
    # classmethod to include the new property in the subprocess block

    terminalOutput: typing.List[str]
    """
    The terminal output produced by the flow
    """

    pendingActions: typing.List[typing.Dict[str, typing.Any]] = []
    """
    A list of pending actions to be sent to the frontend when the flow is opened

    For example, any MolstarAPI action that needs to be executed on JS side
    """

    FLOW_FILE: str = "flow.json"
    MOLSTAR_STATE_FILE: str = "molstarState.molx"

    class FlowStatus(Enum):
        """
        The status of the flow
        """

        RUNNING = "RUNNING"
        """
        The flow is running
        """

        PAUSED = "PAUSED"
        """
        The flow is paused
        """

        FINISHED = "FINISHED"
        """
        The flow finished executing
        """

        ERROR = "ERROR"
        """
        The flow encountered an error
        """

        IDLE = "IDLE"
        """
        The flow is idle
        """

        STOPPED = "STOPPED"
        """
        The flow was stopped
        """

        def __str__(self):
            return self.value

        def __repr__(self):
            return self.value

        def __eq__(self, other):
            if isinstance(other, str):
                return self.value == other
            if isinstance(other, Flow.FlowStatus):
                return self.value == other.value
            return False

    status: FlowStatus = FlowStatus.IDLE
    """
    The status of the flow
    """

    @property
    def dateAsInt(self):
        """
        The date the flow was last saved as an integer
        """

        return int(datetime.datetime.strptime(self.date, "%Y-%m-%d %H:%M:%S").timestamp())

    def __init__(self, flow: typing.Dict[str, typing.Any]) -> None:
        """
        Create a flow instance

        :param flow: The flow to create
        """

        # Set the flow properties
        self.name = flow.get("name", "Unnamed flow")
        self.savedID = flow.get("savedID", None)
        self.path = flow.get("path", None)
        self.remote = flow.get("remote", None)
        self.currentExecuting = flow.get("currentExecuting", None)
        self.date = flow.get("date", None)
        self.terminalOutput = flow.get("terminalOutput", [])
        self.pendingActions = flow.get("pendingActions", [])

        # Set the flow status
        status = flow.get("status", "IDLE")
        self.status = self.FlowStatus(status)

        # Parse the blocks
        blocksJSON = flow.get("blocks", [])
        self.blocks = self.parseBlocks(blocksJSON)

    def parseBlocks(
        self, blocksJSON: typing.List[typing.Dict[str, typing.Any]]
    ) -> typing.List[Block]:
        """
        Parses the blocks from a JSON object

        :param blocksJSON: The blocks to parse
        """

        blocks: typing.List[Block] = []

        for block in blocksJSON:
            # Get the block ID
            blockID = block.get("id", None)

            if blockID is None:
                raise Exception(  # pylint: disable=broad-exception-raised
                    "Corrupted flow. A block does not have an ID."
                )

            # Get the block class
            blockClass = PluginManager().findBlock(blockID)

            # Create a copy of the block, so we don't modify the original
            newCopyBlockClass = blockClass.copy()
            # newCopyBlockClass = blockClass

            # Parse the internal variables
            newCopyBlockClass._parseInternalVariables(  # pylint: disable=protected-access # noqa: E501
                block
            )  # pylint: disable=protected-access

            # Add the block to the list
            blocks.append(newCopyBlockClass)

        def checkConnection(block: Block, conn: int):
            found = False
            for otherBlock in blocks:
                if otherBlock._placedID == conn:  # pylint: disable=protected-access
                    found = True
                    break
            if not found:
                raise Exception(  # pylint: disable=broad-exception-raised
                    f"Corrupted flow. '{block.name}' is connected " + "to a non-existing block."
                )

        # Check that the blocks are connected to existing blocks
        for block in blocks:
            for conn in block._connectedTo:  # pylint: disable=protected-access
                checkConnection(block, conn)

            for connRef in block._connectedToReferences:  # pylint: disable=protected-access
                checkConnection(block, connRef)

        def checkVarConnection(var):
            found = False
            originVarID = var.origin.variableID
            originBlockID = var.origin.blockPlacedID
            # The origin block must exist with a variable with the same ID
            for otherBlock in blocks:
                if (
                    otherBlock._placedID == originBlockID  # pylint: disable=protected-access
                    and originVarID in otherBlock.outputs.keys()
                ):
                    found = True
                    break

            if not found:
                raise Exception(  # pylint: disable=broad-exception-raised
                    "Corrupted flow. A variable origin is not valid."
                    + f"Variable ID '{originVarID}' of block '{var.origin.blockID}'"
                    + "has changed."
                )

            found = False
            destinationVarID = var.destination.variableID
            destinationBlockID = var.destination.blockPlacedID
            for otherBlock in blocks:
                # The origin block must exist with a variable with the same ID
                if (
                    otherBlock._placedID == destinationBlockID  # pylint: disable=protected-access
                    and destinationVarID in otherBlock.inputs.keys()
                ):
                    found = True
                    break

            if not found:
                raise Exception(  # pylint: disable=broad-exception-raised
                    "Corrupted flow. Variable destination is not valid. "
                    + f"Variable ID '{destinationVarID}' of block "
                    + f"'{var.destination.blockID}' has changed."
                )

        # Verify that variables are connected to existing variables
        for block in blocks:
            for var in block._variableConnections:  # pylint: disable=protected-access
                checkVarConnection(var)
            # Do the same for the references
            for (
                refVar
            ) in block._variableConnectionsReferences:  # pylint: disable=protected-access
                checkVarConnection(refVar)

        for block in blocks:
            # If the flow is not running but any block is running, set the block as not running
            if block._isRunning and not self.isActive:
                logging.getLogger("Horus").warning(
                    "The block '%s' with placedID %s was running but the flow is not. "
                    + "Setting the block as not running.",
                    block.name,
                    block._placedID,
                )

                block._isRunning = False
                block._finishedExecution = True

        return blocks

    def encode(self, minimal: bool = True) -> typing.Dict[str, typing.Any]:
        """
        Encodes the flow to a JSON object
        """

        logging.getLogger("Horus").debug("Encoding flow '%s'", self.name)

        # Encode the blocks
        blocksJSON = []
        for block in self.blocks:
            # Encode the block to a JSON object
            encodedBlock = (
                block._minimalEncode()  # pylint: disable=protected-access
                if minimal
                else block._toDict()  # pylint: disable=protected-access
            )

            blocksJSON.append(encodedBlock)

        # Create a JSON object
        flow = {
            "name": self.name,
            "savedID": self.savedID,
            "path": self.path,
            "remote": self.remote,
            "currentExecuting": self.currentExecuting,
            "status": self.status.value,
            "date": self.date,
            "blocks": blocksJSON,
            "terminalOutput": self.terminalOutput,
            "pendingActions": self.pendingActions,
        }

        return flow

    def write(self) -> typing.Dict[str, typing.Any]:
        """
        Writes the flow to the file

        :returns: The encoded flow
        """

        # Encode the flow
        encodedFlow = self.encode()

        # Get the current molstar state, if any
        molstarStateBytes = self.getMolstarState()

        # Remove the current file
        if os.path.exists(self.path):
            os.remove(self.path)

        logging.getLogger("Horus").debug("Writing flow '%s'", self.name)

        with zipfile.ZipFile(self.path, "w", zipfile.ZIP_DEFLATED) as zipFile:
            zipFile.writestr(self.FLOW_FILE, json.dumps(encodedFlow, indent=4))

        # Store again the molstar state
        if molstarStateBytes is not None:
            self.saveMolstarState(molstarStateBytes)

        # Return the encoded flow in case its needed
        return encodedFlow

    @classmethod
    def read(cls, path: str) -> "Flow":
        """
        Reads a flow from a file
        """

        # Read the flow with the new zipped version
        try:
            with zipfile.ZipFile(path, "r") as zipFile:
                with zipFile.open(cls.FLOW_FILE) as file:
                    flow = json.load(file)
        except Exception:
            # Read the old version
            with open(path, "r", encoding="utf-8") as file:
                flow = json.load(file)

        flow = Flow(flow)
        flow.path = path

        return flow

    def saveMolstarState(self, molstarState: bytes):
        """
        Saves the molstar state molx file into the flow zip
        """

        # Use the warning context manager to supress the duplication warning
        # as the duplicated molstarState will be automatically removed when
        # the flow is saved again
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            with zipfile.ZipFile(self.path, "a", zipfile.ZIP_DEFLATED) as zipFile:
                zipFile.writestr(self.MOLSTAR_STATE_FILE, molstarState)

    def getMolstarState(self) -> typing.Optional[bytes]:
        """
        Gets the molstar state molx file from the flow zip
        """

        try:
            with zipfile.ZipFile(self.path, "r") as zipFile:
                with zipFile.open(self.MOLSTAR_STATE_FILE) as file:
                    return file.read()
        except Exception:
            return None

    @property
    def isActive(self):
        """
        Returns whether the flow is active or not in any form.
        For example, if its PAUSED, or RUNNING, will return True.
        If FINISHED, ERROR, IDLE, STOPPED, will return False.
        """

        return self.status in [self.FlowStatus.PAUSED, self.FlowStatus.RUNNING]

    def __eq__(self, other):
        if isinstance(other, Flow):
            return self.savedID == other.savedID
        return False

    def __str__(self):
        return json.dumps(self.encode(minimal=False), indent=4)

    def findBlockByID(self, blockID: str) -> Block:
        """
        Finds a block by its ID
        """

        for block in self.blocks:
            if block.id == blockID:
                return block

        raise Exception(  # pylint: disable=broad-exception-raised
            f"Block with ID '{blockID}' not found."
        )

    def findBlockByPlacedID(self, placedID: int) -> Block:
        """
        Finds a block by its placedID
        """

        for block in self.blocks:
            if block._placedID == placedID:
                return block

        raise Exception(  # pylint: disable=broad-exception-raised
            f"Block with placedID '{placedID}' not found."
        )

    _socket: typing.Optional["HorusSocket"] = None
    _pluginManager: typing.Optional[PluginManager] = None

    def _runPreviousBlocks(
        self, placedID: int, resetRemoteBlock: bool = False, comesFromCyclic: bool = False
    ):
        """
        Executes iteratively the blocks of the flow
        """

        # Check for the plugin manager instance.
        # If it doesn't exist, we cannot execute the blocks
        if self._pluginManager is None:
            raise Exception(  # pylint: disable=broad-exception-raised
                "The plugin manager is not instantiated."
            )

        # Find the block to run by its placedID in the flow
        blockToRun = self.findBlockByPlacedID(placedID)

        # Add the flow to the block
        blockToRun.flow = self

        # If the flow is stopped, raise an exception
        if self.status == self.FlowStatus.STOPPED:
            blockToRun._runError = True
            blockToRun._runErrorMessage = "The flow was stopped gracefully."
            blockToRun._isRunning = False
            blockToRun._finishedExecution = True
            self.currentExecuting = None

            raise StoppedFlowException(blockToRun)

        # If the block is already executed, return its outputs.
        # Except for when we are ressetting the flow run
        if (
            blockToRun._finishedExecution and not resetRemoteBlock and not blockToRun._runError
        ):  # and not comesFromCyclic
            return blockToRun._storedOutputs

        # Execute the regular inputs before the cyclic ones
        # This is to avoid cyclic connections to be executed before the regular ones
        runOrder: typing.List["BlockConnection"] = []
        for previousConnection in blockToRun._variableConnections:
            if previousConnection.isCyclic:
                runOrder.append(previousConnection)
            else:
                runOrder.insert(0, previousConnection)

        # If the block has input connections, execute first those blocks
        inputs = {}
        for connection in runOrder:
            # Find the block that is connected to a variable of the block selected to run
            variableBlock = self.findBlockByPlacedID(connection.origin.blockPlacedID)

            # Get the placedID of the block that provides such variable
            variablePlacedID = variableBlock._placedID

            # Placed blocks always have a placedID > 0
            if variablePlacedID is None or variablePlacedID == 0:
                raise Exception(  # pylint: disable=broad-exception-raised
                    "The block does not have a valid placedID"
                )

            # If its a cyclic connection, verify that the non-cyclic block has been executed
            if connection.isCyclic and comesFromCyclic:
                # Increment the current cycle of the connection
                connection.currentCycle += 1

                if connection.currentCycle > connection.cycles:
                    raise BlocksException(
                        blockToRun, "Exceded the maximum number of cycles for this connection."
                    )

                # blockToRun._runError = True
                # blockToRun._runErrorMessage = "Cyclic connection detected"
                # blockToRun._isRunning = False
                # blockToRun._finishedExecution = True
                # self.currentExecuting = None
                # raise Exception(  # pylint: disable=broad-exception-raised
                #     "Cyclic connection detected"
                # )

            if connection.isCyclic and not comesFromCyclic:
                continue

            if not connection.isCyclic and comesFromCyclic:
                continue

            # Execute the block that provides the variable by calling recursively this method
            # This ensures that if the variable is provided by another block that also requires
            # an input variable, the blocks will be executed in the correct order
            outputs = self._runPreviousBlocks(variablePlacedID, resetRemoteBlock, comesFromCyclic)

            # If we have connected a variable to an input, the outputs should exist
            # This is only for the whole outputs dictionary itself, as the inidvidual
            # variable values can be None
            if outputs is None:
                raise Exception(  # pylint: disable=broad-exception-raised
                    "A connected variable block produced no outputs"
                )

            # Update the inputs dictionary with the outputs of the block
            # Setting the correct keys for each block
            try:
                inputs[connection.destination.variableID] = outputs[connection.origin.variableID]
            except KeyError:
                raise BlocksException(
                    blockToRun,
                    f"The block '{variableBlock.name}' does not provide the variable "
                    + f"'{connection.origin.variableID}' to the block '{blockToRun.name}'. "
                    + "Did you forget to call setOutput() in the action of the block?",
                )

        # With the generated inputs, update the block to run
        blockToRun._updateInputs(inputs)

        # Set the block and flow state
        blockToRun._isRunning = True
        self.currentExecuting = blockToRun._placedID

        # Save the flow
        self.write()

        # Send the flow to the frontend because the block is going to be run
        if self._socket is not None:
            self._socket.emit("flow", self.encode(minimal=False), to=self.savedID)

        # Execute the block by calling the plugin manager
        # Calling the PM is a must because it handles
        # the dependencies for each block
        try:
            outputs = self._pluginManager.executeBlock(
                blockToRun,
                self.savedID,
                resetRemoteBlock=resetRemoteBlock,
            )
        except Exception as exc:  # pylint: disable=broad-exception-raised
            # If an error was raised during the execution of the block
            # update acordingly the block's state
            blockToRun._runError = True
            blockToRun._runErrorMessage = str(exc)
            blockToRun._isRunning = False
            blockToRun._finishedExecution = True
            self.currentExecuting = None

            # Raise again a special "ErrorRunningBlock" exception
            raise ErrorRunningBlock(blockToRun, str(exc)) from exc

        # Save the flow
        self.write()

        # Send the flow to the frontend if a socket is provided
        if self._socket is not None:
            self._socket.emit("flow", self.encode(minimal=False), to=self.savedID)

        # If a slurm block was run, check if we need to wait for the job to finish
        # That means that the action executed was the block's firstAction. When the job with
        # finishes, the block will be executed again with the secondAction. If _waitingForJob
        # is True, the flow execution wait until the job finishes. If its false, it means
        # that the finalAction was executed and that the flow can continue executing
        if isinstance(blockToRun, SlurmBlock):
            # Call the parsestatus method to update the block's status
            blockToRun.parseStatus()

            self.write()

            # Update the fronted with the block's state
            if self._socket is not None:
                self._socket.emit("flow", self.encode(minimal=False), to=self.savedID)

            # Wait for the job to finish
            try:
                currentStatus = blockToRun._status
                while blockToRun.isWaitingForJob:
                    waitTime = int(SettingsManager().getSetting("queueWaitTime").value)
                    time.sleep(waitTime)

                    # If the block's status changed, store the flow
                    if blockToRun._status != currentStatus:
                        currentStatus = blockToRun._status
                        self.write()

                    # Update the fronted with the block's state
                    if self._socket is not None:
                        self._socket.emit("flow", self.encode(minimal=False), to=self.savedID)

            except Exception as exc:  # pylint: disable=broad-exception-raised
                blockToRun._runError = True
                blockToRun._runErrorMessage = str(exc)
                blockToRun._isRunning = False
                blockToRun._finishedExecution = True
                self.currentExecuting = None

                # Raise again a special "ErrorRunningBlock" exception
                raise ErrorRunningBlock(blockToRun, str(exc)) from exc

            if blockToRun._status != SlurmBlock.Status.COMPLETED:
                blockToRun._runError = True
                blockToRun._runErrorMessage = (
                    f"Slurm job failed. Status: {blockToRun._status.value}"
                )
                blockToRun._isRunning = False
                blockToRun._finishedExecution = True
                self.currentExecuting = None
                raise ErrorRunningBlock(blockToRun, blockToRun._runErrorMessage)

            # Once the block has been executed, call again the execution
            # of this block to execute the finalAction
            try:
                outputs = self._pluginManager.executeBlock(
                    blockToRun, self.savedID, resetRemoteBlock=False, isFirstSlurm=False
                )
            except Exception as exc:  # pylint: disable=broad-exception-raised
                # If an error was raised during the execution of the block
                # update acordingly the block's state
                blockToRun._runError = True
                blockToRun._runErrorMessage = str(exc)
                blockToRun._isRunning = False
                blockToRun._finishedExecution = True
                self.currentExecuting = None

                # Raise again a special "ErrorRunningBlock" exception
                raise ErrorRunningBlock(blockToRun, str(exc)) from exc

        # Block endend executing, thus update the state
        blockToRun._isRunning = False
        blockToRun._finishedExecution = True
        self.currentExecuting = None

        # Save the flow
        self.write()

        # Send the flow to the frontend if a socket is provided
        if self._socket is not None:
            self._socket.emit("flow", self.encode(minimal=False), to=self.savedID)

        # Return the produced outputs of the block
        return outputs

    def _runNextBlocks(self, placedID: int, resetRemoteBlock: bool = False):
        if self._pluginManager is None:
            raise Exception(  # pylint: disable=broad-exception-raised
                "The plugin manager is not instantiated."
            )

        blockToRun = self.findBlockByPlacedID(placedID)

        # Find first the cyclic connections to run them first
        runOrder: typing.List["BlockConnection"] = []
        for nextConnection in blockToRun._variableConnectionsReferences:
            # Find the variableConnection that matches the reference
            destinationBlock = self.findBlockByPlacedID(nextConnection.destination.blockPlacedID)

            # Find the variableConnection that matches the reference
            realConnection: typing.Optional["BlockConnection"] = None
            for destConn in destinationBlock._variableConnections:
                if (
                    destConn.destination.variableID == nextConnection.destination.variableID
                    and destConn.origin.blockPlacedID == placedID
                ):
                    realConnection = destConn
                    break

            if realConnection is None:
                raise BlocksException(blockToRun, "The reference of a variable is not valid.")

            if realConnection.isCyclic:
                runOrder.insert(0, realConnection)
            else:
                runOrder.append(realConnection)

        _currentCycle = 0
        for nextConnection in runOrder:
            nextBlock = self.findBlockByPlacedID(nextConnection.destination.blockPlacedID)

            nextPlacedID = nextBlock._placedID

            if nextPlacedID is None or nextPlacedID == 0:
                raise Exception(  # pylint: disable=broad-exception-raised
                    "The block does not have a valid placedID"
                )

            # If the connection is cyclic, run the cyclic blocks
            if nextConnection.isCyclic:
                # If the cycles are completed, exit the function
                if nextConnection.currentCycle >= nextConnection.cycles:
                    return

                # Because we are going to run the next block,
                # we need to reset it to re-compute the outputs
                # instead of using the cached ones
                nextBlock._cleanRun(cleanCycles=False)

                # Store the current cycle outside the for loop to keep track when
                # to run the next blocks
                _currentCycle = nextConnection.currentCycle

                # Run the previous blocks of the block and the
                # block itself to which the variable is connected
                self._runPreviousBlocks(nextPlacedID, resetRemoteBlock, comesFromCyclic=True)
            else:
                # Check if the current block has any cyclic connections
                # If it has, make sure that the cyclic connections have been executed
                # before starting to execute the next blocks. This is to avoid
                # executing the following multiple times the next blocks each time a
                # cycle is done
                for conn in runOrder:
                    if conn.isCyclic and _currentCycle != 0:
                        return

                nextBlock._cleanRun(cleanCycles=False)

                self._runPreviousBlocks(nextPlacedID, resetRemoteBlock)

            self._runNextBlocks(nextPlacedID, resetRemoteBlock)

    def run(
        self,
        placedID: typing.Optional[int] = None,
        resetRemoteBlock: bool = False,
        socket: typing.Optional["HorusSocket"] = None,
        resetFlow: bool = True,
    ):
        """
        Run the flow starting from a specific block

        :param placedID: The placedID of the block to start the execution from.
        If None provided, the flow will be resumed from the latest executed block.
        :param resetRemoteBlock: If True, the Slurm block will be resetted.
        :param socket: The socket instance to send the flow to the frontend.
        If None, no updates will be sent (intended for command line execution)
        """

        if placedID is None and self.currentExecuting is not None:
            # If this method was called without a placedID,
            # resume the flow execution from the latest executed block
            placedID = self.currentExecuting
        elif resetFlow:
            # Set all blocks as not executed because a new run is starting
            for block in self.blocks:
                block._cleanRun()

            # Clear the terminal output
            self.terminalOutput = []

            # Clean the pending actions
            self.pendingActions = []

        if placedID is None:

            # Stop the flow
            self.stop("No block to start the execution from.", fail=True)

            raise Exception(  # pylint: disable=broad-exception-raised
                "No placedID was provided for the run of the flow. "
                + "The flow cannot be resumed as no current executing block is set for this flow."
            )

        # Reset just the block that is going to be executed
        # only if the self.currentExecuting is None
        # When the flow is being resumed, the currentExecuting
        # is not None, so we don't want to reset
        # the block. For example, a paused SlurmBlock
        # should not be resetted, as the status of the job
        # would be lost
        if self.currentExecuting is None:
            self.findBlockByPlacedID(placedID)._cleanRun()

        # Assign the socket instance
        self._socket = socket

        # Assign the plugin manager instance
        self._pluginManager = PluginManager()

        # Update the working dir
        oldWD = os.getcwd()
        os.chdir(os.path.dirname(self.path))

        # Set the flow status to running
        self.status = self.FlowStatus.RUNNING

        # Send the flow to the frontend if a socket is provided
        if self._socket is not None:
            self._socket.emit("flow", self.encode(minimal=False), to=self.savedID)

        # Update the MolstarAPI with the current flow
        # Because the flows are running in separate processes,
        # the main instance of the MolstarAPI is not affected
        from HorusAPI import MolstarAPI

        molAPI = MolstarAPI()

        molAPI._flow = self

        # Update the ExtensionsAPI with the current flow
        from HorusAPI import Extensions

        extAPI = Extensions()

        extAPI._flow = self

        # Run the blocks
        with self.TerminalOutputUpdater(self.terminalOutput, self.savedID, socket):
            try:
                self._runPreviousBlocks(placedID, resetRemoteBlock)
                self._runNextBlocks(placedID)
                self.status = self.FlowStatus.FINISHED
            except ErrorRunningBlock as errorBlock:
                print(f"Error running block {errorBlock.block.name}: {errorBlock}")
                self.status = self.FlowStatus.ERROR
            except StoppedFlowException as stopped:
                print(stopped.message)
                self.status = self.FlowStatus.STOPPED
            except Exception:  # pylint: disable=broad-exception-raised
                import traceback

                traceback.print_exc()
                self.status = self.FlowStatus.ERROR
            finally:
                # Save the flow
                self.write()

        # Send the flow to the frontend if a socket is provided
        if self._socket is not None:
            self._socket.emit("flow", self.encode(minimal=False), to=self.savedID)

        # Restore the working dir
        os.chdir(oldWD)

    def stop(self, message: str = "The flow was stopped.", fail: bool = False):
        """
        Stops the flow from executing
        """

        # If the current executing block is a Slurm block, cancel the job
        if self.currentExecuting:
            block = self.findBlockByPlacedID(self.currentExecuting)
            if isinstance(block, SlurmBlock):
                try:
                    # Get the cluster api from the app delegate
                    from App import AppDelegate  # pylint: disable=import-outside-toplevel

                    remoteManager = RemotesManager(AppDelegate().appSupportDir)

                    remoteManager.connectRemote(block.selectedRemote)

                    rAPI = remoteManager.remote

                    if rAPI is None:
                        raise Exception(
                            "No cluster selected."
                        )  #  pylint: disable=broad-exception-raised

                    rAPI.cancelJobs(self.savedID)
                except Exception as exc:
                    print(f"Error cancelling job: {exc}")

        # Set the status to stopped
        self.status = self.FlowStatus.ERROR if fail else self.FlowStatus.STOPPED

        # Reset the current executing block
        self.currentExecuting = None

        # Reset the block's statuses
        for block in self.blocks:
            if block._isRunning:
                block._isRunning = False
                block._finishedExecution = True
                block._runError = True
                block._runErrorMessage = message
                block._finishedExecution = True

        # Save the flow
        self.write()

    class TerminalOutputUpdater(PrintCapturer):
        """
        Subclasses the PrintCapturer class to update the terminal output of the flow

        When no socket is provided to the run method, this class is used to update the terminal
        output of the flow.
        """

        terminalOutput: typing.List[str]
        """
        The terminal output of the flow
        """

        socket: typing.Optional["HorusSocket"]
        """
        If provided, the socket to send the text to
        """

        savedID: str
        """
        The savedID of the flow
        """

        def __init__(
            self,
            terminalOutput: typing.List[str],
            savedID: str,
            socket: typing.Optional["HorusSocket"] = None,
        ):
            super().__init__()

            self.terminalOutput = terminalOutput
            self.savedID = savedID
            self.socket = socket

        def write(self, message: str):
            """
            Writes the text to the terminal output
            """

            if self.socket is not None:
                self.socket.emit("printTerm", message, to=self.savedID)

            self.terminalOutput.append(message)
            super().write(message)


class FlowManager:
    """
    Manages the flow creation, saving, retrieving, etc.
    """

    appSupportDir: str
    """
    The path to the AppSupport directory.
    """

    _recentFlowsPath: str
    """
    The path to the recent flows file.

    Internal use only.
    """

    recentFlows: typing.List[Flow] = []
    """
    The list of recent flows.

    Internal use only.
    """

    @property
    def areThereRunningFlows(self):
        """
        Whether there are running flows or not
        """
        return len(self._flowProcesses) > 0

    def __init__(
        self,
        appSupportDir: str,
    ) -> None:
        # Assign the app support dir and the recent flows path
        self.appSupportDir = appSupportDir
        self._recentFlowsPath = os.path.join(appSupportDir, "recent_flows.json")

        # Read the recent flows file
        self.readRecentsFlows()

    def _recentsWriter(self):
        """
        Writes the recent flows to the file

        :param recentFlows: The recent flows to write
        """

        # Parse the recent flows
        recentFlowsJSON = {}
        for flow in self.recentFlows:
            recentFlowsJSON[flow.savedID] = flow.path

        # Write the recent flows list to the file
        with open(self._recentFlowsPath, "w", encoding="utf-8") as file:
            json.dump(recentFlowsJSON, file)

    def _updateRecentFlows(self):
        """
        Updates the recent flows file and removes non-existing flows
        """
        # Read the recent flows file
        with open(self.recentFlowsPath, "r", encoding="utf-8") as file:
            recentFlows = json.load(file)

        updatedRecentFlows = {}
        for flow in recentFlows:
            path = recentFlows[flow]
            if os.path.exists(path):
                updatedRecentFlows[flow] = recentFlows[flow]
            else:
                logging.getLogger("Horus").info("Removing non-existing flow '%s'", path)

        with open(self._recentFlowsPath, "w", encoding="utf-8") as file:
            json.dump(updatedRecentFlows, file)

        return updatedRecentFlows

    def readRecentsFlows(self):
        """
        Reads the recent flows from the file
        """

        # Remove non-existing flows
        recentFlows = self._updateRecentFlows()

        recentFlowsList = []
        # Parse the flows
        for _, path in recentFlows.items():
            try:
                instaceFlow = Flow.read(path)
                recentFlowsList.append(instaceFlow)
            except Exception as exc:
                logging.getLogger("Horus").error(
                    "Error reading recent flow '%s': %s", path, str(exc)
                )

        self.recentFlows = recentFlowsList

    @property
    def recentFlowsPath(self):
        """
        Returns the path to the recent flows file
        """

        if not os.path.exists(self._recentFlowsPath):
            self._recentsWriter()

        return self._recentFlowsPath

    def listRecentFlows(self) -> typing.List[Flow]:
        """
        Returns the list of recent flows
        """

        # Read the recent flows file
        self.readRecentsFlows()

        return self.recentFlows

    def _addToRecentFlows(self, flow: Flow):
        """
        Adds a given flow to the recent flows list

        :param flow: The flow to add
        """

        # If the flow is a default flow, don't add it to the recent flows list
        if self.appSupportDir in flow.path:
            return

        # Add the flow to the recent flows list
        savedID = flow.savedID

        if savedID is None:
            raise Exception(  # pylint: disable=broad-exception-raised
                "The flow does not have a savedID"
            )

        # Check if a flow with the same path already exists
        for (
            loadedFlow
        ) in self.recentFlows.copy():  # Copy to avoid modifying the list while iterating
            if loadedFlow.path == flow.path:
                # Remove the flow
                self.recentFlows.remove(loadedFlow)
                break

        # Update/create the recent flow
        self.recentFlows.append(flow)

        # Remove the oldest flow if the list is longer than 10
        while len(self.recentFlows) > 10:
            oldestFlow = self.recentFlows[0]
            for savedFlow in self.recentFlows:
                if savedFlow.dateAsInt < oldestFlow.dateAsInt:
                    oldestFlow = savedFlow

            logging.getLogger("Horus").debug("Removing oldest flow '%s'", oldestFlow.name)
            self.recentFlows.remove(oldestFlow)

        # Write the recent flows list to the file
        self._recentsWriter()

    def openRecentFlow(self, savedID: str):
        """
        Opens a recent flow

        :param savedID: The savedID of the flow to open

        :returns: The opened flow as JSON object

        :raises Exception: If the savedID does not exist
        """

        # Get the recent flows list
        recentFlows = self.listRecentFlows()

        # Check if the savedID exists
        flow = None
        for savedFlow in recentFlows:
            if savedFlow.savedID == savedID:
                flow = savedFlow
                break

        if flow is None:
            raise Exception(  # pylint: disable=broad-exception-raised
                "The savedID does not exist"
            )

        return flow.encode()

    def cleanRecentFlows(self):
        """
        Cleans the recent flows list
        """

        # Write an empty recent flows list
        self.recentFlows = []
        self._recentsWriter()

    def _saveFlowInternal(
        self, flow: Flow, overwrite=False, molstarState: typing.Optional[bytes] = None
    ):
        """
        Saves a flow to a file. (overwrites if already exists)
        """
        flowPath = flow.path

        # Read the savedID from the file if it exists
        overwriteCaution = False
        if os.path.exists(flowPath) and not overwrite:
            try:
                savedFlow = Flow.read(flowPath)
                savedID = savedFlow.savedID
                if savedID != flow.savedID:
                    overwriteCaution = True
            except Exception:  # pylint: disable=broad-exception-caught
                overwriteCaution = True

        # Create a new savedID if it doesn't exist
        if not flow.savedID:
            flow.savedID = str(uuid.uuid4())

        # If we are overwriting a flow, check if the user wants to overwrite it
        from App import AppDelegate  # pylint: disable=import-outside-toplevel

        if overwriteCaution and not overwrite and AppDelegate().serverMode:
            raise OverwriteException(
                name=flow.name, path=flowPath, message="Trying to overwrite a flow."
            )

        # Set the date
        flow.date = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Save the flow (overwrite if already exists)
        if len(flow.blocks) == 0:
            raise Exception(
                "Trying to save empty flow. Please save flows that contain placed blocks."
            )
        else:
            flow.write()

        if molstarState is not None:
            flow.saveMolstarState(molstarState)

        # Add the flow to the recent flows list
        self._addToRecentFlows(flow)

        # Return the saved flow
        return flow

    def saveFlow(
        self,
        flow: typing.Dict[str, typing.Any],
        molstarState: typing.Optional[bytes] = None,
    ):
        """
        Saves the flow to a file.
        """

        overwrite = flow.get("overwrite", False)

        if not isinstance(overwrite, bool):
            raise Exception(  # pylint: disable=broad-exception-raised
                "The overwrite parameter must be a boolean."
            )

        # Init the flow instance
        flowInstance = Flow(flow)

        # Check if the flow has a path, if its a new flow,
        # and if we are not overwriting
        # to ask the user for a new path
        if not flowInstance.path and not flowInstance.savedID and not overwrite:
            from App import AppDelegate

            if AppDelegate().serverMode:
                overwrite = True
                flowInstance.path = os.path.join("flows", flowInstance.name + ".flow")
            else:  # On desktop mode, open the file picker
                filename = flowInstance.name + ".flow"
                flowPath = AppDelegate().saveFileSelectDialog(
                    filename, fileTypes=("Flow (*.flow)",)
                )

                # Check if the user selected a path
                if not flowPath:
                    raise Exception("No path selected.")  # pylint: disable=broad-exception-raised

                # Append the extension if not present
                if not flowPath.endswith(".flow"):
                    flowPath += ".flow"
                flowInstance.path = flowPath

        return self._saveFlowInternal(flowInstance, overwrite, molstarState)

    def openFlowFromPath(
        self, flowPath: str, socket: typing.Optional["HorusSocket"] = None
    ) -> Flow:
        """
        Opens a flow from a file.
        """

        # Always use the absolute path
        flowPath = os.path.abspath(flowPath)

        # Check that the file exists
        if not os.path.exists(flowPath):
            raise Exception(  # pylint: disable=broad-exception-raised
                "The flow file does not exist"
            )

        # Read the flow file
        flow = Flow.read(flowPath)

        # Add the flow to the recent flows list
        self._addToRecentFlows(flow)

        # If the flow was paused, resume it
        if flow.status == flow.FlowStatus.PAUSED:
            logging.getLogger("Horus").info("Resuming flow %s", flow.name)

            self.runFlow(flow, socket=socket)

        # If the flow is marked as running but its not present
        # in the running flows list, set the status to FAILED
        if flow.status == flow.FlowStatus.RUNNING and flow.path not in self._flowProcesses:
            flow.stop(message="The flow failed due an internal error.", fail=True)

            # Save the flow
            flow.write()

        # Return the flow
        return flow

    def openFlow(self, socket: typing.Optional["HorusSocket"] = None) -> Flow:
        """
        Opens the file select dialog to open a flow.
        """
        from App import AppDelegate

        if not AppDelegate().serverMode:
            flowPath = AppDelegate().openFileSelectDialog(
                allowMultiple=False, fileTypes=("Flow (*.flow)",)
            )

            if flowPath:
                if isinstance(flowPath, tuple):
                    flowPath = flowPath[0]
                return self.openFlowFromPath(str(flowPath), socket=socket)
            raise Exception("No path selected.")  # pylint: disable=broad-exception-raised
        else:
            # WIP implement server user folders
            raise Exception(  # pylint: disable=broad-exception-raised
                "Not implemented yet on server mode."
            )

    def loadPredefinedFlow(self, savedID: str):
        """
        Returns a predefined flow with the given savedID.
        """

        pluginFlows = PluginManager().listFlows()
        loadedFLow = None
        for pFlow in pluginFlows:
            if pFlow["savedID"] == savedID:
                loadedFLow = self.openFlowFromPath(pFlow["path"])
                break
        if not loadedFLow:
            raise Exception("Flow not found.")  # pylint: disable=broad-exception-raised

        # Replace the savedID and the flow path so
        # the forntend can save it to another location
        loadedFLow.savedID = None  # type: ignore
        loadedFLow.path = None  # type: ignore

        return loadedFLow

    _flowProcesses: typing.Dict[str, multiprocessing.Process] = {}
    """
    The active running flows. The key is the flow path and the value is the process.
    """

    def runFlow(
        self,
        flow: Flow,
        placedID: typing.Optional[int] = None,
        resetRemoteBlock: bool = False,
        socket: typing.Optional["HorusSocket"] = None,
        resetFlow: bool = True,
    ):
        """
        Tells the FlowManager to run a flow

        :param path: The path to the flow to run
        :param placedID: The placedID of the block to start the execution from.
        If None provided, the flow will be resumed from the latest executed block.
        :param resetRemoteBlock: If True, the Slurm block will be resetted.
        :param socket: The socket instance to send the flow to the frontend.
        """

        # Check that the flow is not already running
        for runningFlowPath in list(self._flowProcesses.keys()):
            # Load the running flow
            if runningFlowPath == flow.path:
                # Check if the process is alive
                process = self._flowProcesses[runningFlowPath]

                if process.is_alive():
                    raise Exception(  # pylint: disable=broad-exception-raised
                        "The flow is already running."
                    )
                else:
                    # Remove the flow from the running flows list
                    self._flowProcesses.pop(runningFlowPath)

        # Set the socket instance
        flow._socket = socket

        # Run the flow in a separate process
        def flowRun():
            try:
                logging.getLogger("Horus").info("Started flow %s", flow.name)

                # Run the flow
                flow.run(placedID, resetRemoteBlock, socket, resetFlow)

                # Send a request to the main server to remove the flow from the running flows list
                if socket is not None:
                    socket.removeFinishedFlowFromRunningFlows(flow.path)

                logging.getLogger("Horus").info("Flow %s completed", flow.name)
            except KeyboardInterrupt:
                print("Keyboard interrupt detected. Pausing flow.")

                # Exit the process
                sys.exit(0)

        # Create a process to run the flow
        from App import AppDelegate  # pylint: disable=import-outside-toplevel

        process = AppDelegate().server.backgroundRun(flowRun)

        # Save the process
        self._flowProcesses[flow.path] = process

    def removeRunningFlow(self, flowPath: str):
        """
        Removes a flow from the running flows list

        :param flowPath: The path of the flow to remove
        """

        # Remove the process
        self._flowProcesses.pop(flowPath)

    def pauseAllFlows(self):
        """
        Pauses all running flows
        """

        # Iterate through the running flows dict
        # In order to not modify the dict while iterating,
        # we copy the keys to a list
        for flowPath in list(self._flowProcesses.keys()):
            flow = None
            read = False
            while not read:
                try:
                    # Read the latest status of the flow
                    flow = Flow.read(flowPath)
                    read = True
                except Exception:
                    pass

            if flow is None:
                logging.getLogger("Horus").critical(
                    "Flow %s could not be loaded. Not able to pause flow.", flowPath
                )
                continue

            # Kill the flow
            self._killFlow(flowPath)

            # Set the flow status to paused
            flow.status = Flow.FlowStatus.PAUSED
            print(f"Pausing flow {flowPath}")

            # Save the flow
            flow.write()

    def stopFlow(self, flowPath: str) -> Flow:
        """
        Stops the flow execution of the given flow.

        Flows are killed. Take into account the collateral
        effects of killing a subprocess.

        :param flowPath: The path of the flow to stop

        :returns: The stopped flow
        """

        logging.getLogger("Horus").info("Stopping flow %s", flowPath)

        # Read the latest status of the flow
        updatedFlowToStop = Flow.read(flowPath)

        # Kill the flow
        self._killFlow(flowPath)

        # Set the flow status to stopped
        updatedFlowToStop.stop()

        # Save the flow
        updatedFlowToStop.write()

        return updatedFlowToStop

    def _killFlow(self, flowPath: str):
        """
        Internal function to kill running flows
        """

        logging.getLogger("Horus").debug("Killing flow %s", flowPath)

        # Kill the process
        process = self._flowProcesses.get(flowPath, None)

        if process is not None and process.is_alive():
            logging.getLogger("Horus").debug("Flow PID: %s", process.pid)
            process.kill()
            process.join()

            # Remove the flow from the running flows list
            self._flowProcesses.pop(flowPath)
        else:
            logging.getLogger("Horus").debug("Flow %s is not running", flowPath)
