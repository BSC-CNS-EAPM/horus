"""
The SmilesAPI module
"""

# Basic utilities
import os
import logging

# Import types only in development
# pyright: reportUnboundVariable=false
import typing

# Utilities
from .utils import SingletonMeta

if typing.TYPE_CHECKING:
    from Server.FlowManager import Flow


class SmilesAPI(metaclass=SingletonMeta):
    """
    API for interacting with the Smiles Manager inside Horus
    """

    _flow: typing.Optional["Flow"] = None
    """
    The current flow where the API is running
    """

    def _emitAction(self, action: str, data: dict) -> None:
        """
        Emits the given action with the given data to the Smiles Manager.
        """

        logging.getLogger("Horus").debug("SMILES action %s", action)

        if self._flow is None:
            raise Exception("Could not run the SmilesAPI. No flow is currently running")

        # Add the flowID to the action
        data["savedID"] = self._flow.savedID

        # Store the action and data for when the client connects and opens the flow
        self._flow.pendingSmilesActions.append(data)

    def addSmiles(self, smiles: str, group: typing.Optional[str] = None) -> None:
        """
        Add a smiles string to the smiles manager

        :param smiles: The smiles string to add
        :param group: The group to add the smiles to
        """

        data = {
            "type": "addSmiles",
            "data": {"smiles": smiles, "group": group},
        }

        self._emitAction("addSmiles", data)

    def addCSV(self, csv: str, group: typing.Optional[str] = None) -> None:
        """
        Adds a CSV file to the smiles manager

        :param csv: The CSV file path to add
        """

        if not os.path.exists(csv):
            raise Exception(f"Could not find the CSV file at '{csv}'")

        fileContents = open(csv, "r", encoding="utf-8").read()

        data = {
            "type": "addCSV",
            "data": {"fileContents": fileContents, "group": group},
        }

        self._emitAction("addCSV", data)

    def addSmilesWithData(self, smiles: list[dict]) -> None:
        """
        Adds a list of full SMILES object to the smiles manager

        Each object should be in the following keys:

        - smi: string -> SMILES as a string
        - label: string -> Label to display
        - extraInfo: string -> Extra info to display
        - group: string -> Group to add the smiles to
        - props: {key: value, ...} -> Properties to add to the molecule (optional)
        """

        data = {
            "type": "addSmilesWithData",
            "data": smiles,
        }

        self._emitAction("addSmilesWithData", data)

    def reset(self) -> None:
        """
        Resets the visualizer
        """

        data = {"type": "reset", "data": {}}

        self._emitAction("reset", data)
