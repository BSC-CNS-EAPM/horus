"""
Flow manager
"""

import os
import json
import typing
import uuid
import datetime

from HorusAPI import PluginBlock as Block


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

    currentExecuting: typing.Optional[Block]
    """
    The current executing block
    """

    molstarState: typing.Dict[str, typing.Any]
    """
    The molstar state
    """

    date: str
    """
    The date the flow was last saved as a string (YYYY-MM-DD HH:MM:SS)
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
        self.molstarState = flow.get("molstarState", {})
        self.date = flow.get("date", None)

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
            from App import AppDelegate  # pylint: disable=import-outside-toplevel

            blockClass = AppDelegate().server.pluginManager.findBlock(blockID)

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
                    "Corrupted flow. Variable destination is not valid."
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

        return blocks

    def encode(self, minimal: bool = True) -> typing.Dict[str, typing.Any]:
        """
        Encodes the flow to a JSON object
        """

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
            "date": self.date,
            "blocks": blocksJSON,
            "molstarState": self.molstarState,
        }

        return flow

    def write(self):
        """
        Writes the flow to the file
        """

        # Save the flow
        with open(self.path, "w", encoding="utf-8") as file:
            json.dump(self.encode(), file)

    @classmethod
    def read(cls, path: str) -> "Flow":
        """
        Reads a flow from a file
        """

        # Read the flow
        with open(path, "r", encoding="utf-8") as file:
            flow = json.load(file)

        flow = Flow(flow)
        flow.path = path

        return flow

    def __eq__(self, other):
        if isinstance(other, Flow):
            return self.savedID == other.savedID
        return False

    def __str__(self):
        return json.dumps(self.encode(minimal=False), indent=4)


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

    def __init__(
        self,
        appSupportDir: str,
    ) -> None:
        self.appSupportDir = appSupportDir
        self._recentFlowsPath = os.path.join(appSupportDir, "recent_flows.json")

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

    def _recentsReader(self):
        """
        Reads the recent flows from the file
        """

        # Read the recent flows file
        with open(self.recentFlowsPath, "r", encoding="utf-8") as file:
            recentFlows = json.load(file)

        recentFlowsList = []
        # Parse the flows
        for flow in recentFlows:
            path = recentFlows[flow]
            try:
                instaceFlow = Flow.read(path)
                recentFlowsList.append(instaceFlow)
            except Exception as exc:  # pylint: disable=broad-exception-caught
                print(f"Error reading recent flow {path}", exc)

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
        self._recentsReader()

        return self.recentFlows

    def _addToRecentFlows(self, flow: Flow):
        """
        Adds a given flow to the recent flows list

        :param flow: The flow to add
        """

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

    def _saveFlowInternal(self, flow: Flow, overwrite=False):
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

        # Create a new savedID if it doesn't exist or is "new_flow"
        if not flow.savedID or flow.savedID == "new_flow":
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
            print(flow.currentExecuting)
            print(flow.name)
            print(flow.savedID)
            print(flow.path)
            print("Trying to save empty flow, cancelling")
        else:
            flow.write()

        # Add the flow to the recent flows list
        self._addToRecentFlows(flow)

        # Return the saved flow
        return flow

    def saveFlow(self, flow: typing.Dict[str, typing.Any]):
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
        if not flowInstance.path and flowInstance.savedID == "new_flow" and not overwrite:
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

        return self._saveFlowInternal(flowInstance, overwrite)

    def openFlowFromPath(self, flowPath: str) -> Flow:
        """
        Opens a flow from a file.
        """

        # Check that the file exists
        if not os.path.exists(flowPath):
            raise Exception(  # pylint: disable=broad-exception-raised
                "The flow file does not exist"
            )

        # Read the flow file
        flow = Flow.read(flowPath)

        # Add the flow to the recent flows list
        self._addToRecentFlows(flow)

        # Return the flow
        return flow

    def openFlow(self) -> Flow:
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
                return self.openFlowFromPath(str(flowPath))
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
        from App import AppDelegate  # pylint: disable=import-outside-toplevel

        pluginFlows = AppDelegate().server.pluginManager.listFlows()
        loadedFLow = None
        for pFlow in pluginFlows:
            if pFlow["savedID"] == savedID:
                loadedFLow = self.openFlowFromPath(pFlow["path"])
                break
        if not loadedFLow:
            raise Exception("Flow not found.")  # pylint: disable=broad-exception-raised

        # Replace the savedID and the flow path so
        # the forntend can save it to another location
        loadedFLow.savedID = "new_flow"
        loadedFLow.path = None  # type: ignore

        return loadedFLow
