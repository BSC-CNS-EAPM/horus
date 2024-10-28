"""
ExtensionAPI module
"""

import logging
import os

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

        if self._flow is None or self._flow.savedID is None:
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

        extensionData = {
            "extensionAPI": True,
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
        Loads the given HTML into the extension.

        :param html: The path to the HTML to load .
        :param title: The title of the 'Result'. \
        This will be displayed on top of the block that produced the HTML.
        :param store: Whether to store the HTML as results or to open it inmediately.
        :param asString: Whether the passed HTML is a string or an html file.
        """

        if html.endswith(".html") and not os.path.exists(html):
            raise ValueError("HTML file does not exist at path {}".format(html))

        if not html.endswith(".html"):
            type = "html_content"
        else:
            html = os.path.abspath(html)
            type = "html_file"

        if store:
            self.storeExtensionResults(
                pluginID="horus",
                pageID="html_loader",
                data={"html": html, "type": type},
                title=title,
            )
        else:
            self.open(pluginID="horus", pageID="html_loader", data={"html": html, "type": type})

    def loadImage(self, image: str, title: str, store: bool = True) -> None:
        """
        Loads the given image into the extension.

        :param image: The path to the image to load. Supports png, jpg and gif.
        :param title: The title of the 'Result'. \
        This will be displayed on top of the block that produced the image.
        :param store: Whether to store the image as results or to open it inmediately.
        """

        if not os.path.exists(image):
            raise ValueError("Image file does not exist at path {}".format(image))

        image = os.path.abspath(image)

        if store:
            self.storeExtensionResults(
                pluginID="horus", pageID="image_loader", data={"image": image}, title=title
            )
        else:
            self.open(pluginID="horus", pageID="image_loader", data={"image": image})

    def loadText(self, text: str, title: str, store: bool = True) -> None:
        """
        Loads the given text into the extension.

        :param text: The text to load.
        :param title: The title of the 'Result'. \
        This will be displayed on top of the block that produced the text.
        :param store: Whether to store the text as results or to open it inmediately.
        """

        # Use formatted text
        text = "<pre style='white-space: pre-wrap; font-family: sans-serif;'>{}</pre>".format(
            text
        )

        if store:
            self.storeExtensionResults(
                pluginID="horus", pageID="html_loader", data={"html": text}, title=title
            )
        else:
            self.open(pluginID="horus", pageID="html_loader", data={"html": text})

    def loadCSV(self, csv: str, title: str, store: bool = True) -> None:
        """
        Loads the given CSV into the extension.

        :param csv: The path to the CSV to load.
        :param title: The title of the 'Result'. \
        This will be displayed on top of the block that produced the CSV.
        :param store: Whether to store the CSV as results or to open it inmediately.
        """

        if not os.path.exists(csv):
            raise ValueError("CSV file does not exist at path {}".format(csv))

        csv = os.path.abspath(csv)

        if store:
            self.storeExtensionResults(
                pluginID="horus", pageID="csv_loader", data={"csv": csv}, title=title
            )
        else:
            self.open(pluginID="horus", pageID="csv_loader", data={"csv": csv})

    def loadPlot(self, plotCSV: str, title: str, store: bool = True) -> None:
        """
        Loads the given CSV as a Plot into the extension.

        :param csv: The path to the CSV to load as plot.
        :param title: The title of the plot. \
        This will be displayed on top of the block that produced the Plot.
        :param store: Whether to store the Plot as results or to open it inmediately.
        """

        if not os.path.exists(plotCSV):
            raise ValueError("CSV file does not exist at path {}".format(plotCSV))

        plotCSV = os.path.abspath(plotCSV)

        if store:
            self.storeExtensionResults(
                pluginID="horus", pageID="plot_loader", data={"plot": plotCSV}, title=title
            )
        else:
            self.open(pluginID="horus", pageID="plot_loader", data={"plot": plotCSV})

    def loadPDF(self, pdf: str, title: str, store: bool = True) -> None:
        """
        Loads the given PDF into the extension.

        :param pdf: The path to the PDF to load.
        :param title: The title of the 'Result'. \
        This will be displayed on top of the block that produced the PDF.
        :param store: Whether to store the PDF as results or to open it inmediately.
        """

        if not os.path.exists(pdf):
            raise ValueError("PDF file does not exist at path {}".format(pdf))

        pdf = os.path.abspath(pdf)

        if store:
            self.storeExtensionResults(
                pluginID="horus", pageID="pdf_loader", data={"pdf": pdf}, title=title
            )
        else:
            self.open(pluginID="horus", pageID="pdf_loader", data={"pdf": pdf})
