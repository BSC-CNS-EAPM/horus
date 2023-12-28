"""
The MolstarAPI module
"""

# Logging
import logging

# Import types only in development
# pyright: reportUnboundVariable=false
import typing

# Utilities
from .utils import SingletonMeta

if typing.TYPE_CHECKING:
    from Server.FlowManager import Flow


class MolstarAPI(metaclass=SingletonMeta):
    """
    API for interacting with Mol* visualizer inside Horus
    """

    _flow: typing.Optional["Flow"] = None
    """
    The current flow where the API is running
    """

    @property
    def mvs(self):
        """
        The molviewspec library. Use it to build complex scenes
        """

        # Import the molviewspec builder
        import molviewspec as mvs

        return mvs

    def _emitAction(self, action: str, data: dict) -> None:
        """
        Emits the given action with the given data to Mol*
        """

        logging.getLogger("Horus").debug("Mol* action %s", action)

        if self._flow is None:
            raise Exception("Could not run the MolstarAPI. No flow is currently running")

        # Add the flowID to the action
        data["savedID"] = self._flow.savedID

        # Store the action and data for when the client connects and opens the flow
        self._flow.pendingActions.append(data)

    def addPDB(self, pdb: str, label: str = "PDB") -> None:
        """
        Adds the given PDB string to Mol*

        :param pdb: The PDB as a read string
        :param label: The label of the structure to be shown in the scene
        """

        data = {"type": "addPDB", "data": {"pdb": pdb, "label": label}}

        self._emitAction("loadPDB", data)

    def loadMVJS(self, mvjs: typing.Dict[str, typing.Any], replaceExisting: bool = False) -> None:
        """
        Loads a molviewspec session into Mol*

        :param mvjs: The molviewspec session to load as a dictionary
        (returned by the .get_state() method of molviewspec builder)
        :param replaceExisting: Whether to replace the existing session or not
        """

        # Convert the object to JSON string
        import json

        mvjsString = json.dumps(mvjs)

        data = {"type": "loadMVJS", "data": {"session": mvjsString, "replace": replaceExisting}}

        self._emitAction("loadMVJS", data)

    def focusResidue(
        self,
        residue: int,
        structureLabel: typing.Optional[str] = None,
        chain: typing.Optional[str] = None,
        nearRadius: int = 5,
    ) -> None:
        """
        Focuses on the given residue

        :param residue: The sequence number of the residue to focus
        :param structureLabel: The label of the structure to focus
        :param chain: The chain ID of the residue to focus
        :param nearRadius: The radius around the residue to display nearby residues
        """

        data = {
            "type": "focus",
            "data": {
                "residue": residue,
                "structureLabel": structureLabel,
                "chain": chain,
                "nearRadius": nearRadius,
            },
        }

        self._emitAction("focusResidue", data)

    def addSphere(
        self,
        x: float,
        y: float,
        z: float,
        radius: float,
        color: typing.Optional[str] = None,
        opacity: float = 1,
    ) -> None:
        """
        Adds a sphere to the scene.

        :param x: The x coordinate of the sphere in Angstroms
        :param y: The y coordinate of the sphere in Angstroms
        :param z: The z coordinate of the sphere in Angstroms
        :param radius: The radius of the sphere in Angstroms
        :param color: The color of the sphere as an RGB hex string (i.e. #0000FF)
        :param opacity: The opacity of the sphere (0.0 - 1.0)
        """

        position = {
            "x": x,
            "y": y,
            "z": z,
        }

        # Convert the color to a hex string without the #
        # The TS molstar class will use the default color if None is given
        if color is not None:
            if not color.startswith("#"):
                color = "#" + color
        else:
            color = "#0000FF"

        data = {
            "type": "addSphere",
            "data": {"position": position, "radius": radius, "color": color, "opacity": opacity},
        }

        self._emitAction("addSphere", data)

    def setBackgroundColor(self, color: str) -> None:
        """
        Sets the background color of the scene

        :param color: The color to set the background to as an RGB hex string (i.e. #0000FF)
        """

        # Convert the color to a hex string without the #
        if not color.startswith("#"):
            color = "#" + color

        data = {"type": "setBackgroundColor", "data": {"color": color}}

        self._emitAction("setBackgroundColor", data)

    def toggleSpin(self) -> None:
        """
        Toggles the spin of the molecule
        """

        data = {"type": "toggleSpin", "data": {}}

        self._emitAction("toggleSpin", data)

    def reset(self) -> None:
        """
        Resets the visualizer
        """

        data = {"type": "reset", "data": {}}

        self._emitAction("reset", data)
