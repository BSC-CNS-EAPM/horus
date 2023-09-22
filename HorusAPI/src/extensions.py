from flask_socketio import SocketIO
from .utils import SingletonMeta
import typing


class Extensions(metaclass=SingletonMeta):
    def __init__(self, socketio: SocketIO = SocketIO()) -> None:
        self.socketio = socketio

    def open(
        self,
        pluginID: str,
        pageID: str,
        data: typing.Optional[typing.Dict[str, typing.Any]] = None,
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

        extensionData = {
            "pageURL": f"/plugins/pages/{pluginID}.{pageID}",
            "data": data,
        }

        self.socketio.emit("openExtension", extensionData)
