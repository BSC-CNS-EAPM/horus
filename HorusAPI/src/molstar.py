from .utils import SingletonMeta

import logging

# Import types only in development
# pyright: reportUnboundVariable=false
import typing

if typing.TYPE_CHECKING:
    from Server.server import HorusSocket
    from Server.FlowManager import Flow


class MolstarAPI(metaclass=SingletonMeta):
    _flow: typing.Optional["Flow"] = None
    """
    The current flow where the API is running
    """

    def __init__(self, socketio: typing.Optional["HorusSocket"] = None) -> None:
        self.socketio = socketio

    def _emitAction(self, action: str, data: dict) -> None:
        """
        Emits the given action with the given data to Mol*
        """

        logging.getLogger("Horus").debug(f"Emitting Mol* action {action}")

        if self._flow is None:
            raise Exception("Could not run the MolstarAPI. No flow is currently running")

        if self.socketio is not None:
            # Check that the client is connected
            if not self.socketio.isClientJoinedFlow(self._flow.savedID):
                self._flow.pendingActions.append(data)
            else:
                self.socketio.emit("molstarAction", data)
        else:
            # Store the action and data for when the client connects and opens the flow
            self._flow.pendingActions.append(data)

    def addPDB(self, pdb: str, label: str = "PDB") -> None:
        """
        Adds the given PDB string to Mol*
        """

        data = {"type": "addPDB", "data": {"pdb": pdb, "label": label}}

        self._emitAction("loadPDB", data)
