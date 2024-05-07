"""
ExtensionAPI module
"""

import logging
import base64

# Import types only in development
# pyright: reportUnboundVariable=false
import typing

from .utils import SingletonMeta

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
                self.socketio.emit(action, data, to=self._flow.savedID)

    def open(
        self,
        pluginID: str,
        pageID: str,
        data: typing.Optional[typing.Dict[str, typing.Any]] = None,
        title: str = "Extension",
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
            "url": f"/plugins/pages/{pluginID}.{pageID}",
            "pluginID": pluginID,
            "pageID": pageID,
            "data": data,
            "title": title,
        }

        self._emitAction("openExtension", extensionData)

    def storeExtensionResults(
        self,
        pluginID: str,
        pageID: str,
        data: typing.Optional[typing.Dict[str, typing.Any]] = None,
        title: str = "Results",
    ) -> None:
        """
        Stores the results of the extension in the flow to be opened at any time.

        :param pluginID: The ID of the plugin that contains the desired PluginPage (Extension).
        :param pageID: The ID of the PluginPage that represents the extension.
        :param data: The results of the extension.
        :param title: The title of the results. This will be displayed on top of the block that produced the results.
        """

        logging.getLogger("Horus").debug("Storing extension results %s", data)

        if self._flow is None:
            raise Exception("Could not run the ExtensionsAPI. No flow is currently running")

        extensionData = {
            "url": f"/plugins/pages/{pluginID}.{pageID}",
            "pluginID": pluginID,
            "pageID": pageID,
            "data": data,
            "title": title,
        }

        # Add the extension results to the current executing block
        if self._flow.currentExecuting is not None:
            block = self._flow.findBlockByPlacedID(self._flow.currentExecuting)
            block._extensionsToOpen.append(extensionData)
        else:
            raise Exception("Could not store extension results. No block is currently running")

    def loadHTML(self, html: str, title: str, store: bool = True) -> None:
        """
        Loads the given HTML string into the extension.

        :param html: The HTML to load as a string.
        :param title: The title of the 'Result'. \
        This will be displayed on top of the block that produced the HTML.
        :param store: Whether to store the HTML as results or to open it inmediately.
        """

        if self._flow is None:
            raise Exception("Could not run the ExtensionsAPI. No flow is currently running")

        if store:
            self.storeExtensionResults(
                pluginID="horus", pageID="html_loader", data={"html": html}, title=title
            )
        else:
            self.open(pluginID="horus", pageID="html_loader", data={"html": html})

    def loadImage(self, image: str, title: str, store: bool = True) -> None:
        """
        Loads the given image into the extension.

        :param image: The path to the image to load. Supports png, jpg and gif.
        :param title: The title of the 'Result'. \
        This will be displayed on top of the block that produced the image.
        :param store: Whether to store the image as results or to open it inmediately.
        """

        if self._flow is None:
            raise Exception("Could not run the ExtensionsAPI. No flow is currently running")

        # Read the image as a base64 string
        if image.endswith(".png"):
            with open(image, "rb") as f:
                imageData = base64.b64encode(f.read()).decode("utf-8")
                image = "data:image/png;base64,{}".format(imageData)
        elif image.endswith(".jpg"):
            with open(image, "rb") as f:
                imageData = base64.b64encode(f.read()).decode("utf-8")
                image = "data:image/jpg;base64,{}".format(imageData)
        elif image.endswith(".gif"):
            with open(image, "rb") as f:
                imageData = base64.b64encode(f.read()).decode("utf-8")
                image = "data:image/gif;base64,{}".format(imageData)
        else:
            raise Exception("Unsupported image format {}".format(image))

        # Generate an HTML string that contains the image
        image = '<img src="{}" alt="{}" style="max-width: 100%; max-height: 100%;">'.format(
            image, title
        )

        html = f"""
        <html>
            <head>
                <title>{title}</title>
            </head>
            <body>
                <div style="display: flex; justify-content: center; align-items: center; height: 100vh;">
                    {image}
                </div>
            </body>
        </html>
        """

        if store:
            self.storeExtensionResults(
                pluginID="horus", pageID="html_loader", data={"html": html}, title=title
            )
        else:
            self.open(pluginID="horus", pageID="html_loader", data={"html": html})

    def loadText(self, text: str, title: str, store: bool = True) -> None:
        """
        Loads the given text into the extension.

        :param text: The text to load.
        :param title: The title of the 'Result'. \
        This will be displayed on top of the block that produced the text.
        :param store: Whether to store the text as results or to open it inmediately.
        """

        # Use formatted text
        text = "<pre>{}</pre>".format(text)

        if self._flow is None:
            raise Exception("Could not run the ExtensionsAPI. No flow is currently running")

        if store:
            self.storeExtensionResults(
                pluginID="horus", pageID="html_loader", data={"html": text}, title=title
            )
        else:
            self.open(pluginID="horus", pageID="html_loader", data={"html": text})
