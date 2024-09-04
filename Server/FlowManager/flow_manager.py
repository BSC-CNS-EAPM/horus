"""
Flow manager
"""

# Basic imports
import os
import sys
import json
import typing
import datetime
import logging
import hashlib

# Multiprocess module, a fork of multiprocessing with enhancements
# Cast the multiprocess module as the multiprocessing module
# in order to have type chekings / autocompletion
if typing.TYPE_CHECKING:
    import multiprocessing as mp
else:
    import multiprocess as mp

import time
import zipfile
import tarfile

# Enum for the flow status
from enum import Enum

# Blocks from Horus
from HorusAPI import PluginBlock as Block, SlurmBlock, BlockNotFoundError, GhostBlock

# The plugin manager
from Server.PluginManager import PluginManager, PrintCapturer

# The remote manager
from Server.RemotesManager import RemotesManager

# Import the settings manager
from Server.SettingsManager import SettingsManager

# Import file explorer for folder size
from Server.FileExplorer import FileExplorer

# Internal, development types
if typing.TYPE_CHECKING:
    from HorusAPI.src.plugins import BlockConnection  # pylint: disable=ungrouped-imports
    from Server.server import HorusSocket


class NoPathSelected(Exception):
    """
    No path was selected during the save process
    """


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

        # Set the block as with the error
        self.block._runError = True
        self.block._runErrorMessage = message
        self.block._isRunning = False
        self.block._finishedExecution = True


class ErrorRunningBlock(BlocksException):
    """
    Custom error running block exception
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


class VariableConnectionNotFound(Exception):
    """
    Custom variable connection not found exception
    """

    def __init__(self, var: "BlockConnection") -> None:
        super().__init__(
            f"The block '{var.origin.blockID}' "
            f"had the variable '{var.origin.variableID}' connected "
            f"to the block '{var.destination.blockID}' variable "
            f"'{var.destination.variableID}'. "
            "No such variable connection could be found."
        )


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

    savedID: typing.Optional[str]
    """
    The savedID of the flow. The path hashed.
    """

    _path: typing.Optional[str]
    """
    The path to the flow
    """

    canExecute: bool = True
    """
    Whether the flow can be executed or not. This depends on the flow
    having GhostBlocks
    """

    @property
    def path(self) -> typing.Optional[str]:
        """
        The path to the flow
        """
        return self._path

    @path.setter
    def path(self, value: typing.Optional[str]):
        """
        Setter for the path
        """

        self._path = value

        if value and not os.path.isabs(value):
            return

        # Update the savedID accordingly
        # with the path hash
        self._generateID()

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

    isPreset: bool = False
    """
    Whether the flow is a preset flow or not
    """

    horusSettings: typing.Optional[SettingsManager] = None
    """
    The settings manager instance for the user
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

    pendingSmilesActions: typing.List[typing.Dict[str, typing.Any]] = []
    """
    A list of pending actions to be sent to the frontend when the flow is opened

    For example, any SmilesAPI action that needs to be executed on JS side
    """

    size: typing.Optional[float] = None
    """
    The size of the folder that the flow is in (MB)
    """

    startedTime: typing.Optional[datetime.datetime] = None
    """
    The time the flow started running
    """

    finishedTime: typing.Optional[datetime.datetime] = None
    """
    The time the flow finished running
    """

    elapsed: float = 0
    """
    The elapsed time of the flow. This is the accumulated time for all the runs
    """

    FLOW_FILE: str = "flow.json"
    MOLSTAR_STATE_FILE: str = "molstarState.molx"
    SMILES_STATE_FILE: str = "smilesState.json"

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

        QUEUED = "QUEUED"
        """
        The flow is queued in the Semaphore
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
        :param horusSettings: The settings manager instance for the user
        """

        # Set the flow properties
        self.name = flow.get("name", "Unnamed flow")
        self.path = flow.get("path", None)
        self.remote = flow.get("remote", None)
        self.currentExecuting = flow.get("currentExecuting", None)
        self.date = flow.get("date", None)
        self.terminalOutput = flow.get("terminalOutput", [])
        self.pendingActions = flow.get("pendingActions", [])
        self.pendingSmilesActions = flow.get("pendingSmilesActions", [])

        # Get the flow size and time
        self.size = flow.get("size", None)
        startedTime = flow.get("startedTime", None)
        finishedTime = flow.get("finishedTime", None)
        self.elapsed = flow.get("elapsed", 0)

        if self.elapsed < 0:
            self.elapsed = 0

        # Convert the times to datetime
        if startedTime is not None:
            self.startedTime = datetime.datetime.fromtimestamp(startedTime)

        if finishedTime is not None:
            self.finishedTime = datetime.datetime.fromtimestamp(finishedTime)

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
                    "A block does not have an ID."
                )

            # Get the block class
            try:
                blockClass = PluginManager().findBlock(blockID)
                # Create a copy of the block, so we don't modify the original
                newCopyBlockClass = blockClass.copy()

            except BlockNotFoundError:

                # The BlockIDs here should be "pluginID.blockID"
                # if the GhostBlock is instantiated directly with this
                # value, it will modify the blockID to be
                # "pluginID_blockID" and after saving the flow
                # the original block information will be lost
                # Therefore we need to instantiate it with the original
                # blockID

                newCopyBlockClass = GhostBlock(blockID)
                self.canExecute = False

            # Parse the internal variables
            newCopyBlockClass._parseInternalVariables(  # pylint: disable=protected-access # noqa: E501
                block
            )  # pylint: disable=protected-access

            # Add the block to the list
            blocks.append(newCopyBlockClass)

        def checkVarConnection(var: "BlockConnection"):
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
                raise VariableConnectionNotFound(var)

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
                raise VariableConnectionNotFound(var)

        # Verify that variables are connected to existing variables
        for block in blocks:
            for var in block._variableConnections:  # pylint: disable=protected-access
                try:
                    checkVarConnection(var)
                except VariableConnectionNotFound as exc:
                    logging.getLogger("Horus").warning(exc)

                    # Remove the connection
                    block._variableConnections.remove(var)

                    self.canExecute = False

            # Do the same for the references
            for (
                refVar
            ) in block._variableConnectionsReferences:  # pylint: disable=protected-access
                try:
                    checkVarConnection(refVar)
                except VariableConnectionNotFound as exc:
                    logging.getLogger("Horus").warning(exc)

                    # Remove the reference
                    block._variableConnectionsReferences.remove(refVar)

                    self.canExecute = False

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

    _skipPath: typing.Union[str, None] = None
    """
    Override the fow path with this value

    Only used in webapp mode
    """

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
            "path": self.path if self._skipPath is None else self._skipPath,
            "remote": self.remote,
            "currentExecuting": self.currentExecuting,
            "status": self.status.value,
            "date": self.date,
            "size": self.size,
            "startedTime": self.startedTime.timestamp() if self.startedTime else None,
            "finishedTime": self.finishedTime.timestamp() if self.finishedTime else None,
            "elapsed": self.elapsed,
            "blocks": blocksJSON,
            "terminalOutput": self.terminalOutput,
            "pendingActions": self.pendingActions,
            "pendingSmilesActions": self.pendingSmilesActions,
        }

        return flow

    def write(
        self, molState: typing.Optional[bytes] = None, smilesState: typing.Optional[dict] = None
    ) -> typing.Dict[str, typing.Any]:
        """
        Writes the flow to the file

        :returns: The encoded flow
        """

        if not self.path:
            raise Exception(f"The flow '{self.name}' has no path")

        # Set the flow size
        self.size = self._computeSize()

        # If the flow does not have a name, set to "Unnamed flow"
        if self.name is None or self.name == "":
            self.name = "Unnamed flow"

        # Encode the flow
        encodedFlow = self.encode()

        # Get the current molstar state, if any
        if molState is None:
            molstarStateBytes = self.getMolstarState()
        else:
            molstarStateBytes = molState

        # Get the current smiles state, if any
        if smilesState is None:
            smilesStateDict = self.getSmilesState()
        else:
            smilesStateDict = smilesState

        # Remove the current file
        if os.path.exists(self.path):
            os.remove(self.path)

        logging.getLogger("Horus").debug("Writing flow '%s'", self.name)

        with zipfile.ZipFile(self.path, "w", zipfile.ZIP_DEFLATED) as zipFile:
            zipFile.writestr(self.FLOW_FILE, json.dumps(encodedFlow, indent=4))

            # Store again the molstar state
            if molstarStateBytes is not None:
                zipFile.writestr(self.MOLSTAR_STATE_FILE, molstarStateBytes)

            # Store again the smiles state
            if smilesStateDict is not None:
                zipFile.writestr(self.SMILES_STATE_FILE, json.dumps(smilesStateDict, indent=4))

        # Send the flow to the frontend on write
        if self._socket is not None:
            self._socket.emit("flow", self.encode(minimal=False), to=self.savedID)

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

    def getMolstarState(self) -> typing.Optional[bytes]:
        """
        Gets the molstar state molx file from the flow zip
        """

        if not self.path:
            return None

        try:
            with zipfile.ZipFile(self.path, "r") as zipFile:
                with zipFile.open(self.MOLSTAR_STATE_FILE) as file:
                    return file.read()
        except Exception:
            return None

    def getSmilesState(self) -> typing.Optional[dict]:
        """
        Gets the smiles state json file from the flow zip
        """

        if not self.path:
            return None

        try:
            with zipfile.ZipFile(self.path, "r") as zipFile:
                with zipFile.open(self.SMILES_STATE_FILE) as file:
                    return json.load(file)
        except Exception:
            return None

    @staticmethod
    def flowWorkDir(flowPath: str) -> str:
        """
        Returns the working directory for the flow
        by using the flow path name. Does not create the directory
        """

        flowDir = os.path.dirname(flowPath)
        flowFileName = os.path.splitext(os.path.basename(flowPath))[0]

        return os.path.join(flowDir, flowFileName)

    @property
    def isActive(self):
        """
        Returns whether the flow is active or not in any form.
        For example, if its PAUSED, RUNNING or QUEUED, will return True.
        If FINISHED, ERROR, IDLE, STOPPED, will return False.
        """

        return self.status in [
            self.FlowStatus.PAUSED,
            self.FlowStatus.RUNNING,
            self.FlowStatus.QUEUED,
        ]

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
        self,
        placedID: int,
        resetRemoteBlock: bool = False,
        comesFromCyclic: bool = False,
        flowResumed: bool = False,
    ):
        """
        Executes iteratively the blocks of the flow

        Parameters
        ----------
        placedID: int
            The ID of the block to start from
        resetRemoteBlock: bool
            Whether to reset the remote block
        flowResumed: bool
            Whether the flow was resumed from a paused state. For this case
            the parameter its only used in the first call to _runPreviousBlocks
        comesFromCyclic: bool
            Whether the call comes from a cyclic block
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
            self.currentExecuting = None
            raise StoppedFlowException(blockToRun)

        # If the block is already executed, return its outputs.
        # Except for when we are ressetting the flow run
        if (
            blockToRun._finishedExecution and not resetRemoteBlock and not blockToRun._runError
        ):  # and not comesFromCyclic
            return blockToRun._storedOutputs
        else:
            # Clean the block run only if its not a Slurm block which is currently running
            # nad needs to execute its second action.
            if (
                isinstance(blockToRun, SlurmBlock)
                and flowResumed
                and blockToRun.jobID is not None
            ):
                logging.getLogger("Horus").info(
                    "Resuming Slurm block with JOB ID '%s'", blockToRun.jobID
                )
            else:
                blockToRun._cleanRun(cleanCycles=not comesFromCyclic)

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
                    self.currentExecuting = None
                    raise ErrorRunningBlock(
                        blockToRun, "Exceded the maximum number of cycles for this connection."
                    )

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
            except KeyError as keye:
                raise ErrorRunningBlock(
                    blockToRun,
                    f"The block '{variableBlock.name}' does not provide the variable "
                    + f"'{connection.origin.variableID}' to the block '{blockToRun.name}'. "
                    + "Did you forget to call setOutput() in the action of the block?",
                ) from keye

        # With the generated inputs, update the block to run
        blockToRun._updateInputs(inputs)

        # Set the block and flow state
        blockToRun._isRunning = True
        self.currentExecuting = blockToRun._placedID

        # Save the flow
        self.write()

        # When running a flow, the savedID is always defined
        self.savedID = typing.cast(str, self.savedID)

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
            self.currentExecuting = None

            # Raise again a special "ErrorRunningBlock" exception
            raise ErrorRunningBlock(blockToRun, str(exc)) from exc

        # Save the flow
        self.write()

        # If a slurm block was run, check if we need to wait for the job to finish
        # That means that the action executed was the block's firstAction. When the job with
        # finishes, the block will be executed again with the secondAction. If _waitingForJob
        # is True, the flow execution wait until the job finishes. If its false, it means
        # that the finalAction was executed and that the flow can continue executing
        if isinstance(blockToRun, SlurmBlock):
            # Call the parsestatus method to update the block's status
            blockToRun.parseStatus()

            self.write()

            # Wait for the job to finish
            try:
                while blockToRun.isWaitingForJob:

                    # Update the flow (running time, queue...)
                    self.write()

                    waitTime = (
                        int(self.horusSettings.getSetting("queueWaitTime").value)
                        if self.horusSettings
                        else 10
                    )

                    time.sleep(waitTime)

                # When exiting the loop, the status will be updated
                # Then we need to update the frontend and the flow too
                self.write()

            except Exception as exc:  # pylint: disable=broad-exception-raised
                self.currentExecuting = None

                # Raise again a special "ErrorRunningBlock" exception
                raise ErrorRunningBlock(blockToRun, str(exc)) from exc

            if blockToRun.status != SlurmBlock.Status.COMPLETED:
                if blockToRun.failOnSlurmError:
                    self.currentExecuting = None
                    raise ErrorRunningBlock(
                        blockToRun, f"Slurm job failed. Status: {blockToRun.status.value}"
                    )
                else:
                    logging.getLogger("Horus").warning(
                        "Slurm job for block '%s' failed. But the flow will continue. Status: %s",
                        blockToRun.id,
                        blockToRun.status.value,
                    )

            # Set the block to execute the second action
            blockToRun._executeSecondAction = True

            # Once the block has been executed, call again the execution
            # of this block to execute the finalAction
            try:
                outputs = self._pluginManager.executeBlock(
                    blockToRun, self.savedID, resetRemoteBlock=False, isFirstSlurm=False
                )
            except Exception as exc:  # pylint: disable=broad-exception-raised
                # If an error was raised during the execution of the block
                # update acordingly the block's state
                self.currentExecuting = None

                # Raise again a special "ErrorRunningBlock" exception
                raise ErrorRunningBlock(blockToRun, str(exc)) from exc

        # Block endend executing, thus update the state
        blockToRun._isRunning = False
        blockToRun._finishedExecution = True
        self.currentExecuting = None

        # Save the flow
        self.write()

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
                raise ErrorRunningBlock(
                    blockToRun,
                    "The reference of a variable is not valid. "
                    f"Origin: {nextConnection.origin.variableID}, "
                    f"Destination: {nextConnection.destination.variableID}",
                )

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

    def reset(self):
        """
        Resets the state of the object by cleaning the run of all blocks,
        clearing the terminal output,
        and resetting the pending actions. Also, it restores the elapsed time to 0.

        This function does not take any parameters.

        This function does not return any value.
        """
        for block in self.blocks:
            block._cleanRun()

        # Clear the terminal output
        self.terminalOutput = []

        # Clean the pending actions
        self.pendingActions = []

        # Clean the pending smiles actions
        self.pendingSmilesActions = []

        # Restore the time
        self.elapsed = 0

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

        if not self.path:
            msg = f"The flow '{self.name}' does not have a path."

            # Stop the flow
            self.stop(msg, fail=True)

            raise Exception(msg)

        # Cast the savedID
        self.savedID = typing.cast(str, self.savedID)

        flowResumed = False
        if placedID is None and self.currentExecuting is not None:
            # If this method was called without a placedID,
            # resume the flow execution from the latest executed block
            placedID = self.currentExecuting
            flowResumed = True
        elif resetFlow:
            # Set all blocks as not executed because a new run is starting
            self.reset()

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
        blockSelectedToRun: typing.Optional["Block"] = None
        if self.currentExecuting is None:
            blockSelectedToRun = self.findBlockByPlacedID(placedID)
            blockSelectedToRun._cleanRun(cleanCycles=False)
        else:
            blockSelectedToRun = self.findBlockByPlacedID(self.currentExecuting)

        # Set the block as running
        blockSelectedToRun._isRunning = True

        if not self.canExecute:

            msg = (
                f"The flow '{self.name}' is not executable because "
                "it contains ghost blocks. Please remove them or "
                "re-install the Plugins that provided such blocks."
            )

            # Stop the flow
            self.stop(msg, fail=True)

            raise Exception(msg)

        # Assign the socket instance
        self._socket = socket

        # Assign the plugin manager instance
        self._pluginManager = PluginManager()

        # Verify the SettingsManager instance
        if self.horusSettings is None:
            logging.getLogger("Horus").warning(
                "The settings manager instance is not available. "
                + "The flow will run with the default settings."
            )

        # Generate a folder for the results of the flow, and change the working dir
        # to it
        flowResultsDir = self.flowWorkDir(self.path)

        if not os.path.exists(flowResultsDir):
            os.makedirs(flowResultsDir)

        # Update the working dir
        oldWD = os.getcwd()
        os.chdir(flowResultsDir)

        # Set the flow status to running
        self.status = self.FlowStatus.RUNNING

        # Reset the time
        self.startedTime = datetime.datetime.now()
        self.finishedTime = None

        # Send the flow to the frontend if a socket is provided
        if self._socket is not None:
            self._socket.emit("flow", self.encode(minimal=False), to=self.savedID)

        # Update the MolstarAPI with the current flow
        # Because the flows are running in separate processes,
        # the main instance of the MolstarAPI is not affected
        from HorusAPI import MolstarAPI

        molAPI = MolstarAPI()

        molAPI._flow = self

        # Update the SmilesAPI with the current flow
        from HorusAPI import SmilesAPI

        smilesAPI = SmilesAPI()

        smilesAPI._flow = self

        # Update the ExtensionsAPI with the current flow
        from HorusAPI import Extensions

        extAPI = Extensions()

        extAPI._flow = self

        # Reset the flow size and the finished time
        self.size = None
        self.finishedTime = None

        # Run the blocks
        with self.TerminalOutputUpdater(self.terminalOutput, self.savedID, socket):
            try:
                self._runPreviousBlocks(
                    placedID, resetRemoteBlock=resetRemoteBlock, flowResumed=flowResumed
                )
                self._runNextBlocks(placedID)
                self.status = self.FlowStatus.FINISHED
            except ErrorRunningBlock:
                self.status = self.FlowStatus.ERROR
            except StoppedFlowException:
                self.status = self.FlowStatus.STOPPED
            except Exception:  # pylint: disable=broad-exception-raised
                import traceback

                logging.getLogger("Horus").error(
                    traceback.format_exc(),
                    exc_info=True,
                )
                self.status = self.FlowStatus.ERROR

        # Compute the elapsed and the finished time
        self._computeFinalTime()

        # Compute the size of the folder the flow is in
        self.size = self._computeSize()

        # Restore the working dir
        os.chdir(oldWD)

        # Save the flow
        self.write()

        # Send the flow to the frontend if a socket is provided
        # Send a request to the main server to remove the flow from the running flows list
        if socket is not None:
            socket.removeFinishedFlowFromRunningFlows(self.path)

    def _computeFinalTime(self):
        """
        Sets the finished time and the elapsed based on the started time
        """
        # Add the elapsed time
        if self.startedTime is None:
            return

        # Set the finished time
        self.finishedTime = datetime.datetime.now()

        # Update the elapsed time
        self.elapsed += (self.finishedTime - self.startedTime).total_seconds()

    def _computeSize(self) -> typing.Optional[float]:
        """
        Computes the size of the folder the flow is in

        returns: The size of the folder in MB or None if the size could not be computed
        """

        # If the flow is not saved, return None
        if self.path is None:
            return None

        # Get the folder of the flow
        folder = os.path.dirname(self.path)

        return FileExplorer.computePathSize(folder)

    def stop(self, message: str = "The flow was stopped.", fail: bool = False):
        """
        Stops the flow from executing
        """

        if not self.path:
            raise Exception(f"Cannot cancel a pathless flow '{self.name}'.")

        # Cast the savedID
        self.savedID = typing.cast(str, self.savedID)

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

                    # Parse the failed status
                    block._setRemote(rAPI)
                    block.flow = self
                    block.parseStatus()

                    # Remove the flow from the queue
                    rAPI.deleteFlowFromQueue(self.savedID)

                except Exception as exc:
                    logging.getLogger("Horus").error("Error cancelling job: %s", str(exc))

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

        # Update the flow size and the finished time
        self.size = self._computeSize()
        self._computeFinalTime()

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

            # Prevent printing flow prints to the terminal in roder to not
            # saturate the terminal on WebAppMode (only in not debug mode)
            from App import AppDelegate

            if AppDelegate().debug:
                super().write(message)

    def _generateID(self):
        """
        Generates a unique identifier using a hash of the flow path

        Returns:
            str: The hash of the flow path as the ID
        """

        if not self.path:
            self.savedID = None
        else:
            algorithm = "md5"

            # Create a hash object
            hashObj = hashlib.new(algorithm)
            hashObj.update(self.path.encode("utf-8"))

            # Get the hexadecimal representation of the hash
            self.savedID = hashObj.hexdigest()


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

    _templatesDir: str
    """
    The user's templates directory.
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

        # Assign the templates path
        self._templatesDir = os.path.join(appSupportDir, "templates")

        # Create the templates folder if it does not exist
        if not os.path.exists(self._templatesDir):
            # Same for the templates directory
            os.makedirs(self._templatesDir, exist_ok=True)

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
        read = False
        recentFlows = {}
        while not read:
            with open(self.recentFlowsPath, "r", encoding="utf-8") as file:
                try:
                    recentFlows = json.load(file)
                    read = True
                except json.JSONDecodeError as exc:
                    logging.getLogger("Horus").error(
                        "Error reading recent flows file: %s", str(exc)
                    )

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
        if flow.isPreset:
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
        # while len(self.recentFlows) > 10:
        #     oldestFlow = self.recentFlows[0]
        #     for savedFlow in self.recentFlows:
        #         if savedFlow.dateAsInt < oldestFlow.dateAsInt:
        #             oldestFlow = savedFlow

        #     logging.getLogger("Horus").debug("Removing oldest flow '%s'", oldestFlow.name)
        #     self.recentFlows.remove(oldestFlow)

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
        self,
        flow: Flow,
        overwrite=False,
        molstarState: typing.Optional[bytes] = None,
        smilesState: typing.Optional[dict] = None,
        addToRecents: bool = True,
    ):
        """
        Saves a flow to a file. (overwrites if already exists)
        """
        flowPath = flow.path

        if flowPath is None:
            raise Exception(  # pylint: disable=broad-exception-raised
                f"The flow '{flow.name}' does not have a path"
            )

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
        else:
            # Set the saved ID (will hash automatically the path with the Flow class setter)
            flow.path = flowPath

        # If we are overwriting a flow, check if the user wants to overwrite it
        from App import AppDelegate  # pylint: disable=import-outside-toplevel

        if overwriteCaution and not overwrite and not AppDelegate().desktop:
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
            flow.write(molstarState, smilesState)

        # Add the flow to the recent flows list
        if addToRecents:
            self._addToRecentFlows(flow)

        # Return the saved flow
        return flow

    def saveFlow(
        self,
        flow: typing.Dict[str, typing.Any],
        molstarState: typing.Optional[bytes] = None,
        smilesState: typing.Optional[dict] = None,
        addToRecenets: bool = True,
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
        # Because the savedID now gets automatically generated when the path is set,
        # in the case of saving the flow for the first time we have to set manually the
        # ID to none in order to check to overwrite a new flow. When overwriting we
        # leave the generated ID in place.
        if not overwrite:
            flowInstance.savedID = flow.get("savedID", None)

        # Check if the flow has a path, if its a new flow,
        # and if we are not overwriting
        # to ask the user for a new path
        if not flowInstance.path and not flowInstance.savedID and not overwrite:
            from App import AppDelegate

            if not AppDelegate().desktop:
                overwrite = True
                flowInstance.path = os.path.join("flows", flowInstance.name + ".flow")
            else:  # On desktop mode, open the file picker
                filename = flowInstance.name + ".flow"
                flowPath = AppDelegate().saveFileSelectDialog(
                    filename, fileTypes=("Flow (*.flow)",)
                )

                # Check if the user selected a path
                if not flowPath:
                    raise NoPathSelected(
                        "No path selected."
                    )  # pylint: disable=broad-exception-raised

                # Append the extension if not present
                if not flowPath.endswith(".flow"):
                    flowPath += ".flow"
                flowInstance.path = flowPath

        return self._saveFlowInternal(
            flowInstance, overwrite, molstarState, smilesState, addToRecenets
        )

    def openFlowFromPath(
        self,
        flowPath: str,
        addToRecents: bool = True,
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
        if addToRecents:
            self._addToRecentFlows(flow)

        # If the flow is marked as running but its not present
        # in the running flows list, set the status to FAILED
        if flow.status == flow.FlowStatus.RUNNING and flow.path not in self._flowProcesses:
            logging.getLogger("Horus").warning(
                "The flow '%s' was running but it was not found in the running flows "
                "for this Horus instance, setting status to PAUSED. "
                "If you have another Horus instance running, "
                "please open the flow from there.",
                flow.path,
            )
            flow = self.pauseFlow(flowPath)

        # Return the flow
        return flow

    def openFlow(self) -> Flow:
        """
        Opens the file select dialog to open a flow.
        """
        from App import AppDelegate

        if AppDelegate().desktop:
            flowPath = AppDelegate().openFileSelectDialog(
                allowMultiple=False, fileTypes=("Flow (*.flow)",)
            )

            if flowPath:
                if isinstance(flowPath, tuple):
                    flowPath = flowPath[0]
                return self.openFlowFromPath(str(flowPath))
            raise NoPathSelected("No path selected.")  # pylint: disable=broad-exception-raised
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
                loadedFLow = self.openFlowFromPath(pFlow["path"], addToRecents=False)
                break
        if not loadedFLow:
            raise Exception("Flow not found.")  # pylint: disable=broad-exception-raised

        # Replace the savedID and the flow path so
        # the forntend can save it to another location
        loadedFLow.path = None

        return loadedFLow

    _flowProcesses: typing.Dict[str, mp.Process] = {}
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

                isProcessAlive = process.is_alive()
                if isProcessAlive and process.pid is not None:
                    # Verify if really the flow is running
                    # Sometimes is_alive() returns True when the process is not running
                    # just because the PID still exists
                    try:
                        os.kill(process.pid, 0)
                    except OSError:
                        isProcessAlive = False

                if isProcessAlive:
                    raise Exception(  # pylint: disable=broad-exception-raised
                        "The flow is already running."
                    )
                else:
                    # Remove the flow from the running flows list
                    self._flowProcesses.pop(runningFlowPath)

        # Set the socket instance
        flow._socket = socket

        # Set the flow as QUEUED
        flow.status = flow.FlowStatus.QUEUED

        # Save the flow
        flow.write()

        if not flow.path:
            raise Exception(f"Something went wrong. The flow path is None for flow '{flow.name}'")

        # Run the flow in a separate process
        def flowRun():
            try:
                logging.getLogger("Horus").info("Started flow %s", flow.name)

                # Assign the horusSettings to the flow
                flow.horusSettings = SettingsManager(self.appSupportDir)

                # Run the flow
                flow.run(placedID, resetRemoteBlock, socket, resetFlow)

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
                    # Read the latest status of the flow and pause it
                    flow = self.pauseFlow(flowPath)
                    read = True
                except Exception:
                    pass

            if flow is None:
                logging.getLogger("Horus").critical(
                    "Flow %s could not be loaded. Not able to pause flow.", flowPath
                )
                continue

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

        # Kill the flow process
        self._killFlow(updatedFlowToStop)

        # Set the flow status to stopped
        updatedFlowToStop.stop()

        # Save the flow
        updatedFlowToStop.write()

        return updatedFlowToStop

    def pauseFlow(self, flowPath: str):
        """
        Pauses the flow execution of the given flow.

        :param flowPath: The path of the flow to pause
        """

        logging.getLogger("Horus").info("Pausing flow %s", flowPath)

        # Read the latest status of the flow
        updatedFlowToPause = Flow.read(flowPath)

        # Kill the flow process
        self._killFlow(updatedFlowToPause)

        # Set the flow status to paused
        updatedFlowToPause.status = Flow.FlowStatus.PAUSED
        updatedFlowToPause._computeFinalTime()

        # Save the flow
        updatedFlowToPause.write()

        return updatedFlowToPause

    def _killFlow(self, flow: Flow):
        """
        Internal function to kill running flows
        """

        if not flow.path:
            raise Exception(f"Flow path of '{flow.name}' is not defined.")

        logging.getLogger("Horus").debug("Killing flow %s", flow.path)

        # Kill the process
        process = self._flowProcesses.get(flow.path, None)

        if process is not None and process.is_alive():
            logging.getLogger("Horus").debug("Flow PID: %s", process.pid)
            process.kill()
            process.join()

            # Remove the flow from the running flows list
            self._flowProcesses.pop(flow.path)

            # Unlock the semaphore to allow queued flows to run
            # Only if the flow was running

            if flow.status == flow.FlowStatus.RUNNING:
                from App import AppDelegate

                AppDelegate().server.taskSemaphore.release()

        else:
            logging.getLogger("Horus").debug("Flow %s is not running", flow.path)

    def compressFlow(self, flow: "Flow") -> str:
        """
        Will compress in a tar file the flow folder

        :param flow: The flow to compress

        :returns: The path to the compressed file
        """

        if not flow.path:
            raise Exception(f"Flow path of '{flow.name}' is not defined.")

        # Generate the "download folders" if they don't exist
        downloadsFolder = os.path.join(self.appSupportDir, "download")

        if not os.path.exists(downloadsFolder):
            os.makedirs(downloadsFolder)

        # Get the dirname of the flow
        flowDir = os.path.dirname(flow.path)

        # Create the tar file
        tarPath = os.path.join(downloadsFolder, f"{flowDir}.tar")

        with tarfile.open(tarPath, "w") as tar:
            tar.add(flowDir, arcname=os.path.basename(flowDir))

        return tarPath

    def saveAsTemplate(self, flow: typing.Dict[str, typing.Any]):
        """
        Saves the given flow into the templates folder
        """

        # Just set the flow path to the templates folder
        from pathvalidate import sanitize_filepath

        sanitizedName = sanitize_filepath(flow["name"], max_len=30)
        sanitizedName = sanitizedName.replace(" ", "_")

        templatePath = os.path.join(self._templatesDir, sanitizedName + ".flow")

        # If the template exists, raise an overwrite exception
        if os.path.exists(templatePath):
            readTemplate = self.openFlowFromPath(templatePath)
            raise Exception(
                "Trying to overwrite a template. Please remove the template "
                f"'{readTemplate.name}' before saving this one."
            )

        flow["path"] = templatePath
        flow["savedID"] = None

        # Save the flow
        savedTemplate = self.saveFlow(flow, molstarState=None, addToRecenets=False)

        # Set as "preset"
        savedTemplate.path = None  # type: ignore
        savedTemplate.savedID = None  # type: ignore

        return savedTemplate

    def loadTemplateFlow(self, templateID: str):
        """
        Loads the given flow template by providing its ID
        """

        loadedTemplate = self.getTemplateByID(templateID)

        # Replace the savedID and the flow path so
        # the forntend can save it to another location
        loadedTemplate.savedID = None  # type: ignore
        loadedTemplate.path = None  # type: ignore

        return loadedTemplate

    def getTemplateByID(self, templateID: str):
        """
        Finds a template in the templates dir given its ID
        """

        templateFlows = self.listTemplates()
        loadedTemplate = None
        for tFlow in templateFlows:
            if tFlow.savedID == templateID:
                loadedTemplate = tFlow
                break
        if not loadedTemplate:
            raise Exception("Template not found.")  # pylint: disable=broad-exception-raised

        return loadedTemplate

    def listTemplates(self) -> list[Flow]:
        """
        List the user's templates folder
        """

        templates: list[Flow] = []
        for f in os.listdir(self._templatesDir):
            if f.endswith(".flow"):
                filePath = os.path.join(self._templatesDir, f)

                # Read the flow file to get the name of the flow
                try:
                    templates.append(Flow.read(filePath))
                except Exception as exc:
                    logging.getLogger("Horus").error(
                        "Error reading template flow %s: %s", filePath, exc
                    )
                    continue

        # Sort them alphabetically
        def sortByName(template: Flow):
            return template.name

        # Sort the blocks
        templates.sort(key=sortByName)

        return templates
