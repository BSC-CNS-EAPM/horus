from .utils import SingletonMeta

import logging

# Import types only in development
# pyright: reportUnboundVariable=false
import typing

if typing.TYPE_CHECKING:
    from Server.server import HorusSocket
    from Server.FlowManager import Flow


class Extensions(metaclass=SingletonMeta):
    _flow: typing.Optional["Flow"] = None

    def __init__(self, socketio: typing.Optional["HorusSocket"] = None) -> None:
        self.socketio = socketio

    def _emitAction(self, action: str, data: dict) -> None:
        """
        Emits the given action with the given data to the frontend
        """

        logging.getLogger("Horus").debug("Emitting extension action %s", action)

        if self._flow is None:
            raise Exception("Could not run the ExtensionsAPI. No flow is currently running")

        if self.socketio is not None:
            # Check that the client is connected
            if self.socketio.isClientJoinedFlow(self._flow.savedID):
                self.socketio.emit(action, data)

    def open(
        self,
        pluginID: str,
        pageID: str,
        data: typing.Optional[typing.Dict[str, typing.Any]] = None,
        title: str = "Extension"
    ) -> None:
        """
        Opens the given extension (PluginPage) and passes the given data to it.

        :param pluginID: The ID of the plugin that contains the desired PluginPage (Extension).
        :param pageID: The ID of the PluginPage that represents the extension.
        :param data: The data to pass to the extension.
        """

        # Lowercase the plugin ID and the page ID
        pluginID = pluginID.lower()
        pageID = pageID.lower()

        if self._flow is None:
            raise Exception("Could not run the ExtensionsAPI. No flow is currently running")

        extensionData = {
            "pageURL": f"/plugins/pages/{pluginID}.{pageID}",
            "data": data,
            "title": title,
        }

        self._emitAction("openExtension", extensionData)

    def storeExtensionResults(
        self,
        pluginID: str,
        pageID: str,
        data: typing.Optional[typing.Dict[str, typing.Any]] = None,
        title: str = "Results"
    ) -> None:
        """
        Stores the results of the extension in the flow.

        :param data: The results of the extension.
        """

        logging.getLogger("Horus").debug("Storing extension results %s", data)

        if self._flow is None:
            raise Exception("Could not run the ExtensionsAPI. No flow is currently running")

        extensionData = {
            "pageURL": f"/plugins/pages/{pluginID}.{pageID}",
            "data": data,
            "title": title,
        }

        # Add the extension results to the current executing block
        if self._flow.currentExecuting is not None:
            block = self._flow.findBlockByPlacedID(self._flow.currentExecuting)
            block._extensionsToOpen.append(extensionData)
        else:
            raise Exception("Could not store extension results. No block is currently running")
