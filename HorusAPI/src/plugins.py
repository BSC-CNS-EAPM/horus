from __future__ import annotations
import typing
import json
import os
import time
from enum import Enum
from copy import deepcopy
import contextlib
import logging
import re
import base64
import shutil
from typing import Any, Dict, List

from pydantic import (  # pylint: disable=no-name-in-module. # Somehow pylint does not recognize BaseModel
    BaseModel,
)

from .utils import ResetRemoteException

if typing.TYPE_CHECKING:
    from Server.FlowManager import Flow


class PluginRemote:
    """
    Remote interface for blocks
    """

    def __init__(self, remote) -> None:
        self._remote = remote
        self.cd = self._remote.cd

    def remoteCommand(self, command: str):
        """
        Executes a command on the remote.
        The output of the command will be returned.

        :param command: The command to execute.
        """
        output = self._remote.command(command)

        return output

    def sendData(self, source: str, destination: str) -> str:
        """
        Sends a file to the remote.
        :param file: The path to the file to send.

        :return: The final absolute path to the uploaded file.
        """

        # Fix the ~ in the remote path (https://github.com/fabric/fabric/issues/2228)

        if "~" in destination:
            destination = destination.replace("~", self.userHome)

        return self._remote.transferTo(source, destination)

    def getData(self, source: str, destination: str) -> str:
        """
        Gets a file from the remote.
        :param file: The path to the file to get.

        :return: The final absolute path to the downloaded file.
        """

        # Fix the ~ in the remote path
        if "~" in source:
            source = source.replace("~", self.userHome)

        return self._remote.transferFrom(source, destination)

    def submitJob(self, script: str, changeDir: bool = True) -> int:
        """
        Submit a slurm job to the queue system of the cluster (SLURM)

        :param script: The  absolute path to the script to submit.
        :param: changeDir: automatically cd to the container folder of the script. \
        Disable this if using the cd context manager or for specific cases.

        :return: The job ID.
        """

        return self._remote.submitJob(script, changeDir)

    @contextlib.contextmanager
    def cd(self, path: str):  # pylint: disable=E0202
        """
        Context manager to change directory on the remote.

        Works with the remoteCommand, submitJob and send/get data functions.
        """

        return self._remote.cd(path)

    @property
    def userHome(self) -> str:
        """
        Returns the expanded user home directory.
        """

        return self._remote.userHome

    @property
    def workDir(self) -> str:
        """
        Returns the Horus directory on the remote.
        If on local, returns the flow directory.
        """

        return self._remote.workDir

    @property
    def name(self) -> str:
        """
        Returns the name of the remote.
        """

        return self._remote.name

    @property
    def host(self) -> str:
        """
        Returns the host adress of the remote.
        """

        return self._remote.host

    @property
    def isLocal(self) -> bool:
        """
        Returns whether the remote is local or not
        """

        return self._remote.name == "Local"


class PluginEndpoint:
    """
    Endpoints for plugin pages.
    """

    def __init__(self, url: str, methods: typing.List[str], function: typing.Callable):
        """
        Create a new PluginEndpoint.

        :param url: The URL of the endpoint.
        :param method: The method of the endpoint.
        :param function: The function that will be called when the endpoint is accessed.
        """
        self.url = url
        self.methods = methods
        self.function = function


class PluginPage:
    """
    Class that defines a page that can be accessed from the extension menu.
    """

    endpoints: typing.List[PluginEndpoint]
    """
    The endpoints of the page.
    """

    _pageInfo: typing.Dict[str, typing.Any]
    """
    Internal variable used to store the page info.
    """

    def __init__(self, id: str, name: str, description: str, html: str, hidden: bool = False):
        """
        Create a new PluginPage.

        :param id: The ID of the page.
        :param name: The name of the page.
        :param description: A description of the page.
        :param html: The name of the HTML file (i.e. "my_page.html"). \
        The html file must be located in the "Pages" folder of the plugin.
        :param hidden: Whether the page should be hidden from the extension menu (default: False).
        """
        self.id = id
        self.name = name
        self.description = description
        self.html = html
        self.hidden = hidden

        # Initialize instance-specific variables
        self.endpoints = []
        self._pageInfo = {}

    def addEndpoint(self, endpoint: PluginEndpoint):
        """
        Add an endpoint to the page.

        Define endpoints that the plugin can access from the defined pages. \
        The endpoint URL should be defined as a string, for example: "/my_endpoint". \
        Later, Horus will add the endpoint in the following format: \
        "/plugins/pages/<pluginID>.<pageID>/my_endpoint". \
        Therefore, remember to perform any GET or POST request to that endpoint. \
        You can use 'window.location' in JS to get the current URL.

        Note: pluginID and pageID are always lowercase.

        :param endpoint: The endpoint to add.
        """
        self.endpoints.append(endpoint)


class VariableTypes(str, Enum):
    """
    The types of variables.
    """

    ANY = "any"
    """
    Any type of variable.

    This type of variable will not render anything, as it is meant to be used
    as a connection between blocks.
    """

    STRING = "string"
    """
    A regular string like "Hello world".

    Will render as a text input.
    """

    TEXT_AREA = "text_area"
    """
    A large text like a paragraph, can contain multiple lines. like "Hello world \n Hello planet".
    
    Will render as a text input.
    """

    NUMBER = "number"
    """
    A number like 1, 2.5, 3.1415...

    Will render as a number input with increment/decrement buttons.
    """

    INTEGER = "integer"
    """
    An integer number like 1, 2, 3...

    Will render as a number input with increment/decrement buttons. Accepts only integers.
    """

    FLOAT = "float"
    """
    A floating point number like 1.0, 2.5, 3.1415...

    Will render as a number input with increment/decrement buttons. Accepts only floats.
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

    NUMBER_LIST = "number[]"
    """
    A list of numbers like [1, 2.4, 3.1415].

    Will render as a dropdown.
    """

    NUMBER_RANGE = "[number, number, number]"
    """
    A range of numbers like 1-10.

    Can be made an Integer range or a Float range depending on the step.

    Will render as a slider.
    Use allowedValues to define: [min, max, step].
    - The first number in the list is the minimum value.
    - The second number in the list is the maximum value.
    - The third number in the list is the step.
    """

    CONSTRAINED_NUMBER_RANGE = "[number, number, number, constrain]"
    """
    A range of numbers like 1-10.

    Can be made an Integer range or a Float range depending on the step.

    Will render as a slider with tho dragging handles. Used to define
    a range between to points.
    Use allowedValues to define: [min, max, step].
    - The first number in the list is the minimum value.
    - The second number in the list is the maximum value.
    - The third number in the list is the step.

    Will return two numbers, one for each handle.
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

    MULTIPLE_STRUCTURE = "multiple_structure"
    """
    Multiple molecular structures to be selected from Mol*.

    Will render as a list of checkboxes with the list of loaded structures.
    The type of the variable will be a list of dicts with the following data:
    - id: The ID of the structure.
    - name: The name of the structure.
    - type: The type of the structure (CIF, PDB...).
    - structure: The structure file contents (CIF, PDB... string)
    """

    STRUCTURE = "structure"
    """
    A single molecular structure to be selected from Mol*.

    Will render as a list of radio buttons with the list of loaded structures.
    The type of the variable will be a dict with the following data:
    - id: The ID of the structure.
    - name: The name of the structure.
    - type: The type of the structure (CIF, PDB...).
    - structure: The structure file contents (CIF, PDB... string)
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

    RESIDUE = "residue"
    """
    A residue to be selected from a loaded structure. Either a standard or non-standard residue.
    """

    ATOM = "atom"
    """
    An atom to be selected from a loaded structure.

    Will enable ball-and-stick visualization in Mol* to select the atom.
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
    BOX = "box"
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
    A list of molecule SMILES strings.

    Will use the loaded molecules in the JSME viewer (https://jsme-editor.github.io/)
    """

    _GROUP = "group"
    """
    DO NOT USE IN PluginVariable class. 
    VariableGroup will be automatically converted to a group of variables.
    """

    LIST = "list"
    """
    VariableList will be automatically converted to a list of variables.

    Will render as a table with an input field and an add button. 
    """

    _LIST = "_list"
    """
    DO NOT USE IN PluginVariable class.
    """

    OBJECT = "object"
    """
    An object variable. This will be rendered as a code editor.
    The resulting value will be a python dictionary.
    Must be JSON serializable.
    """

    CODE = "code"
    """
    A code variable. This will be rendered as a code editor.
    The resulting value will be a code snippet as a string.

    You can select the language of the code with the allowedValues parameter.
    For example, for python:

    allowedValues = ["python"]
    """

    CUSTOM = "custom"
    """
    A custom variable. It can contain any type of data but allows connections
    only from other custom variables that contain the same strings inside
    the allowedValues list. Just like ANY, it will not render any input field.

    For example, a custom variable with allowedValues = ["A", "B", "C"]
    can be connected to another custom variable with allowedValues = ["B"]
    """

    RADIO = "radio"
    """
    A radio variable. It will render as a list of radio buttons.
    Only one can be selected at a time.
    
    Setup the allowedValues parameter to define the list of options such as
    ["A", "B", "C"].
    """

    CHECKBOX = "checkbox"
    """
    A checkbox variable. It will render as a list of checkboxes.
    Multiple can be selected at the same time.
    
    Setup the allowedValues parameter to define the list of options such as
    ["A", "B", "C"].
    """

    @staticmethod
    def getTypes():
        """
        Returns a list of all the available types.
        """
        types = []
        for attrName in dir(VariableTypes):
            attr = getattr(VariableTypes, attrName)
            if not callable(attr) and not attrName.startswith("__"):
                types.append(attr)

        return types

    # Make the object JSON serializable
    def __str__(self):
        return self.value

    def __repr__(self):
        return self.value

    def __eq__(self, other):

        if isinstance(other, VariableTypes):
            return self.value == other.value

        return self.value == other

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
        category: typing.Optional[str] = None,
        disabled: bool = False,
        required: bool = False,
        placeholder: typing.Optional[str] = None,
    ):
        """
        :param name: The name of the variable.
        :param description: A description of the variable.
        :param type: The type of the variable. Assign it using the VariableTypes class.
        :param defaultValue: The default value of the variable.
        :param id: The ID of the variable.
        :param allowedValues: A list of allowed values for the variable.
        :param disabled: Whether the variable is disabled or not
        :param required: Whether the variable is required or not.
        This will show the variable in orange when not connected.
        :param placeholder: The placeholder of the input field.
        """
        self.name = name
        self.description = description
        self.type = type
        self.disabled = disabled
        self.required = required
        self.placeholder = placeholder

        if type not in VariableTypes.getTypes():
            raise Exception(f"Invalid type {type}.")

        if type == VariableTypes._GROUP and not isinstance(self, VariableGroup):
            raise Exception(
                "You cannot use VariableTypes._GROUP in PluginVariable. "
                + "Use VariableGroup class instead. "
                + f"(While loading variable ID: {id}, name: {name}, description: {description})"
            )

        if isinstance(allowedValues, list) and len(allowedValues) == 0:
            allowedValues = None

        # Assign a default category if none is provided
        self.category = category if category else "General"
        self.defaultValue = defaultValue
        self.value = defaultValue
        self.id = id
        self.allowedValues = allowedValues

    def toDict(self, minimal: bool = False):
        """
        Convert the variable to a dictionary.
        """

        varDict = {
            "id": self.id,
            "value": self.value if self.value is not None else self.defaultValue,
            "type": str(self.type),
        }

        if not minimal:
            varDict["name"] = self.name
            varDict["category"] = self.category
            varDict["description"] = self.description
            varDict["allowedValues"] = self.allowedValues
            varDict["disabled"] = self.disabled
            varDict["required"] = self.required
            varDict["placeholder"] = self.placeholder

        return varDict

    def __str__(self):
        return json.dumps(self.toDict(), indent=4)


class CustomVariable(PluginVariable):
    """
    Custom varialbe which supports custom view
    """

    customPage: PluginPage
    """
    The ID of the page where the variable will be rendered.
    """

    _isCustom: bool = True
    """
    Flag for the frontend to know that this is a custom variable.
    """

    def __init__(
        self,
        id: str,
        name: str,
        description: str,
        type: VariableTypes,
        customPage: PluginPage,
        defaultValue: Any | None = None,
        allowedValues: List[Any] | None = None,
        category: str | None = None,
        disabled: bool = False,
        required: bool = False,
    ):
        """
        The custom variable works like a regular variable, but it can use an extension \
        page to render a custom and complex configuration view to define the variable value. \
        The variableType attribute will work just as the regular variables counterpart.

        Inside the extension page, the variable value can be set using the following function:
        ```
        parent.horus.setVariableValue(variableID, value)
        ```
        Where variableID is the ID of the variable and value is the value to set. \
        The values must be JSON serializable.
        

        :param customPage: The page instance where the variable will be rendered.
        """
        super().__init__(
            id, name, description, type, defaultValue, allowedValues, category, disabled, required
        )
        self.customPage = customPage

    def toDict(self, minimal: bool = False):
        """
        Converts the variable to a dictionary and adds the pageID.
        """

        # Call the super method
        encodedVar = super().toDict(minimal)

        # Add the pageID
        encodedVar["isCustom"] = self._isCustom
        encodedVar["customPage"] = self.customPage._pageInfo

        return encodedVar


class VariableGroup(PluginVariable):
    """
    A group of varaibles to be used together as input.
    """

    variables: typing.List[PluginVariable] = []
    """
    The variables contained in the group
    """

    def __init__(
        self,
        id: str,  # pylint: disable=redefined-builtin
        name: str,
        description: str,
        variables: typing.List[PluginVariable],
        allowedValues: typing.Optional[typing.List[typing.Any]] = None,
        category: typing.Optional[str] = None,
        disabled: bool = False,
        required: bool = False,
    ) -> None:
        """
        Initialize a VariableGroup

        :param id: The ID of the variable group (must be unique).
        :param name: The name of the variable group.
        :param description: A description of the variable group.
        :param variables: The list of variables in the group.
        :param allowedValues: In this case, the allowed values will indicate in
        the GUI which groups can be connected (with the same allowedValues)
        :param disabled: This will set all the variables under the group as disabled
        """

        self.variables = variables
        """
        The variables contained in the variable group
        """

        super().__init__(
            id=id,
            name=name,
            description=description,
            type=VariableTypes._GROUP,
            defaultValue=None,
            allowedValues=allowedValues,
            category=category,
            disabled=disabled,
            required=required,
        )

    def toDict(self, minimal: bool = False):
        """
        Converts the variable group to a dictionary.
        """

        groupDict = super().toDict(minimal)
        groupDict["variables"] = [var.toDict(minimal) for var in self.variables]

        return groupDict

    def _updateVariablesInGroup(self, values: dict):
        """
        Update the values of the variables inside this group
        """

        for variable in self.variables:
            if variable.disabled:
                continue
            if variable.id in values.keys():
                variable.value = values[variable.id]


class VariableList(PluginVariable):
    """
    A list of the designed input variables.
    """

    def __init__(
        self,
        id: str,
        name: str,
        description: str,
        prototypes: typing.List[PluginVariable],
        allowedValues: typing.Optional[typing.List[typing.Any]] = None,
        category: typing.Optional[str] = None,
        disabled: bool = False,
        required: bool = False,
    ):
        """
        :param id: The ID of the variable.
        :param name: The name of the variable.
        :param description: A description of the variable.
        :param prototypes: The list of variables in each row of the list.
        :param allowedValues: Matching allowedValues in other variables will \
        indicate in the GUI which variables can be connected.
        :param disabled: Will set all variables under the list as disabled.
        :param required: Will set all variables under the list as required.
        """

        super().__init__(
            id=id,
            name=name,
            description=description,
            type=VariableTypes._LIST,
            defaultValue=None,
            allowedValues=allowedValues,
            category=category,
            disabled=disabled,
            required=required,
        )

        # prototypes cannot be VariableGroups
        for prot in prototypes:
            if isinstance(prot, VariableGroup):
                raise Exception(
                    f"Variable {prot.id} is a VariableGroup inside "
                    + f"{self.id}. You cannot use VariableGroups inside VariableLists."
                )

        self.prototypes = prototypes
        """
        The prototypes of the variables in the list.
        """

    def toDict(self, minimal: bool = False):
        """
        Converts the variable list to a dictionary.
        """

        listDict = super().toDict(minimal)
        listDict["variables"] = [var.toDict(minimal) for var in self.prototypes]

        return listDict

    def _updateVariablesInList(self, value: typing.Optional[list[dict]]):
        """
        Updates the variable in the list and takes care of the disabled variables
        """

        if value is None or not isinstance(value, list):
            self.value = value
            return

        # Create a set of disabled prototype IDs for faster lookup
        disabledPrototypes = {p.id: p.defaultValue for p in self.prototypes if p.disabled}

        # Replace from each value in the list, the value corresponding to the disabled variables
        parsedList = []
        for v in value:
            parsedDict = {}
            for key, variableValue in v.items():
                if key in disabledPrototypes:
                    parsedDict[key] = disabledPrototypes[key]
                else:
                    parsedDict[key] = variableValue
            parsedList.append(parsedDict)

        self.value = parsedList


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

    GHOST = "ghost"
    """
    A placeholder for a block that no longer
    exists due to a removed or modified plugin.
    """

    def __str__(self):
        return self.value


class BlockVarPair:
    """
    A connection of a block for a given variable of that block.
    """

    def __init__(
        self,
        blockPlacedID: int,
        blockID: str,
        variableID: str,
        variableType: typing.Optional[str] = None,
        variableAllowedValues: typing.Optional[typing.List[typing.Any]] = None,
    ):
        self.blockPlacedID = blockPlacedID
        self.blockID = blockID
        self.variableID = variableID
        self.variableType = variableType
        self.variableAllowedValues = variableAllowedValues

        if self.variableType is None:
            logging.getLogger("Horus").warning(
                "While opening a flow, Horus has detected that the variable "
                "connection for variable '%s' of block '%s' has no type. "
                "This can cause visual bugs on the flow editor. "
                "Please re-connect the variable and save the flow to fix this issue.",
                self.variableID,
                self.blockID,
            )

            self.variableType = VariableTypes.ANY

    def _toDict(self):
        """
        Converts the connection to a dictionary.
        """

        pairDict = {
            "placedID": self.blockPlacedID,
            "blockID": self.blockID,
            "variableID": self.variableID,
            "variableType": self.variableType,
            "variableAllowedValues": self.variableAllowedValues,
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
        cycles: int = 1,
        currentCycle: int = 0,
    ):
        self.origin = origin
        self.destination = destination
        self.isCyclic = isCyclic
        self.cycles = cycles
        self.currentCycle = currentCycle

    def _toDict(self):
        """
        Converts the connection to a dictionary.
        """

        connectionDict = {
            "origin": self.origin._toDict(),  # pylint: disable=protected-access
            "destination": (self.destination._toDict()),  # pylint: disable=protected-access
            "isCyclic": self.isCyclic,
            "cycles": self.cycles,
            "currentCycle": self.currentCycle,
        }

        return connectionDict

    def __str__(self):
        return json.dumps(self._toDict(), indent=4)

    # Define comparison operators
    def __eq__(self, other):
        return self._toDict() == other._toDict()

    def __ne__(self, other):
        return self._toDict() != other._toDict()


class BlockNotFoundError(Exception):
    """
    Exception raised when a block is not found.
    """

    def __init__(self, blockID: str):
        super().__init__(f"Block with ID '{blockID}' not found.")


class PluginBlock:
    """
    The base block class for Horus blocks. Not to be used directly.
    """

    # Internal variables, used when saving the flow and in the frontend
    _position: typing.List[float] = [0, 0]
    """
    The position of the block in the flow builder [x, y]
    """

    _isPlaced: bool = False
    """
    Whether the block is placed in the flow builder or not.
    """

    _isRunning: bool = False
    """
    Whether the block is running or not.
    """

    error: bool = False
    """
    Whether the block has an error or not.
    """

    blockLogs: str = ""
    """
    The logs of the block.
    """

    _placedID: typing.Optional[int] = 0
    """
    The ID of the block in the flow builder.
    """

    _finishedExecution: bool = False
    """
    Whether the block has finished its execution or not.
    """

    _storedOutputs: dict[str, typing.Any] = {}
    """
    The outputs of the block after it has finished its execution.
    """

    _variableConnections: typing.List[BlockConnection] = []
    """
    To which variables the block is connected to run after.
    """

    _variableConnectionsReferences: typing.List[BlockConnection] = []
    """
    Other variables that connect to this block.
    """

    selectedInputGroup: str = "default"
    """
    The ID of the selected input group. This gets updated when the user
    selects a different input group in the frontend.
    """

    selectedRemote: str = "Local"
    """
    The name of the selected remote.
    """

    _extensionsToOpen: typing.List[typing.Dict[str, typing.Any]] = []
    """
    If the flow called an extension to visualize results, it will be
    stored here to be easily opened when the flow is opened again
    """

    time: float = 0
    """
    The time that the block took to run.
    """

    extraData: typing.Dict[str, typing.Any] = {}
    """
    Extra data that the block can store.

    This data can be used to store any extra information that the block
    may need to store. For example, the folder of a remote job to be
    downloaded in the finalAction of a SlurmBlock.
    """

    flow: "Flow"
    """
    The current flow where the block is placed and being executed.

    This value is only defined withing the execution of action function of the block.

    Some properties of the flow are:
    - name: The name of the flow.
    - path: The path to the flow.
    - savedID: The unique ID of the flow.
    - blocks: The list of blocks in the flow.
    """

    pluginDir: str
    """
    The path in the local machine to the plugin installation. Useful for finding scripts and tools
    embedded with the plugin.
    """

    dirty: bool = False
    """
    Whether the block is dirty or not. When running for the first time,
    the block is not dirty. When the flow is reset, the block is not dirty.
    The block will be dirty on subsequent runs without a reset.
    """

    def _parseID(self, id: str) -> str:
        """
        Parses the ID of the block.

        The ID should only contain letters, numbers, and underscores.

        :param id: The ID of the block.
        :return: The parsed ID.
        """

        return re.sub(r"[^A-Za-z0-9]", "_", str(id).lower())

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
        id: typing.Optional[str] = None,
    ):
        """
        Initialize a PluginBlock.
        """

        if id is None:
            logging.getLogger("Horus").warning(
                "Block '%s' does not have a unique ID assigned. "
                + "The name of the block will be used instead. "
                + "For consistency, please define an ID for your block.",
                name,
            )
            id = name

        self.id: str = self._parseID(id)
        """
        The id of the block.
        It is composed by the plugin id and the id/name of the block.
        The addBlock() method of the Plugin class will automatically
        assign the plugi id part to the block id.
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

        # Check that neither variables, nor inputs, nor outputs contain nested VariableGroups
        def checkNestedVariables(variables: typing.List[PluginVariable]):
            for var in variables:
                if isinstance(var, VariableGroup):
                    for v in var.variables:
                        if isinstance(v, VariableGroup):
                            raise Exception(
                                f"Variable {v.id} is a VariableGroup inside "
                                + f"{var.id} on block {self.id}. "
                                + "You cannot use nested VariableGroups."
                            )

        checkNestedVariables(variables)
        checkNestedVariables(outputs)

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

        if len(inputs) > 0 and len(inputGroups) == 0:
            inputGroups = [VariableGroup("default", "Default", "The default input group", inputs)]

        for group in inputGroups:
            checkNestedVariables(group.variables)

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

    def __eq__(self, other):
        return self.id == other.id and self._placedID == other._placedID

    def _updateVariables(self, values: dict):
        """
        Updates the values of the variables of the block.

        :param values: A dictionary with the values to update
        (JSON coming from frontend).
        """
        for variable in self._variables:
            if variable.disabled:
                continue
            if variable.id in values.keys():
                if isinstance(variable, VariableGroup):
                    variable._updateVariablesInGroup(  # pylint: disable=protected-access
                        values[variable.id]
                    )
                elif isinstance(variable, VariableList):
                    variable._updateVariablesInList(values[variable.id])
                else:
                    variable.value = values[variable.id]

    def _updateInputs(self, values: dict):
        """
        Updates the values of the inputs of the block.

        :param values: A dictionary with the values to update
        (JSON coming from frontend).
        """
        # If the block has no inputs, return
        if len(self._inputGroups) == 0:
            return

        try:
            inputs = self._inputGroups[self.selectedInputGroup].variables
        except KeyError as keye:
            raise Exception(
                f"Input group '{self.selectedInputGroup}' not found in block inputs. "
                + f"Current block inputs are: {self._inputGroups.keys()}"
            ) from keye
        for variable in inputs:
            if variable.disabled:
                continue
            if variable.id in values.keys():
                if isinstance(variable, VariableGroup):
                    variable._updateVariablesInGroup(  # pylint: disable=protected-access
                        values[variable.id]
                    )
                elif isinstance(variable, VariableList):
                    variable._updateVariablesInList(values[variable.id])
                else:
                    variable.value = values[variable.id]

    def _getVariables(self):
        """
        Returns a list of the variables of the block.
        """
        return self._variables

    @classmethod
    def _parseVariablesForBlockAccess(
        cls, variable: PluginVariable
    ) -> typing.Union[typing.Any, dict[str, typing.Any]]:
        if isinstance(variable, VariableGroup):
            return {var.id: var.value for var in variable.variables}
        else:
            return variable.value

    @property
    def variables(self) -> dict:
        """
        The variables assigned to the block.

        :return: A dictionary with the variables of the block with key
        the variable ID and value the variable value.
        """
        varsDict: dict[str, typing.Any] = {}
        for variable in self._variables:
            varsDict[variable.id] = self._parseVariablesForBlockAccess(variable)
        return varsDict

    @property
    def inputs(self) -> dict:
        """
        The inputs assigned to the block.

        :return: A dictionary with the inputs of the block with key
        the input ID and value the input value.
        """

        if len(self._inputGroups) == 0:
            return {}

        varsDict: dict[str, typing.Any] = {}
        try:
            inputs = self._inputGroups[self.selectedInputGroup].variables
        except KeyError as keye:
            raise Exception(
                f"Input group '{self.selectedInputGroup}' not found in block inputs. "
                + f"Current block inputs are: {self._inputGroups.keys()}"
            ) from keye
        for variable in inputs:
            varsDict[variable.id] = self._parseVariablesForBlockAccess(variable)
        return varsDict

    @property
    def outputs(self) -> dict:
        """
        The outputs assigned to the block.

        :return: A dictionary with the outputs of the block with key
        the output ID and value the output value.
        """
        varsDict: dict[str, typing.Any] = {}
        for variable in self._outputs:
            varsDict[variable.id] = self._parseVariablesForBlockAccess(variable)
        return varsDict

    def setOutput(self, id: str, value: typing.Any):
        """
        Sets the value of an output variable.

        :param id: The id of the output variable.
        :param value: The value to set.
        """
        for variable in self._outputs:
            if variable.id == id:
                if variable.disabled:
                    return
                if isinstance(variable, VariableGroup):
                    variable._updateVariablesInGroup(value)
                elif isinstance(variable, VariableList):
                    variable._updateVariablesInList(value)
                else:
                    variable.value = value

                # Update the stored outputs
                self._storedOutputs[id] = value

                return
        raise Exception(f"Output {id} not found.")

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

    def __str__(self):
        return json.dumps(self._toDict(), indent=4)

    def _variablesToDict(self, vars: typing.List[PluginVariable], minimal: bool = False):
        varList: list[dict[str, typing.Any]] = []
        for v in vars:
            varList.append(v.toDict(minimal=minimal))
        return varList

    def _inputGroupsToDict(self, inputGroups: typing.Dict[str, VariableGroup]):
        inputGroupsList: list[dict[str, typing.Any]] = []
        for _, v in inputGroups.items():
            inputGroupsList.append(v.toDict())
        return inputGroupsList

    def _cleanRun(self, cleanCycles: bool = True, cleanDirty: bool = False):
        """
        Cleans the run of the block.

        :param cleanCycles: Whether to clean the cycles of the connections.
        :param setClean: Whether to set the block as clean or not. This is useful
        when checking if a flow was resetted or not. When the flow is resetted, the block will
        be set as "clean" / "not dirty" (same as if its the first time running). For other calls of
        _cleanRun() the block will be set as "dirty".
        """
        # Clean internal variables related to the execution
        self._finishedExecution = False
        self.error = False
        self.blockLogs = ""
        self._isRunning = False
        self._extensionsToOpen = []
        self._storedOutputs = {}
        self.time = 0

        if cleanDirty:
            self.dirty = False

        # Reset the cycles count on the connections
        if cleanCycles:
            for connection in self._variableConnections:
                connection.currentCycle = 0

    _isOriginal = True
    """
    Whether the block is original (created by the plugin) or not.
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
                "Setting remote on original block is not allowed. "
                + "This can lead to unexpected behaviour. Remember to "
                + "copy the block using block.copy() if you want to use it "
                + "in the pipeline."
            )
            logging.getLogger("Horus").error(msg)
            raise Exception(msg)
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
        error: bool = blockJSON.get("error", False)
        blockLogs: str = blockJSON.get("blockLogs", "")
        placedID: int = blockJSON.get("placedID", 0)
        finishedExecution: bool = blockJSON.get("finishedExecution", True)
        selectedInputGroup: str = blockJSON.get("selectedInputGroup", "default")
        selectedRemote: str = blockJSON.get("selectedRemote", "Local")
        extensionsToOpen: typing.List[typing.Dict[str, typing.Any]] = blockJSON.get(
            "extensionsToOpen", []
        )
        blockTime = blockJSON.get("time", 0)
        extraData = blockJSON.get("extraData", {})
        dirty = blockJSON.get("dirty", False)

        position: typing.Dict[str, float] = blockJSON.get("position", {})
        xPos: float = position.get("x", 0)
        yPos: float = position.get("y", 0)

        storedOutputs: typing.Dict[str, str] = blockJSON.get("storedOutputs", None)

        variableConnections: typing.List[typing.Dict[str, typing.Any]] = blockJSON.get(
            "variableConnections", []
        )
        variableConnectionsReference: typing.List[typing.Dict[str, typing.Any]] = blockJSON.get(
            "variableConnectionsReference", []
        )

        def parseVariableConnection(connection: typing.Dict[str, typing.Any]):
            origin = connection.get("origin", None)
            destination = connection.get("destination", None)
            isCyclic = connection.get("isCyclic", False)
            cycles = connection.get("cycles", 1)
            currentCycle = connection.get("currentCycle", 0)

            if origin is None or destination is None:
                raise Exception("Invalid flow object.")  # pylint: disable=broad-exception-raised

            # Gather the origin variable info
            originPlacedID = origin.get("placedID", None)
            originBlockID = origin.get("blockID", None)
            originVariableID = origin.get("variableID", None)
            originVariableType = origin.get("variableType", None)
            originVariableAllowedValues = origin.get("variableAllowedValues", None)

            originPair = BlockVarPair(
                originPlacedID,
                originBlockID,
                originVariableID,
                originVariableType,
                originVariableAllowedValues,
            )

            # Gather the destination variable info
            destinationPlacedID = destination.get("placedID", None)
            destinationBlockID = destination.get("blockID", None)
            destinationVariableID = destination.get("variableID", None)
            destinationVariableType = destination.get("variableType", None)
            destinationVariableAllowedValues = destination.get("variableAllowedValues", None)

            destinationPair = BlockVarPair(
                destinationPlacedID,
                destinationBlockID,
                destinationVariableID,
                destinationVariableType,
                destinationVariableAllowedValues,
            )

            return BlockConnection(originPair, destinationPair, isCyclic, cycles, currentCycle)

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
                raise Exception("Invalid flow object.")

            varType = variable.get("type", None)
            if varType == VariableTypes._GROUP.value:  # pylint: disable=protected-access
                groupVariables = variable.get("variables", None)
                variableGroupJSONParsed = {}
                for var in groupVariables:
                    subVarID = var.get("id", None)
                    variableGroupJSONParsed[subVarID] = var.get("value", None)

                variablesJSONParsed[varID] = variableGroupJSONParsed

            else:
                variablesJSONParsed[varID] = variable.get("value", None)

        # Update the variables with the values the user has set
        self.selectedInputGroup = selectedInputGroup
        self.selectedRemote = selectedRemote
        self._updateVariables(variablesJSONParsed)

        # Update the internal variables
        self._isPlaced = isPlaced
        self._isRunning = isRunning
        self.error = error
        self.blockLogs = blockLogs
        self._position = [xPos, yPos]
        self._placedID = placedID
        self._finishedExecution = finishedExecution
        self._storedOutputs = storedOutputs
        self._variableConnections = parsedVariableConnections
        self._variableConnectionsReferences = parsedVariableConnectionsReference
        self._extensionsToOpen = extensionsToOpen
        self.time = blockTime
        self.extraData = extraData
        self.dirty = dirty

    def _minimalEncode(self):
        """
        Encode only the blockID and the internal variables.
        """

        return {
            "id": self.id,
            "isPlaced": self._isPlaced,
            "position": {"x": self._position[0], "y": self._position[1]},
            "isRunning": self._isRunning,
            "error": self.error,
            "blockLogs": self.blockLogs,
            "placedID": self._placedID,
            "finishedExecution": self._finishedExecution,
            "storedOutputs": self._storedOutputs,
            "variables": self._variablesToDict(self._variables, minimal=True),
            "variableConnections": self._connectionsToDict(),
            "variableConnectionsReference": self._connectionsToDict(True),
            "selectedInputGroup": self.selectedInputGroup,
            "selectedRemote": self.selectedRemote,
            "extensionsToOpen": self._extensionsToOpen,
            "time": self.time,
            "extraData": self.extraData,
            "dirty": self.dirty,
        }

    def _toDict(self):
        """
        Converts the block to a dictionary.
        """

        fullBlock = self._minimalEncode()
        fullBlock["variables"] = self._variablesToDict(self._variables, minimal=False)
        fullBlock["name"] = self.name
        fullBlock["description"] = self.description
        fullBlock["inputs"] = self._inputGroupsToDict(self._inputGroups)
        fullBlock["outputs"] = self._variablesToDict(self._outputs)
        fullBlock["type"] = str(self.TYPE)

        return fullBlock

    config: dict = {}
    """
    The configuration of the plugin that hosts this block.
    """


class GhostBlock(PluginBlock):
    """
    A block used to represent missing or unavailable blocks in a flow.
    """

    error = True
    blockLogs = "Missing or unavailable block."

    def _parseID(self, id: str) -> str:

        # Because ghost blocks are not instantiated when Blocks are created
        # using the PluginBlock's _parseID will remove the original plugin ID
        # by removing the "." from the original ID.
        # For ghost blocks, we need to preserve the original ID (with the pluginID prefix).

        return id

    def __init__(self, id: str):
        super().__init__(
            name=id,
            description=self.blockLogs,
            blockType=PluginBlockTypes.GHOST,  # Explicitly sets the block type to GHOST
            id=id,
        )

    def __call__(self, *args, **kwargs):
        raise Exception("Cannot execute a ghost block.")

    def _toDict(self):

        # Set to have an error always
        self.error = True
        self.blockLogs = "Missing or unavailable block."

        return super()._toDict()


class PluginConfig(PluginBlock):
    """
    The PluginConfig class is a special type of block that is used to configure
    the plugin. It is not meant to be used in the pipeline. It works as a regular
    PluginBlock but it is shown only in the configuration page of the plugin.
    Its variables will be stored once set, and can be accessed by the Block actions
    using the block.config["variable_id"] syntax.
    """

    def __init__(  # pylint: disable=dangerous-default-value
        self,
        name: str,
        description: str,
        action: typing.Optional[typing.Callable] = None,
        variables: typing.List[PluginVariable] = [],
        id: typing.Optional[str] = None,
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

        super().__init__(
            name, description, action, variables, blockType=PluginBlockTypes.CONFIG, id=id
        )


class InputBlock(PluginBlock):
    """
    The InputBlock class is a special type of block that is used to get input from
    the user. It works as a regular PluginBlock but only shows its PluginVariable.
    Its output will be automatically set to the value the variable has if it does
    not have a defined action.

    When only the variable parameter is defined, the block will output directly the value
    of the variable.

    If parsing of the variable is needed, the action parameter can be used to define
    a function that will parse the value of the variable and return the parsed value. In that
    case, use the output parameter to define the output variable of the block.
    """

    def __init__(
        self,
        name,
        description,
        variable: PluginVariable,
        output: typing.Optional[PluginVariable] = None,
        action: typing.Optional[typing.Callable] = None,
        id: typing.Optional[str] = None,
    ):
        """
        :param name: The name of the block.
        :param description: The description of the block.
        :param variable: The variable of the block.
        """

        # Check that the variable is a PluginVariable instance
        if not isinstance(variable, PluginVariable):
            raise Exception(  # pylint: disable=broad-exception-raised
                f"The input variable of block {name} must be a single PluginVariable instance."
            )

        super().__init__(
            name,
            description,
            action=action,
            variables=[variable],
            inputs=[variable],
            outputs=[variable if output is None else output],
            blockType=PluginBlockTypes.INPUT,
            id=id,
        )

    # Override the __call__ method to return
    # the value of the variable as the output
    def __call__(self, *args, **kwargs):
        # If the block has an action, run it
        if self.action is not None:
            return super().__call__(*args, **kwargs)

        # If the block does not have an action, return the value of the variable
        self._outputs[0].value = self._variables[0].value

        # Update the stored outputs
        self._storedOutputs[self._outputs[0].id] = self._outputs[0].value

        return self.outputs


class SlurmBlock(PluginBlock):
    """
    The SlurmBlock class is a special type of block that is used to run an action
    in a remote server. It works as a regular PluginBlock but it has two actions,
    one before the job is submitted and one after the job is completed.
    """

    jobID: typing.Optional[int] = None
    """
    The Job ID of the job.
    """

    # Define an enum for the statuses
    class Status(Enum):
        """
        The status of the block.
        """

        BOOT_FAIL = "BOOT_FAIL"  # BF
        CANCELLED = "CANCELLED"  # CA
        CANCELLING = "CANCELLING"  # C
        COMPLETED = "COMPLETED"  # CD
        CONFIGURING = "CONFIGURING"  # CF
        COMPLETING = "COMPLETING"  # CG
        DEADLINE = "DEADLINE"  # DL
        FAILED = "FAILED"  # F
        NODE_FAIL = "NODE_FAIL"  # NF
        OUT_OF_ME = "OUT_OF_ME"  # OM
        PENDING = "PENDING"  # PD
        PREEMPTED = "PREEMPTED"  # PR
        RUNNING = "RUNNING"  # R
        RESV_DEL_HOLD = "RESV_DEL_HOLD"  # RD
        REQUEUE_FED = "REQUEUE_FED"  # RF
        REQUEUE_HOLD = "REQUEUE_HOLD"  # RH
        REQUEUED = "REQUEUED"  # RQ
        RESIZING = "RESIZING"  # RS
        REVOKED = "REVOKED"  # RV
        SIGNALING = "SIGNALING"  # SI
        SPECIAL_EXIT = "SPECIAL_EXIT"  # SE
        STAGE_OUT = "STAGE_OUT"  # SO
        STOPPED = "STOPPED"  # ST
        SUSPENDED = "SUSPENDED"  # SS
        TIMEOUT = "TIMEOUT"  # TO

        UNKNOWN = "UNKNOWN"
        IDLE = "IDLE"

        # Wehn the enum is instantiated with some value,
        # e.g. Status("IDLE"), if the value is not in the enum,
        # return the UNKNOWN status
        @classmethod
        def _missing_(cls, value):
            return cls.UNKNOWN

        # Make the enum serializable
        def __str__(self):
            return str(self.value)

    status: Status = Status.IDLE
    """
    The status of the block.
    """
    stdOut: typing.Optional[str] = None
    """
    The standard output a slurm job.
    """
    stdErr: typing.Optional[str] = None
    """
    The standard error a slurm job.
    """
    detailedStatus: typing.Optional[str] = None
    """
    Status and aditional information of a slurm job.
    """

    failOnSlurmError: bool = True
    """
    Whether to raise an exception if the slurm job fails.

    If set to False, the status of the block will be set to FAILED but the
    block will continue to execute its final action. Defaults to True.
    """

    _executeSecondAction: bool = False
    """
    Flag to indicate whether to execute the second action after the job is completed.
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
        id: typing.Optional[str] = None,
        failOnSlurmError: bool = True,
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
        :param id: The id of the block.
        :param failOnSlurmError: Whether to fail the block if the slurm job fails.
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
            id=id,
        )
        self.initalAction = initialAction
        self.finalAction = finalAction
        self.failOnSlurmError = failOnSlurmError

    # Override the __call__ method to accomodate the two actions
    def __call__(self, *args, **kwargs):
        # If the block has not submitted the job, run the first action
        # If the job has been submitted, and has ended, run the second action
        if self._executeSecondAction:
            self.action = self.finalAction
            outputs = super().__call__(*args, **kwargs)

            # Reset the _executeSecondAction flag
            self._executeSecondAction = False
        else:
            self.action = self.initalAction
            outputs = super().__call__(*args, **kwargs)
            # Set the reesetRemoteblock flag to False
            self.remote._remote._resetRemoteBlock = False  # pylint: disable=protected-access

        return outputs

    def parseStatus(self):
        """
        The status of the block as a parsed string.
        """
        try:
            # Tell the remote which is the current block by its placedID
            self.remote._remote._blockPlacedID = self._placedID

            # Get the current status of the job submited by the block
            # and parse the status to the block
            status = self.remote._remote.getRemoteBlockStatus(self.flow.savedID, self._placedID)
            self.status = self.Status(status)

            # Set also the jobIDs of this block
            self.jobID = self.remote._remote.getJobIDfromBlock(self.flow.savedID, self._placedID)

            # Get Slurm status and logging info
            self.stdOut, self.stdErr, self.detailedStatus = (
                self.remote._remote.getRemoteBlockLogs(self.flow.savedID, self._placedID)
            )
            self.time += self.remote._remote.getRemoteBlockTime(self.flow.savedID, self._placedID)
        except AttributeError as attre:
            logging.getLogger("Horus").error("Could not parse SlurmBlock status: %s", str(attre))
            self.status = self.Status.IDLE

        # Set the parsed status with only the first letter as capital
        return self.status.value.capitalize()

    @property
    def isWaitingForJob(self):
        """
        Whether the block is waiting for the job to finish or not.
        """

        if self.status == self.Status.COMPLETED or self.status == self.Status.IDLE:
            return False

        try:
            # Ensure the remote api has as blockID this block
            self.remote._remote._blockPlacedID = self._placedID

            # Parse the status
            self.parseStatus()

            # If the job is RUNNING or PENNDING, return False
            if self.status == self.Status.RUNNING or self.status == self.Status.PENDING:
                return True
            else:
                return False
        except AttributeError:
            return False
        except ResetRemoteException:
            return False
        except Exception as e:
            logging.getLogger("Horus").error(
                "An error occurred while checking if the job is finished for block %s: %s",
                self.name,
                e,
            )
            raise Exception("An error occurred while checking if the job is finished.") from e

    def waitTillJobFinished(self, interval: int = 10):
        """
        Waits until the job is finished.

        :param interval: The interval in seconds to check if the job is finished.
        """
        while self.isWaitingForJob:
            time.sleep(interval)

        # Set the status
        self.parseStatus()

    # def cancelJob(self):
    #     """
    #     Cancels the jobs in the slurm queue.
    #     """

    #     # Ensure the remote api has as blockID this block
    #     self.remote._remote.cancelJob(savedID, self._placedID)

    # Re-define the minimal method to include the status and jobID
    def _minimalEncode(self):
        minimalBlock = super()._minimalEncode()
        minimalBlock["status"] = str(self.status)
        minimalBlock["jobID"] = self.jobID
        minimalBlock["stdOut"] = self.stdOut
        minimalBlock["stdErr"] = self.stdErr
        minimalBlock["detailedStatus"] = self.detailedStatus
        minimalBlock["executeSecondAction"] = self._executeSecondAction
        return minimalBlock

    # Re-define the parseInternalVariables method to include the status and jobID
    def _parseInternalVariables(self, blockJSON: Dict[str, Any]):
        super()._parseInternalVariables(blockJSON)

        status = blockJSON.get("status", self.Status.IDLE)
        stdOut = blockJSON.get("stdOut", None)
        stdErr = blockJSON.get("stdErr", None)
        detailedStatus = blockJSON.get("detailedStatus", None)
        jobID = blockJSON.get("jobID", None)
        executeSecondAction = blockJSON.get("executeSecondAction", False)

        self.status = self.Status(status)
        self.jobID = jobID
        self.stdOut = stdOut
        self.stdErr = stdErr
        self.detailedStatus = detailedStatus
        self._executeSecondAction = executeSecondAction

    # Override the clean run to reset the status
    def _cleanRun(self, *args, **kwargs):
        super()._cleanRun(*args, **kwargs)
        self.stdOut = None
        self.stdErr = None
        self.detailedStatus = None
        self.status = self.Status.IDLE
        self.jobID = None
        self._executeSecondAction = False


# Platform typing
PlatformType = typing.List[typing.Literal["universal", "linux", "macos_intel", "macos_arm"]]


class PluginMetaModel(BaseModel):
    """
    The metadata of a plugin
    """

    id: str
    name: str
    description: str
    author: str
    version: str
    pluginFile: str
    minHorusVersion: typing.Optional[str]
    maxHorusVersion: typing.Optional[str]
    platforms: typing.Optional[PlatformType] = ["universal"]
    externalURL: typing.Optional[str]
    dependencies: typing.Optional[typing.List[str]] = []


class Plugin:
    """
    Base class for all plugins.
    """

    pluginMeta: PluginMetaModel
    """
    The metadata of the plugin.
    """

    logo: typing.Optional[str] = None
    """
    The path to the logo of the plugin.
    """

    default: bool = False
    """
    Whether the plugin is a default plugin or not.
    """

    def __init__(self, id: typing.Optional[str] = None, noMetaLoad: bool = False):
        """
        Initializes the plugin.

        :param id: The id of the plugin.
        """

        if id is not None:
            logging.getLogger("Horus").warning(
                "Plugins must define the ID in the plugin.meta file. "
                "Please remove the ID parameter from the Plugin class initialization."
            )

        self.id: str = "undefined"
        """
        The unique id of the plugin. Will be automatically
        assigned when loading the plugin from the plugin.meta file.
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

        self._configs: typing.List[PluginConfig] = []
        """
        Configs that can be used to configure the block.

        Allowed type: PluginConfig
        """

        currentPath: typing.Optional[str] = None
        import inspect

        if __name__ != "__main__":

            # If we are on compiled HOrus, the path of the plugin is the same
            # is the first element of the stack trace

            # On uncompiled, the path is the second element of the stack trace
            # as the first one will be the HorusAPI module
            import sys

            if hasattr(sys, "frozen"):
                currentPath = os.path.abspath(inspect.stack()[0].filename)
            else:
                for frame in inspect.stack()[1:]:
                    if frame.filename[0] != "<":
                        currentPath = os.path.abspath(frame.filename)
                        break

        if currentPath is None:
            raise ValueError(
                "Could not find the path of the plugin. Please check the plugin installation."
            )

        # Add to the plugin the filename
        self._filename: str = os.path.basename(currentPath)
        """
        The filename of the plugin. Internal use only.
        """

        # Add to the plugin the full path of the containing folder
        self._path = os.path.dirname(currentPath)
        """
        The path of the plugin folder. Internal use only.
        """

        if not noMetaLoad:
            self.loadPluginMeta()

    # Define comparison operators
    def __eq__(self, other):
        if isinstance(other, Plugin):
            return self.pluginMeta.id == other.pluginMeta.id
        return False

    def __ne__(self, other):
        return not self.__eq__(other)

    # Define the str function to print(plugin)
    def __str__(self):
        return self.pluginMeta.id

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
            try:
                with open(metaPath, "r", encoding="utf-8") as metaFile:
                    self.pluginMeta = PluginMetaModel.parse_raw(metaFile.read())

                # Assign the id to the plugin
                self.id = re.sub(r"[^A-Za-z0-9]", "_", self.pluginMeta.id.lower())

                # Update the id on the meta too
                self.pluginMeta.id = self.id

                logging.debug("Assigned ID %s to plugin %s", self.id, self.pluginMeta.name)
            except Exception as exc:
                raise Exception(f"Error loading plugin.meta file ({metaPath}): {exc}") from exc
        else:
            raise Exception(f"plugin.meta file not found at '{metaPath}'.")

        # Load the plugin logo
        logoPath = os.path.join(self._path, "logo.png")
        if os.path.exists(logoPath):
            with open(logoPath, "rb") as logoFile:
                self.logo = (
                    f"data:image/png;base64,{base64.b64encode(logoFile.read()).decode('utf-8')}"
                )

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
        """
        Returns a list of all the blocks in the plugin.
        """
        return self._blocks

    # Define the .blocks property to the getBlocks function
    @property
    def blocks(self):
        """
        Returns a list of all the blocks in the plugin.
        """
        return self.getBlocks()

    def addBlock(self, block: PluginBlock):
        """
        Adds a PluginBlock to the plugin.
        """

        if isinstance(block, GhostBlock):  # If trying to add a Ghost block, log an error
            logging.getLogger("Horus").error("Cannot add a GhostBlock to the plugin as a block.")
        # If trying to add a Config, log an error
        elif isinstance(block, PluginConfig):
            logging.getLogger("Horus").error(
                "Cannot add a PluginConfig to the plugin as a block. Use addConfig instead of addBlock."
            )
        # If the attribute is a PluginBlock (not PluginConfig), add it to the list
        # Only add the block if it is not already in the list
        elif isinstance(block, PluginBlock):
            block.id = f"{self.id}.{block.id}".replace(" ", "_").lower()
            try:
                # If the block does not exist, an exception will be raised
                self.getBlock(block.id)

                logging.getLogger("Horus").warning(
                    "Block with ID '%s' already exists. Skipping.", block.id
                )
            except Exception:
                # Add the block to the list of blocks if it is not found
                self._blocks.append(block)

    def _addBlocks(self):
        # Search for all the properties of the instance
        # Check if the property is a PluginBlock
        # If it is, add it to the list of blocks
        for attr in dir(self):

            logging.getLogger("Horus").debug("Checking attribute %s", attr)

            # Get the attribute
            attr = getattr(self, attr)

            logging.getLogger("Horus").debug("Attribute type: %s", type(attr))

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
        """
        Returns a list of all the pages in the plugin.
        """
        return self._pages

    @property
    def pages(self):
        """
        Returns a list of all the pages in the plugin.
        """

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
    def _flows(self) -> list[dict[str, typing.Any]]:
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

        # Import the flow class
        from Server.FlowManager import Flow

        # Get the list of flows
        flows: list[dict[str, typing.Any]] = []
        for file in os.listdir(flowsDir):
            if file.endswith(".flow"):
                # Get the path of the flow file
                filePath = os.path.join(flowsDir, file)

                # Read the flow file to get the name of the flow
                try:
                    flow = Flow.read(filePath)
                except Exception as exc:
                    logging.getLogger("Horus").error(
                        "Error reading preset flow file %s: %s", filePath, exc
                    )
                    continue

                # Add the flow to the list
                flowInfo = {
                    "name": flow.name,
                    "path": flow.path,
                    "pluginID": self.id,
                    "pluginName": self.pluginMeta.name,
                    "savedID": flow.savedID,
                }
                flows.append(flowInfo)

        return flows

    def _getConfig(self, id: str):
        """
        Returns a config by its ID.
        Values are not accurate as per-remote configuration is not implemented here

        :param id: The ID of the config.
        """
        for config in self._configs:
            if config.id == id:
                return config
        raise Exception(f"Config {id} not found.")

    def _getConfigs(self):
        return self._configs

    @property
    def config(self) -> dict:
        """
        A dictionary with the configs of the block
        """
        configsDict: dict[str, typing.Any] = {}
        for config in self._configs:
            for var in config._getVariables():
                configsDict[var.id] = PluginBlock._parseVariablesForBlockAccess(var)
        return configsDict

    def addConfig(self, config: PluginConfig):
        """
        Adds a PluginConfig to the plugin.
        """

        # If the attribute is a PluginConfig, add it to the list
        # Only add the config if it is not already in the list
        if isinstance(config, PluginConfig):
            config.id = f"{self.id}.config.{config.id}".replace(" ", "_").lower()
            try:
                self._getConfig(config.id)
            except Exception:
                self._configs.append(config)

    def _updateConfigs(self, configPath: str):
        """
        Updates the values of the configs of the block.
        From the config JSON file.
        """

        if len(self._configs) == 0:
            return

        if not os.path.exists(configPath):
            self._createConfig(configPath)

        # Read the config file
        try:
            with open(configPath, "r", encoding="utf-8") as configFile:
                configs = json.load(configFile)
        except json.JSONDecodeError:
            backupConfigPath = configPath + ".bak"
            shutil.move(configPath, backupConfigPath)
            self._createConfig(configPath)
            logging.getLogger("Horus").error(
                "Error reading config file %s."
                "The config file has been moved to %s and "
                "a new config file has been created",
                configPath,
                backupConfigPath,
            )

        # Update the values of the configs
        for config in self._configs:
            for var in config._getVariables():
                if var.id in configs.keys():
                    if isinstance(var, VariableGroup):
                        var._updateVariablesInGroup(configs[var.id])
                    elif isinstance(var, VariableList):
                        var._updateVariablesInList(configs[var.id])
                    else:
                        var.value = configs[var.id]

    def _createConfig(self, configPath: str):
        """
        Creates the config file for the block.
        """
        # Create the config file only if the block has configs

        if len(self._configs) > 0:
            # Create the config file
            logging.getLogger("Horus").debug(
                "Creating config file for plugin %s at %s", self.id, configPath
            )
            with open(configPath, "w", encoding="utf-8") as configFile:
                configs = {}
                for config in self._configs:
                    configs[config.id] = config.variables
                json.dump(self.config, configFile, indent=4)

    def _saveConfig(self, configPath: str, valuesToSave: dict[str, str]):
        """
        Saves the config file for the block with new values.
        """
        # Save the config file only if the block has configs
        if len(self._configs) > 0:

            # Read the existing config file
            if not os.path.exists(configPath):
                self._createConfig(configPath)

            with open(configPath, "r", encoding="utf-8") as configFile:
                configs = json.load(configFile)

            # Update the values to save
            for key, value in valuesToSave.items():
                configs[key] = value

            # Write the updated config file
            with open(configPath, "w", encoding="utf-8") as configFile:
                json.dump(configs, configFile, indent=4)

        # Update the values of the configs
        self._updateConfigs(configPath)

    def _configToDict(self):
        configList: list[dict[str, typing.Any]] = []
        for c in self._getConfigs():
            configList.append(c._toDict())
        return configList
