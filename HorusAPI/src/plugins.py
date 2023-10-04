from __future__ import annotations
import typing
import json
import os
from enum import Enum
from copy import deepcopy
import logging


class PluginRemote:
    def __init__(self, remote) -> None:
        self._remote = remote

    def remoteCommand(self, command: str):
        """
        Executes a command on the remote.
        The output of the command will be returned.

        :param command: The command to execute.
        """
        output = self._remote.command(command)

        return output

    def sendData(self, source: str, destination: str):
        """
        Sends a file to the remote.
        :param file: The path to the file to send.
        """

        # Fix the ~ in the remote path (https://github.com/fabric/fabric/issues/2228)

        if "~" in destination:
            destination = destination.replace("~", self.userHome)

        self._remote.transferTo(source, destination)

    def getData(self, source: str, destination: str):
        """
        Gets a file from the remote.
        :param file: The path to the file to get.
        """

        # Fix the ~ in the remote path
        if "~" in source:
            source = source.replace("~", self.userHome)

        self._remote.transferFrom(source, destination)

    def submitJob(self, script: str) -> int:
        """
        Submit a slurm job to the queue system of the cluster (SLURM)

        :param script: The  absolute path to the script to submit.

        :return: The job ID.
        """

        return self._remote.submitJob(script)

    @property
    def userHome(self):
        """
        Returns the expanded user home directory.
        """

        return self._remote.userHome

    @property
    def workDir(self):
        """
        Returns the Horus directory on the remote.
        If on local, returns the flow directory.
        """

        return self._remote.workDir


class PluginEndpoint:
    def __init__(self, url: str, methods: typing.List[str], function: typing.Callable):
        """
        Create a new PluginEndpoint.

        :param url: The URL of the endpoint.
        :param method: The method of the endpoint.
        :param function: The function that will be called when the endpoint is accessed. To the function the request object will be passed as the first argument. Remember to define the function with the request argument.
        """
        self.url = url
        self.methods = methods
        self.function = function


class PluginPage:
    endpoints: typing.List[PluginEndpoint] = []
    """
    Define endpoints that the plugin can access from the defined pages.
    The endpoint URL should be defined as a string, for example: "/my_endpoint".
    Later, Horus will add the endpoint in the following format:
    "/plugins/pages/pluginid.pagename/my_endpoint".
    Therefore, remember to perform any GET or POST request to that endpoint.

    Note: pluginid and pagename are always lowercase.
    """

    _pageInfo: typing.Dict[str, typing.Any] = {}
    """
    Internal variable used to store the page info.
    """

    def __init__(self, id: str, name: str, description: str, html: str):
        """
        Create a new PluginPage.

        :param id: The ID of the page.
        :param name: The name of the page.
        :param description: A description of the page.
        :param html: The name of the HTML file (i.e. "my_page.html"). The html file must be located in the "Pages" folder of the plugin.
        """
        self.id = id
        self.name = name
        self.description = description
        self.html = html

    def addEndpoint(self, endpoint: PluginEndpoint):
        """
        Add an endpoint to the page.

        :param endpoint: The endpoint to add.
        """
        self.endpoints.append(endpoint)


class VariableTypes(str, Enum):
    ANY = "any"
    """
    Any type of variable.

    Will render as a text input.
    """

    STRING = "string"
    """
    A regular string like "Hello world".

    Will render as a text input.
    """

    INTEGER = "integer"
    """
    A regular integer like 1, 2, 3...

    Will render as a text input.
    """

    FLOAT = "float"
    """
    A regular float like 1.0, 2.0, 3.0...

    Will render as a text input.
    """

    BOOLEAN = "boolean"
    """
    A boolean value. True or False.

    Will render as a checkbox.
    """

    STRING_LIST = "string[]"
    """
    A list of strings like ["Hello", "World"].

    Will render as a dropdown.
    """

    INTEGER_LIST = "integer[]"
    """
    A list of integers like [1, 2, 3].

    Will render as a dropdown.
    """

    FLOAT_LIST = "float[]"
    """
    A list of floats like [1.0, 2.0, 3.0].

    Will render as a dropdown.
    """

    BOOLEAN_LIST = "boolean[]"
    """
    A list of booleans like [True, False].

    Will render as a radio items buttons.
    """

    LIST = "list"
    """
    An initial empty list [] to which entries can be added.

    Will render as a table with an input field and an add button. 
    Using allowedValues will render a dropdown alongside the input field 
    to select the type of the value to add.
    """

    INT_RANGE = "[integer, integer]"
    """
    A range of integers like 1-10.

    Will render as a slider.
    """

    FLOAT_RANGE = "[float, float]"
    """
    A range of floats like 1.0-10.0.

    Will render as a slider.
    """

    FILE = "file"
    """
    A file.

    - On the server: Will open the server file explorer.
    - On the desktop: Will render as a system file picker.
    """

    FOLDER = "folder"
    """
    A folder.

    - On the server: Will open the server file explorer.
    - On the desktop: Will render as a system folder picker.
    """

    STRUCTURE = "structure"
    """
    A molecular structure to be selected from Mol*.

    Will render as a dropdown with the list of loaded structures.
    The type of the variable will be a dictionary with the following keys:
    - id: The ID of the structure.
    - name: The name of the structure.
    - type: The type of the structure (CIF, PDB...).
    - structure: The structure object (CIF, PDB... string)
    """

    HETERORES = "heterores"
    """
    A hetero residue to be selected from a loaded structure.

    Will render as a list of hetero residues.
    The type of the variable will be a dictionary with the following keys:
    - index: The index of the residue in the structure.
    - name: The name of the residue.
    - atoms: The list of atoms in the residue.
    - structure: The structure object variable where the atom is located.
    This last variable contains the properties of the STRUCTURE variable.
    """

    STDRES = "stdres"
    """
    A standard residue to be selected from a loaded structure.

    Will render as a dropdown with the list of standard residues.
    The type of the variable will be a dictionary with the following keys:
    - index: The index of the residue in the structure.
    - name: The name of the residue.
    - atoms: The list of atoms in the residue.
    - structure: The structure object variable where the atom is located.
    This last variable contains the properties of the STRUCTURE variable.
    """

    ATOM = "atom"
    """
    An atom to be selected from a loaded structure.

    Will render as a dropdown with the list of atoms as an interactive atom selector.
    The type of the variable will be a dictionary with the following keys:
    - index: The index of the atom in the structure.
    - name: The name of the atom.
    - element: The element of the atom.
    - residue: The residue of the atom.
    - structure: The structure object variable where the atom is located.
    This last variable contains the properties of the STRUCTURE variable.
    """

    CHAIN = "chain"
    """
    A chain to be selected from a loaded structure.

    Will render as a dropdown with the list of chains.
    The type of the variable will be a dictionary with the following keys:
    - index: The index of the chain in the structure.
    - name: The name of the chain.
    - residues: The list of residues in the chain.
    - structure: The structure object variable where the atom is located.
    This last variable contains the properties of the STRUCTURE variable.
    """

    SPHERE = "sphere"
    """
    A sphere to be rendered in Mol*.

    Will render as an interactive sphere viewer. The user can select the
    center and the radius of the sphere.
    The type of the variable will be a dictionary with the following keys:
    - center: The center of the sphere as a list of floats [x, y, z].
    - radius: The radius of the sphere as a float.
    """

    SMILES = "smiles"
    """
    A single molecule SMILES string.

    Will render as the JSME viewer (https://jsme-editor.github.io/)
    """

    @staticmethod
    def getTypes():
        """
        Returns a list of all the available types.
        """
        types = []
        for attr_name in dir(VariableTypes):
            attr = getattr(VariableTypes, attr_name)
            if not callable(attr) and not attr_name.startswith("__"):
                types.append(attr)

        return types

    # Make the object JSON serializable
    def __str__(self):
        return self.value

    def __repr__(self):
        return self.value

    def __eq__(self, other):
        return self.value == other.value

    def __hash__(self):
        return hash(self.value)


class PluginVariable:
    """
    Class that defines a variable that can be used in a PluginBlock.
    """

    id: str = "baseplugin.variable"

    def __init__(
        self,
        id: str,
        name: str,
        description: str,
        type: VariableTypes,
        defaultValue: typing.Optional[typing.Any] = None,
        allowedValues: typing.Optional[typing.List[typing.Any]] = None,
    ):
        """
        :param name: The name of the variable.
        :param description: A description of the variable.
        :param type: The type of the variable. Assign it using the VariableTypes class.
        :param defaultValue: The default value of the variable.
        :param id: The ID of the variable.
        :param allowedValues: A list of allowed values for the variable.
        """
        self.name = name
        self.description = description
        self.type = type

        if type not in VariableTypes.getTypes():
            raise Exception(f"Invalid type {type}.")

        self.defaultValue = defaultValue
        self.value = defaultValue
        self.id = id
        self.allowedValues = allowedValues

    def toDict(self, minimal: bool = False):
        """
        Convert the variable to a dictionary.
        """

        if minimal:
            varDict = {
                "id": self.id,
                "value": self.value if self.value else self.defaultValue,
            }
        else:
            varDict = {
                "name": self.name,
                "id": self.id,
                "description": self.description,
                "type": self.type,
                "value": self.value if self.value else self.defaultValue,
                "allowedValues": self.allowedValues,
            }

        return varDict

    def __str__(self):
        return json.dumps(self.toDict(), indent=4)


class VariableGroup:
    """
    A group of varaibles to be used together as input.
    """

    variables: typing.List[PluginVariable] = []
    """
    The variables contained in the group
    """

    def __init__(self, id: str, variables: typing.List[PluginVariable]) -> None:
        """
        Initialize a VariableGroup

        :param id: The ID of the variable group (must be unique).
        :param variables: The list of variables in the group.
        """

        self.id = id
        """
        The id of the input group
        """

        self.variables = variables
        """
        The variables contained in the input group
        """

    def toDict(self):
        """
        Converts the variable group to a dictionary.
        """

        groupDict = {"id": self.id, "variables": [var.toDict() for var in self.variables]}

        return groupDict


class PluginBlockTypes(str, Enum):
    """
    The different types of blocks.
    """

    BASE = "base"
    """
    A regular block.
    """

    INPUT = "input"
    """
    A block that can be used as input.
    """

    ACTION = "action"
    """
    A block that runs an action.
    """

    SLURM = "slurm"
    """
    A block that runs an action on a Slurm queue.
    """

    CONFIG = "config"
    """
    A block designed to store configuration variables.
    """

    def __str__(self):
        return self.value


class BlockVarPair:
    """
    A connection of a block for a given variable of that block.
    """

    def __init__(self, blockPlacedID: int, blockID: str, variableID: str):
        self.blockPlacedID = blockPlacedID
        self.blockID = blockID
        self.variableID = variableID

    def _toDict(self):
        """
        Converts the connection to a dictionary.
        """

        pairDict = {
            "placedID": self.blockPlacedID,
            "blockID": self.blockID,
            "variableID": self.variableID,
        }

        return pairDict

    def __str__(self):
        return json.dumps(self._toDict(), indent=4)


class BlockConnection:
    """
    A connection between blocks and variables.
    """

    def __init__(
        self,
        origin: BlockVarPair,
        destination: BlockVarPair,
        isCyclic: bool,
        cycles: int = 0,
    ):
        self.origin = origin
        self.destination = destination
        self.isCyclic = isCyclic
        self.cycles = cycles

    def _toDict(self):
        """
        Converts the connection to a dictionary.
        """

        connectionDict = {
            "origin": self.origin._toDict(),  # pylint: disable=protected-access
            "destination": (self.destination._toDict()),  # pylint: disable=protected-access
            "isCyclic": self.isCyclic,
            "cycles": self.cycles,
        }

        return connectionDict

    def __str__(self):
        return json.dumps(self._toDict(), indent=4)


class PluginBlock:
    """
    The base block class for Horus blocks. Not to be used directly.
    """

    # Internal variables, used when saving the flow and in the frontend
    _position: typing.List[float] = [0, 0]
    _isPlaced: bool = False
    _isRunning: bool = False
    _runError: bool = False
    _placedID: typing.Optional[int] = 0
    _finishedExecution: bool = False
    _storedOutputs: dict[str, typing.Any] = {}
    _variableConnections: typing.List[BlockConnection] = []
    _variableConnectionsReferences: typing.List[BlockConnection] = []
    _connectedTo: typing.List[int] = []
    _connectedToReferences: typing.List[int] = []

    selectedInputGroup: str = "default"
    """
    The ID of the selected input group. This gets updated when the user
    selects a different input group in the frontend.
    """

    def __init__(  # pylint: disable=dangerous-default-value
        self,
        name: str,
        description: str,
        action: typing.Optional[typing.Callable] = None,
        variables: typing.List[PluginVariable] = [],
        inputs: typing.List[PluginVariable] = [],
        inputGroups: typing.List[VariableGroup] = [],
        outputs: typing.List[PluginVariable] = [],
        blockType: PluginBlockTypes = PluginBlockTypes.BASE,
    ):
        self.id: str = "baseplugin.block"  # pylint: disable=invalid-name
        """
        The id of the block.
        It is composed by the plugin name and the name of the block.
        The addBlock() method of the Plugin class will automatically
        assign the id to the block.
        """

        self.name = name
        """
        The name of the block.
        """

        self.description = description
        """
        A description of the block.
        """

        self.action = action
        """
        The action that the block performs.
        """

        self._variables = variables
        """
        Variables that can be used in the Block action
        """

        self._outputs = outputs
        """
        The output that the block produces as a list of PluginVariables.
        This information will be displayed in the flow builder.
        The produced output can be used in the following blocks as input.
        """

        if len(inputs) > 0 and len(inputGroups) > 0:
            raise Exception(  # pylint: disable=broad-exception-raised
                "A block can only have inputs or input groups, not both."
            )

        if len(inputs) >= 0 and len(inputGroups) == 0:
            inputGroups = [VariableGroup("default", inputs)]

        # self._inputs = inputs
        # """
        # The input that the block receives as a list of PluginVariables.
        # This information will be displayed in the flow builder.
        # The input can be used in the block action.
        # """

        if len(inputGroups) > 0:
            self.selectedInputGroup = inputGroups[0].id

        self._inputGroups: typing.Dict[str, VariableGroup] = {}
        """
        The input groups that the block receives as a list of VariableGroups.
        The different groups will be showed as scrollable pages in the block inputs.
        The input group's ID can be used in the block action to know which grup the user is using.
        The inputs can be used in the block action.

        It is a dictionary with the ID of the group as key and the VariableGroup as value.
        """

        for ig in inputGroups:
            self._inputGroups[ig.id] = ig

        self._configs: typing.List[PluginConfig] = []
        """
        Configs that can be used to configure the block.

        Allowed type: PluginConfig
        """

        if blockType not in (PluginBlockTypes):
            raise Exception(  # pylint: disable=broad-exception-raised
                f"Invalid block type {blockType}. Allowed types: {PluginBlockTypes}"
            )

        self.TYPE: PluginBlockTypes = blockType  # pylint: disable=invalid-name
        """
        The type of the block. Internal use only.
        """

    # Define the call method to run the block
    def __call__(self, *args, **kwargs):
        if self.action is None:
            print("WARNING: No action defined for block", self.name)
        else:
            # Run the action
            self.action(self, *args, **kwargs)

        # Get the updated output as dictionary
        return self.outputs

    def _updateVariables(self, values: dict):
        """
        Updates the values of the variables of the block.

        :param values: A dictionary with the values to update
        (JSON coming from frontend).
        """
        for variable in self._variables:
            if variable.id in values.keys():
                variable.value = values[variable.id]

    def _updateInputs(self, values: dict):
        """
        Updates the values of the inputs of the block.

        :param values: A dictionary with the values to update
        (JSON coming from frontend).
        """
        try:
            inputs = self._inputGroups[self.selectedInputGroup].variables
        except KeyError as keye:
            raise Exception(
                f"Input group {self.selectedInputGroup} not found in block inputs. Current block inputs are: {self._inputGroups.keys()}"
            ) from keye
        for variable in inputs:
            if variable.id in values.keys():
                variable.value = values[variable.id]

    def _getVariables(self):
        """
        Returns a list of the variables of the block.
        """
        return self._variables

    @property
    def variables(self):
        varsDict: dict[str, typing.Any] = {}
        for variable in self._variables:
            varsDict[variable.id] = variable.value
        return varsDict

    @property
    def inputs(self):
        varsDict: dict[str, typing.Any] = {}
        try:
            inputs = self._inputGroups[self.selectedInputGroup].variables
        except KeyError as keye:
            raise Exception(
                f"Input group {self.selectedInputGroup} not found in block inputs. Current block inputs are: {self._inputGroups.keys()}"
            ) from keye
        for variable in inputs:
            varsDict[variable.id] = variable.value
        return varsDict

    @property
    def outputs(self):
        varsDict: dict[str, typing.Any] = {}
        for variable in self._outputs:
            varsDict[variable.id] = variable.value
        return varsDict

    def setOutput(self, id: str, value: typing.Any):
        """
        Sets the value of an output variable.

        :param id: The id of the output variable.
        :param value: The value to set.
        """
        for variable in self._outputs:
            if variable.id == id:
                variable.value = value
                return
        raise Exception(f"Output {id} not found.")

    def _getConfig(self, id: str):
        """
        Returns a config by its ID.

        :param id: The ID of the config.
        """
        for config in self._configs:
            if config.id == id:
                return config
        raise Exception(f"Config {id} not found.")

    def _getConfigs(self):
        return self._configs

    @property
    def configs(self):
        configsDict: dict[str, typing.Any] = {}
        for config in self._configs:
            for var in config._getVariables():
                configsDict[var.id] = var.value
        return configsDict

    def addConfig(self, config: PluginConfig):
        """
        Adds a PluginConfig to the plugin.
        """

        # If the attribute is a PluginConfig, add it to the list
        # Only add the config if it is not already in the list
        if isinstance(config, PluginConfig):
            config.id = f"{self.id}.{config.name}".replace(" ", "_").lower()
            try:
                self._getConfig(config.id)
            except Exception:
                self._configs.append(config)

    def _updateConfigs(self, configPath: str):
        """
        Updates the values of the configs of the block.
        From the config JSON file.
        """

        # Read the config file
        with open(configPath, "r") as configFile:
            configs = json.load(configFile)

        # Update the values of the configs
        for config in self._configs:
            for var in config._getVariables():
                if var.id in configs.keys():
                    var.value = configs[var.id]

    def _createConfig(self, configPath: str):
        """
        Creates the config file for the block.
        """
        # Create the config file only if the block has configs

        if len(self._configs) > 0:
            # Create the config file
            print("Creating config file for block", self.name, "at", configPath)
            with open(configPath, "w") as configFile:
                configs = {}
                for config in self._configs:
                    configs[config.id] = config.variables
                json.dump(self.configs, configFile, indent=4)

    def _saveConfig(self, configPath: str, valuesToSave: dict[str, str]):
        """
        Saves the config file for the block with new values.
        """
        # Save the config file only if the block has configs
        if len(self._configs) > 0:
            # Read the existing config file
            with open(configPath, "r") as configFile:
                configs = json.load(configFile)

            # Update the values to save
            for key, value in valuesToSave.items():
                configs[key] = value

            # Write the updated config file
            with open(configPath, "w") as configFile:
                json.dump(configs, configFile, indent=4)

        # Update the values of the configs
        self._updateConfigs(configPath)

    def _connectionsToDict(self, references: bool = False):
        """
        Converts the connections of the block to a dictionary.
        """
        connections: typing.List[typing.Dict[str, typing.Any]] = []
        if references:
            for connection in self._variableConnectionsReferences:
                connections.append(connection._toDict())  # pylint: disable=protected-access
        else:
            for connection in self._variableConnections:
                connections.append(connection._toDict())  # pylint: disable=protected-access

        return connections

    def _toDict(self):
        """
        Converts the block to a dictionary.
        """

        blockDict = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "variables": self._variablesToDict(self._variables),
            "inputs": self._inputGroupsToDict(self._inputGroups),
            "outputs": self._variablesToDict(self._outputs),
            "config": self._configToDict(),
            "type": str(self.TYPE),
            "position": {"x": self._position[0], "y": self._position[1]},
            "isPlaced": self._isPlaced,
            "isRunning": self._isRunning,
            "runError": self._runError,
            "placedID": self._placedID,
            "finishedExecution": self._finishedExecution,
            "storedOutputs": self._storedOutputs,
            "variableConnections": self._connectionsToDict(),
            "variableConnectionsReference": self._connectionsToDict(references=True),
            "connectedTo": self._connectedTo,
            "connectedToReference": self._connectedToReferences,
            "selectedInputGroup": self.selectedInputGroup,
        }

        return blockDict

    def __str__(self):
        return json.dumps(self._toDict(), indent=4)

    def _variablesToDict(self, vars: typing.List[PluginVariable], minimal: bool = False):
        varList: list[dict[str, typing.Any]] = []
        for v in vars:
            varList.append(v.toDict(minimal=minimal))
        return varList

    def _inputGroupsToDict(self, inputGroups: typing.Dict[str, VariableGroup]):
        inputGroupsList: list[dict[str, typing.Any]] = []
        for k, v in inputGroups.items():
            inputGroupsList.append(v.toDict())
        return inputGroupsList

    def _configToDict(self):
        configList: list[dict[str, typing.Any]] = []
        for c in self._getConfigs():
            configList.append(c._toDict())
        return configList

    _isOriginal = True
    """
    Wether the block is original (created by the plugin) or not.
    """

    remote: PluginRemote
    """
    The RemoteAPI for the block.
    """

    def _setRemote(self, remote):
        """
        Sets the remote of the block.
        """
        if self._isOriginal:
            msg = (
                "\033[31mERROR: Setting remote on original block is not allowed. "
                + "This can lead to unexpected behaviour. Remember to "
                + "copy the block using block.copy() if you want to use it "
                + "in the pipeline.\033[0m"
            )
            print(msg)
            raise Exception(msg)  # pylint: disable=broad-exception-raised
        self.remote = PluginRemote(remote)

    def copy(self):
        """
        Returns a deep copy of the block in order to not
        modify the original reference.
        """
        copy = deepcopy(self)
        copy._isOriginal = False  # pylint: disable=protected-access
        return copy

    def _parseInternalVariables(self, blockJSON: typing.Dict[str, typing.Any]):
        """
        Updates the block with the internal variables.
        """

        isPlaced: bool = blockJSON.get("isPlaced", False)
        isRunning: bool = blockJSON.get("isRunning", False)
        runError: bool = blockJSON.get("runError", False)
        placedID: int = blockJSON.get("placedID", 0)
        finishedExecution: bool = blockJSON.get("finishedExecution", True)
        selectedInputGroup: str = blockJSON.get("selectedInputGroup", "default")

        position: typing.Dict[str, float] = blockJSON.get("position", [None, None])
        xPos: float = position.get("x", 0)
        yPos: float = position.get("y", 0)

        storedOutputs: typing.Dict[str, str] = blockJSON.get("storedOutputs", None)

        variableConnections: typing.List[typing.Dict[str, typing.Any]] = blockJSON.get(
            "variableConnections", []
        )
        variableConnectionsReference: typing.List[typing.Dict[str, typing.Any]] = blockJSON.get(
            "variableConnectionsReference", []
        )

        connectedTo: typing.List[int] = blockJSON.get("connectedTo", [])
        connectedToReference: typing.List[int] = blockJSON.get("connectedToReference", [])

        def parseVariableConnection(connection: typing.Dict[str, typing.Any]):
            origin = connection.get("origin", None)
            destination = connection.get("destination", None)
            isCyclic = connection.get("isCyclic", False)
            cycles = connection.get("cycles", 0)

            if origin is None or destination is None:
                raise Exception("Invalid flow object.")  # pylint: disable=broad-exception-raised

            originPlacedID = origin.get("placedID", None)
            originBlockID = origin.get("blockID", None)
            originVariableID = origin.get("variableID", None)
            originPair = BlockVarPair(originPlacedID, originBlockID, originVariableID)

            destinationPlacedID = destination.get("placedID", None)
            destinationBlockID = destination.get("blockID", None)
            destinationVariableID = destination.get("variableID", None)
            destinationPair = BlockVarPair(
                destinationPlacedID, destinationBlockID, destinationVariableID
            )

            return BlockConnection(originPair, destinationPair, isCyclic, cycles)

        # Parse the variableConnections
        parsedVariableConnections: typing.List[BlockConnection] = []
        for connection in variableConnections:
            parsedVariableConnections.append(parseVariableConnection(connection))

        # Parse the variableConnectionsReference
        parsedVariableConnectionsReference: typing.List[BlockConnection] = []
        for connection in variableConnectionsReference:
            parsedVariableConnectionsReference.append(parseVariableConnection(connection))

        # Parse the variable values
        variablesJSON = blockJSON.get("variables", {})
        variablesJSONParsed = {}
        for variable in variablesJSON:
            varID = variable.get("id", None)
            if varID is None:
                raise Exception("Invalid flow object.")  # pylint: disable=broad-exception-raised
            variablesJSONParsed[varID] = variable.get("value", None)

        # Update the variables with the values the user has set
        self.selectedInputGroup = selectedInputGroup
        self._updateVariables(variablesJSONParsed)

        # Update the internal variables
        self._isPlaced = isPlaced
        self._isRunning = isRunning
        self._runError = runError
        self._position = [xPos, yPos]
        self._placedID = placedID
        self._finishedExecution = finishedExecution
        self._storedOutputs = storedOutputs
        self._variableConnections = parsedVariableConnections
        self._variableConnectionsReferences = parsedVariableConnectionsReference
        self._connectedTo = connectedTo
        self._connectedToReferences = connectedToReference

    def _minimalEncode(self):
        """
        Encode only the blockID and the internal variables.
        """

        blockDict = {
            "id": self.id,
            "isPlaced": self._isPlaced,
            "position": {"x": self._position[0], "y": self._position[1]},
            "isRunning": self._isRunning,
            "runError": self._runError,
            "placedID": self._placedID,
            "finishedExecution": self._finishedExecution,
            "storedOutputs": self._storedOutputs,
            "variables": self._variablesToDict(self._variables, minimal=True),
            "variableConnections": self._connectionsToDict(),
            "variableConnectionsReference": self._connectionsToDict(True),
            "connectedTo": self._connectedTo,
            "connectedToReference": self._connectedToReferences,
            "selectedInputGroup": self.selectedInputGroup,
        }

        return blockDict


class PluginConfig(PluginBlock):
    """
    The PluginConfig class is a special type of block that is used to configure
    the plugin. It is not meant to be used in the pipeline. It works as a regular
    PluginBlock but it is shown only in the configuration page of the plugin.
    Its variables will be stored once set, and can be accessed by the Block actions
    using the block.configs["variable_id"] syntax.
    """

    def __init__(  # pylint: disable=dangerous-default-value
        self,
        name,
        description,
        action: typing.Optional[typing.Callable] = None,
        variables: typing.List[PluginVariable] = [],
    ):
        """
        :param name: The name of the block.
        :param description: The description of the block.
        :param action: The action of the block. Will be run when storing the config.
        :param variables: The variables of the block.
        """
        # Raise an error if the variables are empty
        if len(variables) == 0:
            raise Exception(  # pylint: disable=broad-exception-raised
                "A PluginConfig must have at least one variable."
            )

        super().__init__(name, description, action, variables, blockType=PluginBlockTypes.CONFIG)


class InputBlock(PluginBlock):
    """
    The InputBlock class is a special type of block that is used to get input from
    the user. It works as a regular PluginBlock but only shows its PluginVariable.
    Its output will be automatically set to the value the variable has if it does
    not have a defined action.
    """

    def __init__(
        self,
        name,
        description,
        variable: PluginVariable,
        action: typing.Optional[typing.Callable] = None,
    ):
        """
        :param name: The name of the block.
        :param description: The description of the block.
        :param variable: The variable of the block.
        """

        # Check that the variable is a PluginVariable instance
        if not isinstance(variable, PluginVariable):
            raise Exception(  # pylint: disable=broad-exception-raised
                "The variable must be a single PluginVariable instance."
            )

        super().__init__(
            name,
            description,
            action=action,
            variables=[variable],
            inputs=[variable],
            outputs=[variable],
            blockType=PluginBlockTypes.INPUT,
        )

    # Override the __call__ method to return
    # the value of the variable as the output
    def __call__(self, *args, **kwargs):
        # If the block has an action, run it
        if self.action is not None:
            return super().__call__(*args, **kwargs)

        # If the block does not have an action, return the value of the variable
        self._outputs[0].value = self._variables[0].value

        return self.outputs


class SlurmBlock(PluginBlock):
    """
    The SlurmBlock class is a special type of block that is used to run an action
    in a remote server. It works as a regular PluginBlock but it has two actions,
    one before the job is submitted and one after the job is completed.
    """

    def __init__(  # pylint: disable=dangerous-default-value
        self,
        name: str,
        description: str,
        initialAction: typing.Callable,
        finalAction: typing.Callable,
        variables: typing.List[PluginVariable] = [],
        inputs: typing.List[PluginVariable] = [],
        inputGroups: typing.List[VariableGroup] = [],
        outputs: typing.List[PluginVariable] = [],
    ):
        """
        :param name: The name of the block.
        :param description: The description of the block.
        :param initialAction: The action of the block before the job is submitted.
        :param finalAction: The action of the block after the job is completed.
        :param variables: The variables of the block.
        :param inputs: The inputs of the block.
        :param inputGroups: The input groups of the block.
        :param outputs: The outputs of the block.
        """
        super().__init__(
            name,
            description,
            action=initialAction,
            variables=variables,
            inputs=inputs,
            inputGroups=inputGroups,
            outputs=outputs,
            blockType=PluginBlockTypes.SLURM,
        )
        self.initalAction = initialAction
        self.finalAction = finalAction

    def __call__(self, *args, **kwargs):
        # If the block has not submitted the job, run the first action
        # If the job has been submitted, han has ended, run the second action
        try:
            if self.remote._remote.didRemoteBlockFinish():
                self.action = self.finalAction
            else:
                return
        except Exception:
            # If the JobID is not found (maybe cleared because a re-run is
            # required by the user) set the action to the initial action
            self.action = self.initalAction

        return super().__call__(*args, **kwargs)


class Plugin:
    """
    Base class for all plugins.
    """

    info: dict[str, typing.Any] = {
        "name": "Unnamed plugin",
        "version": "0.0.1",
        "author": "None",
        "description": "None",
        "dependencies": ["None"],
    }

    def __init__(self, id: str):
        """
        Initializes the plugin.

        :param id: The id of the plugin.
        """

        self._filename: str = ""
        """
        The filename of the plugin. Internal use only.
        """

        self._path: str = ""
        """
        The path of the plugin folder. Internal use only.
        """

        self.actions: typing.Optional[typing.List[typing.Callable]] = None
        """
        Functions that can be called from the GUI.
        WIP
        """

        self.views = []
        """
        Views that can be loaded from the GUI.
        Should be the path to the HTML file.
        """

        self._blocks: typing.List[PluginBlock] = []
        """
        Blocks that can be used in the GUI flow editor.

        Allowed type: PluginBlock
        """

        self._pages: typing.List[PluginPage] = []
        """
        Pages that can be loaded from the GUI.

        Allowed type: PluginPage
        """

        # Set the id of the plugin
        self.id = id.lower().replace(" ", "_")

        # Add all the blocks present in the subclass to the list of blocks
        self._addBlocks()

        # Same for pages
        self._addPages()

    # Define comparison operators
    def __eq__(self, other):
        if isinstance(other, Plugin):
            return self.info["name"] == other.info["name"]
        return False

    def __ne__(self, other):
        return not self.__eq__(other)

    # Define the str function to print(plugin)
    def __str__(self):
        return self.info["name"]

    def loadPluginMeta(self):
        """
        Loads the information about the plugin from the plugin.meta file.

        - name: The name of the plugin
        - version: The version of the plugin
        - author: The author of the plugin
        - description: A description of the plugin
        - dependencies: A list of dependencies of the plugin
        """

        metaPath = os.path.join(self._path, "plugin.meta")
        if os.path.exists(metaPath):
            with open(metaPath, "r") as metaFile:
                self.info = json.load(metaFile)
        else:
            raise Exception("plugin.meta file not found.")

    # Function to get a block by its ID
    def getBlock(self, id):
        """
        Returns a block by its ID.

        :param id: The ID of the block.
        """
        for block in self._blocks:
            if block.id == id:
                return block
        raise Exception(f"Block {id} not found.")

    def getBlocks(self):
        return self._blocks

    # Define the .blocks property to the getBlocks function
    @property
    def blocks(self):
        return self.getBlocks()

    def addBlock(self, block: PluginBlock):
        """
        Adds a PluginBlock to the plugin.
        """

        # If the attribute is a PluginBlock (not PluginConfig), add it to the list
        # Only add the block if it is not already in the list
        if isinstance(block, PluginBlock) and not isinstance(block, PluginConfig):
            block.id = f"{self.id}.{block.name}".replace(" ", "_").lower()
            try:
                self.getBlock(block.id)
            except Exception:
                # Assign to the configs in the block the ID
                for config in block._getConfigs():
                    config.id = f"{block.id}.config.{config.name}".replace(" ", "_").lower()

                self._blocks.append(block)

    def _addBlocks(self):
        # Search for all the properties of the instance
        # Check if the property is a PluginBlock
        # If it is, add it to the list of blocks
        for attr in dir(self):
            # Get the attribute
            attr = getattr(self, attr)

            # Add the block to the list of blocks
            self.addBlock(attr)

    def getPage(self, id):
        """
        Returns a page by its ID.

        :param id: The ID of the page.
        """
        for page in self._pages:
            if page.id == id:
                return page
        raise Exception(f"Page {id} not found.")

    def getPages(self):
        return self._pages

    @property
    def pages(self):
        return self.getPages()

    def addPage(self, page: PluginPage):
        """
        Adds a PluginPage to the plugin.
        """

        # If the attribute is a PluginPage, add it to the list
        # Only add the page if it is not already in the list
        if isinstance(page, PluginPage):
            page.id = f"{self.id}.{page.id}".replace(" ", "_").lower()
            try:
                self.getPage(page.id)
            except Exception:
                self._pages.append(page)

    def _addPages(self):
        # Search for all the properties of the instance
        # Check if the property is a PluginPage
        # If it is, add it to the list of pages
        for attr in dir(self):
            # Get the attribute
            attr = getattr(self, attr)

            # Add the page to the list of pages
            self.addPage(attr)

    @property
    def _flows(self):
        """
        Returns a list of the flows contained
        in the 'flows' folder of the plugin.

        Internal use only.
        """

        # Get a list of the *.flow files in the flows folder
        flowsDir = os.path.join(self._path, "Flows")

        # If the flows folder does not exist, no flows are present
        if not os.path.exists(flowsDir):
            return []

        # Get the list of flows
        flows = []
        for file in os.listdir(flowsDir):
            if file.endswith(".flow"):
                # Get the path of the flow file
                filePath = os.path.join(flowsDir, file)

                # Read the flow file to get the name of the flow
                flowName = "Unnamed flow"
                savedID = "flow_id"
                with open(filePath, "r", encoding="utf-8") as flowFile:
                    try:
                        flow = json.load(flowFile)
                    except Exception as exc:
                        logging.getLogger("Horus").error("Error loading flow %s: %s", file, exc)
                        continue

                    flowName = flow.get("name", "Unnamed flow")
                    savedID = flow.get("savedID", "flow_id")

                # Add the flow to the list
                flowInfo = {
                    "name": flowName,
                    "path": filePath,
                    "plugin_id": self.id,
                    "plugin_name": self.info["name"],
                    "savedID": savedID,
                }
                flows.append(flowInfo)

        return flows
