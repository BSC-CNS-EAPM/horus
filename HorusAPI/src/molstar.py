"""
The MolstarAPI module
"""

# Basic utilities
import os
import logging

from enum import Enum
import typing
from typing import Optional, Any, Dict, Union, Literal

from pydantic import BaseModel, Field

# Utilities
from .utils import SingletonMeta

# Import types only in development
if typing.TYPE_CHECKING:
    from Server.FlowManager import Flow


class ColorTheme(str, Enum):
    """
    A list of the color themes available in Mol*
    """

    atom_id = "atom-id"
    carbohydrate_symbol = "carbohydrate-symbol"
    cartoon = "cartoon"
    chain_id = "chain-id"
    element_index = "element-index"
    element_symbol = "element-symbol"
    entity_id = "entity-id"
    entity_source = "entity-source"
    external_structure = "external-structure"
    external_volume = "external-volume"
    formal_charge = "formal-charge"
    hydrophobicity = "hydrophobicity"
    illustrative = "illustrative"
    model_index = "model-index"
    molecule_type = "molecule-type"
    occupancy = "occupancy"
    operator_hkl = "operator-hkl"
    operator_name = "operator-name"
    partial_charge = "partial-charge"
    polymer_id = "polymer-id"
    polymer_index = "polymer-index"
    residue_name = "residue-name"
    secondary_structure = "secondary-structure"
    sequence_id = "sequence-id"
    shape_group = "shape-group"
    structure_index = "structure-index"
    trajectory_index = "trajectory-index"
    uncertainty = "uncertainty"
    unit_index = "unit-index"
    uniform = "uniform"
    volume_segment = "volume-segment"
    volume_value = "volume-value"
    default = "default"


class SizeTheme(str, Enum):
    """
    A list of the size themes available in Mol*
    """

    physical = "physical"
    shape_group = "shape-group"
    uncertainty = "uncertainty"
    uniform = "uniform"
    volume_value = "volume-value"
    default = "default"


class MolRepresentations(str, Enum):
    """
    Available molstar representations
    """

    CARTOON = "cartoon"
    BACKBONE = "backbone"
    BALL_AND_STICK = "ball-and-stick"
    CARBOHYDRATE = "carbohydrate"
    ELLIPSOID = "ellipsoid"
    GAUSSIAN_SURFACE = "gaussian-surface"
    GAUSSIAN_VOLUME = "gaussian-volume"
    LABEL = "label"
    LINE = "line"
    MOLECULAR_SURFACE = "molecular-surface"
    ORIENTATION = "orientation"
    PLANE = "plane"
    POINT = "point"
    PUTTY = "putty"
    SPACEFILL = "spacefill"


class MolstarThemeOptions(BaseModel):
    """
    Options for updating a model's theme
    """

    representation: MolRepresentations = MolRepresentations.CARTOON
    representationParams: Optional[dict[str, Any]] = None
    color: Optional[Union[ColorTheme, str]] = None
    colorParams: Optional[dict[str, Any]] = None
    size: Optional[Union[SizeTheme, str]] = None
    sizeParams: Optional[Dict[str, Any]] = None

    class Config:
        use_enum_values = True


class SelectionLanguage(str, Enum):
    """Selection language types supported by Mol*"""

    MOL_SCRIPT = "mol-script"
    VMD = "vmd"
    PYMOL = "pymol"
    JMOL = "jmol"


class MolecularSelection(BaseModel):
    """
    Comprehensive molecular selection model supporting all Mol* selection types
    """

    # Script-based selections (VMD, PyMOL, Jmol, MolScript)
    script: Optional[str] = Field(
        default=None, description="Selection script in specified language (defaults to VMD)"
    )
    language: Optional[SelectionLanguage] = Field(
        default=SelectionLanguage.VMD, description="Script language"
    )

    # Chain selections
    chain: Optional[str] = Field(
        default=None, description="Label chain identifier (label_asym_id)"
    )
    auth_chain: Optional[str] = Field(
        default=None, description="Author chain identifier (auth_asym_id)"
    )

    # Entity selection
    entity: Optional[str] = Field(default=None, description="Entity identifier (label_entity_id)")

    # Residue selections
    residue: Optional[int] = Field(
        default=None, description="Label residue sequence ID (label_seq_id)"
    )
    auth_residue: Optional[int] = Field(
        default=None, description="Author residue sequence ID (auth_seq_id)"
    )
    residue_range: Optional[dict] = Field(
        default=None, description="Residue range {start: int, end: int}"
    )
    auth_residue_range: Optional[dict] = Field(
        default=None, description="Author residue range {start: int, end: int}"
    )

    # Atom selections
    atom_name: Optional[str] = Field(
        default=None, description="Label atom identifier (label_atom_id)"
    )
    auth_atom_name: Optional[str] = Field(
        default=None, description="Author atom identifier (auth_atom_id)"
    )
    element_symbol: Optional[str] = Field(default=None, description="Chemical element symbol")
    atom_id: Optional[int] = Field(default=None, description="Atom ID number")
    atom_index: Optional[int] = Field(default=None, description="Atom source index")

    # Insertion code
    insertion_code: Optional[str] = Field(
        default=None, description="PDB insertion code (pdbx_PDB_ins_code)"
    )

    # Combined selections
    chain_and_residue: Optional[dict] = Field(
        default=None, description="Combined selection {chain: str, residue: int}"
    )
    auth_chain_and_residue: Optional[dict] = Field(
        default=None, description="Combined auth selection {auth_chain: str, auth_residue: int}"
    )

    # Structural selections
    secondary_structure: Optional[Literal["helix", "sheet", "coil"]] = Field(
        default=None, description="Secondary structure type"
    )
    type: Optional[
        Literal[
            "all",
            "polymer",
            "protein",
            "nucleic",
            "water",
            "ion",
            "lipid",
            "branched",
            "ligand",
            "non-standard",
            "coarse",
        ]
    ] = Field(default=None, description="Polymer type")

    # Proximity selections
    within_distance: Optional[dict] = Field(
        default=None, description="Within distance {radius: float, target: MolecularSelection}"
    )


class MolstarAPI(metaclass=SingletonMeta):
    """
    API for interacting with Mol* visualizer inside Horus
    """

    _flow: typing.Optional["Flow"] = None
    """
    The current flow where the API is running
    """

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

    def addMolecule(
        self,
        filePath: str,
        label: typing.Optional[str] = None,
        theme: typing.Optional[MolstarThemeOptions] = None,
    ) -> None:
        """
        Adds the given Molecule file to Mol*

        :param filePath: The path to the molecule file
        :param label: The label for the molecule. Optional. Defaults to the filename
        """

        # with open(filePath, "rb") as fopen:
        #     molecule = fopen.read().hex()

        fileName = os.path.basename(filePath)
        absPath = os.path.abspath(filePath)

        data = {
            "type": "addMolecule",
            "data": {
                "fileName": fileName,
                "molContent": absPath,
                "options": {
                    "label": label if label else fileName,
                    "theme": theme.model_dump() if theme else None,
                },
            },
        }

        self._emitAction("loadMolecule", data)

    def addComponent(
        self,
        label: str,
        selectionLabel: str,
        selection: MolecularSelection,
        theme: typing.Optional[MolstarThemeOptions] = None,
    ):
        """
        Adds a component to an existing structure given the label and a selection.

        :param label: The loaded structure to which apply the component
        :param selectionLabel: The new component label
        :param selection: The specific selection of the structure provided in the label
        :param theme: Custom theme to apply to the selection
        """

        if not label or not selectionLabel or not selection:
            raise ValueError(
                "Missing parameters. "
                "Cannot create a molecular component "
                "if the label or the selection label is not given."
            )

        data = {
            "type": "addComponent",
            "data": {
                "label": label,
                "selectionLabel": selectionLabel,
                "options": {
                    "selection": selection.model_dump(),
                    "theme": theme.model_dump() if theme else None,
                },
            },
        }

        self._emitAction("addComponent", data)

    # TODO: create selection & apply themes

    def loadTrajectory(
        self, topology: str, trajectory: str, label: typing.Optional[str] = None
    ) -> None:
        """
        Adds the given trajectory file to Mol*

        :param topology: The path to the topology file
        :param trajectory: The path to the trajectory file
        :param label: The label for the trajectory. Optional. Defaults to the filename
        """

        topology = os.path.abspath(topology)
        trajectory = os.path.abspath(trajectory)

        data = {
            "type": "loadTrajectory",
            "data": {
                "topology": topology,
                "topologyFileName": os.path.basename(topology),
                "trajectory": trajectory,
                "trajectoryFileName": os.path.basename(trajectory),
                "label": label if label else os.path.basename(topology),
            },
        }

        self._emitAction("loadTrajectory", data)

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
        center: list[float],
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

        if not center or not isinstance(center, list) or len(center) != 3:
            raise ValueError(
                "Center must be a 3 dimensional list of numbers [x, y, z]. "
                f"Got value '{center}'"
            )

        position = {
            "x": float(center[0]),
            "y": float(center[1]),
            "z": float(center[2]),
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

    def addBox(
        self,
        center: list[float],
        sides: typing.Optional[list[float]] = None,
        lineSize: float = 1,
        color: typing.Optional[str] = None,
        opacity: float = 1,
    ) -> None:
        """
        Adds a box to the scene.

        :param center: The x, y and z coordinates of the center of the box as a list of [x, y ,z]
        :param sides: The a, b and c lengths of the box as a list of [a, b ,c].
        Defaults to [1, 1, 1]
        :param lineSize: The width of the lines. Defaults to 1.
        :param color: The color of the box as an RGB hex string (i.e. #0000FF)
        Defaults to random color.
        :param opacity: The opacity of the box (0.0 - 1.0). Defaults to 1.
        """

        # Changed the sides property from a default valu of list to None
        # in order to fix python's default mutable value
        # https://pylint.readthedocs.io/en/latest/user_guide/messages/warning/dangerous-default-value.html
        if not sides:
            sides = [1, 1, 1]

        # Accept ints and convert to floats for center
        if (
            not isinstance(center, list)
            or len(center) != 3
            or not all(isinstance(x, (float, int)) for x in center)
        ):
            raise ValueError(
                "Center must be a 3 dimensional list of numbers [x, y, z]. "
                f"Got value '{center}'"
            )

        center = [float(x) for x in center]

        # Accept ints and convert to floats for sides
        if (
            not isinstance(sides, list)
            or len(sides) != 3
            or not all(isinstance(x, (float, int)) for x in sides)
        ):
            raise ValueError(
                "Sides must be a 3 dimensional list of numbers [a, b, c]. " f"Got value '{sides}'"
            )

        sides = [float(x) for x in sides]

        position = {
            "x0": center[0],
            "y0": center[1],
            "z0": center[2],
            "x1": sides[0],
            "y1": 0,
            "z1": 0,
            "x2": 0,
            "y2": sides[1],
            "z2": 0,
            "x3": 0,
            "y3": 0,
            "z3": sides[2],
        }

        # Convert the color to a hex string without the #
        # The TS molstar class will use the default color if None is given
        if color is not None:
            if not color.startswith("#"):
                color = "#" + color
        else:
            color = "#0000FF"

        data = {
            "type": "addBox",
            "data": {
                "position": position,
                "radiusScale": lineSize,
                "radialSegments": 5,
                "color": color,
                "opacity": opacity,
            },
        }

        self._emitAction("addBox", data)

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

    def setSpin(self, speed: float = 1) -> None:
        """
        Sets the spin of the molecule.

        :param speed: The rotation speed. Defaults to 1. To stop it, set the speed to 0
        """

        data = {"type": "setSpin", "data": {speed: speed}}

        self._emitAction("setSpin", data)

    def reset(self) -> None:
        """
        Resets the visualizer
        """

        data = {"type": "reset", "data": {}}

        self._emitAction("reset", data)
