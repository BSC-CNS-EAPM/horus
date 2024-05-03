// Mol* imports
import { AnimateModelIndex } from "molstar/lib/mol-plugin-state/animation/built-in/model-index";
import { createStructureRepresentationParams } from "molstar/lib/mol-plugin-state/helpers/structure-representation-params";
import { PluginStateObject } from "molstar/lib/mol-plugin-state/objects";
import { StateTransforms } from "molstar/lib/mol-plugin-state/transforms";
import { createPluginUI } from "molstar/lib/mol-plugin-ui/react18";
import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";
import { DefaultPluginUISpec } from "molstar/lib/mol-plugin-ui/spec";
import { OpenFiles } from "molstar/lib/mol-plugin-state/actions/file";
import { PluginCommands } from "molstar/lib/mol-plugin/commands";
import { MolScriptBuilder as MS } from "molstar/lib/mol-script/language/builder";
import { Asset } from "molstar/lib/mol-util/assets";
import { Color } from "molstar/lib/mol-util/color";
import { ColorNames } from "molstar/lib/mol-util/color/names";
import { PluginConfig } from "molstar/lib/mol-plugin/config";
import { Script } from "molstar/lib/mol-script/script";
import { StructureSelection } from "molstar/lib/mol-model/structure/query";
import {
  Structure,
  StructureElement,
  StructureProperties,
  Unit,
} from "molstar/lib/mol-model/structure";
import { Loci } from "molstar/lib/mol-model/structure/structure/element/loci";
import { addSphereTo } from "./sphere";
import { DockingSphereRepresentationProvider } from "./sphere";
import { addBoxTo } from "./box";
import { DockingBoxRepresentationProvider } from "./box";
import { ObjectKeys } from "molstar/lib/mol-util/type-helpers";
import { PluginSpec } from "molstar/lib/mol-plugin/spec";
import { StructureRef } from "molstar/lib/mol-plugin-state/manager/structure/hierarchy-state";
import { Vec3 } from "molstar/lib/mol-math/linear-algebra";

// Import the molviewspec library
import { loadMVS } from "molstar/lib/extensions/mvs/load";
import { MVSData } from "molstar/lib/extensions/mvs/mvs-data";
import { MolViewSpec } from "molstar/lib/extensions/mvs/behavior";
import { StateObjectSelector } from "molstar/lib/mol-state";
import { BuiltInTrajectoryFormats } from "molstar/lib/mol-plugin-state/formats/trajectory";

// Definition of useful types
export type AtomInfo = {
  name: string;
  residue: number;
  chainID: string;
  atom_index: number;
  auth_comp_id: string;
  auth_atom_id: string;
  type: string;
  x: number;
  y: number;
  z: number;
  label: string;
  structureID?: string;
};

export type MolInfo = {
  id: string;
  label: string;
  fileContents: string;
  fileName: string;
  format: string;
};

export type MolstarClickEventDetail = {
  x: number;
  y: number;
  z: number;
  atom: AtomInfo | null;
};

export type MolstarStateEventDetail = {
  updating: boolean;
};

export enum StateElements {
  root = "-=root=-",

  Model = "model",
  ModelProps = "model-props",
  Assembly = "assembly",

  VolumeStreaming = "volume-streaming",

  Sequence = "sequence",
  SequenceVisual = "sequence-visual",
  Het = "het",
  HetVisual = "het-visual",
  Het3DSNFG = "het-3dsnfg",
  Water = "water",
  WaterVisual = "water-visual",

  HetGroupFocus = "het-group-focus",
  HetGroupFocusGroup = "het-group-focus-group",

  Selection = "selection",
  SelectionGroup = "selection-group",
}

// Mol* events
export enum MolstarEvents {
  COORDINATES = "molstar-coordinates",
  STATE = "molstar-state-event",
}

export default class HorusMolstar {
  plugin: PluginUIContext | null = null;
  target: HTMLDivElement;

  constructor(target: HTMLDivElement) {
    this.target = target;
    this.initPlugin();
  }

  private async initPlugin() {
    const ExtensionMap = {
      // @ts-ignore
      mvs: PluginSpec.Behavior(MolViewSpec),
    };

    this.plugin = await createPluginUI(this.target, {
      ...DefaultPluginUISpec(),
      behaviors: [
        ...DefaultPluginUISpec().behaviors,
        ...ObjectKeys(ExtensionMap).map((k) => ExtensionMap[k]),
      ],
      animations: [AnimateModelIndex],
      config: [
        [PluginConfig.Viewport.ShowExpand, false],
        [PluginConfig.Viewport.ShowControls, true],
        [PluginConfig.Viewport.ShowSelectionMode, true],
      ],
      layout: {
        initial: {
          isExpanded: true,
          showControls: false,
        },
      },
      components: {
        remoteState: "none",
      },
    });

    const renderer = this.plugin?.canvas3d?.props?.renderer;

    if (!renderer) {
      throw new Error("Failed to initialize Mol*. Is WebGL available?");
    }

    PluginCommands.Canvas3D.SetSettings(this.plugin, {
      settings: {
        renderer: {
          ...renderer,
          backgroundColor: ColorNames.white,
        },
      },
    });

    this.plugin.representation.structure.registry.add(
      DockingSphereRepresentationProvider
    );
    this.plugin.representation.structure.registry.add(
      DockingBoxRepresentationProvider
    );
    this.plugin.behaviors.layout.leftPanelTabName.next("data");

    // Add the molstar events
    this.molstarEvents();
  }

  private molstarEvents() {
    this.plugin!.behaviors.interaction.click.subscribe((e) => {
      // Get the position of the click
      if (e.position) {
        const x: number = Number(e.position[0]?.toFixed(1) ?? 0);
        const y: number = Number(e.position[1]?.toFixed(1) ?? 0);
        const z: number = Number(e.position[2]?.toFixed(1) ?? 0);

        const detail: MolstarClickEventDetail = {
          x: Number(x),
          y: Number(y),
          z: Number(z),
          // If the item we clicked can be interacted, extract its information
          atom: StructureElement.Loci.is(e.current.loci)
            ? this.extractAtomInfoFromLoci(e.current.loci)
            : null,
        };

        // Send the values through a custom event "molstar-coordinates"
        const event = new CustomEvent(MolstarEvents.COORDINATES, {
          detail: detail,
        });

        window.dispatchEvent(event);
      }
    });

    this.plugin!.behaviors.state.isUpdating.subscribe((e) => {
      // Send the values through a custom event "molstar-state-event"

      const detail: MolstarStateEventDetail = {
        updating: e,
      };

      const event = new CustomEvent(MolstarEvents.STATE, {
        detail: detail,
      });
      window.dispatchEvent(event);
    });
  }

  /**
   * A temporary storage for a snapshot of the current state of the view.
   *
   * This is used to save the state before redisposing or unloading the 3D canvas,
   * allowing the state to be restored later if needed.
   *
   * @type {Blobl | null}
   */
  private latestSnapshot: Blob | null = null;

  /**
   * Resets the plugin to its initial state.
   *
   * This method initializes the plugin again, effectively resetting it to
   * a clean state. This can be useful when you need to start fresh or clear
   * all existing data.
   *
   * @throws {Error} If the plugin initialization fails.
   */
  public async reset() {
    await this.initPlugin();
  }

  /**
   * Unloads the current 3D canvas and saves a temporary snapshot of the state.
   *
   * This method saves the current state in `latestSnapshot` before disposing
   * of the plugin, allowing you to restore it later if needed. It then disposes
   * of the plugin to free up resources. You can reload this istate using the refresh() method
   *
   * @returns {Promise<void>} A promise that resolves when the operation is complete.
   * @throws {Error} If there's an issue with disposing of the plugin or saving the snapshot.
   */
  public async unloadWithState() {
    // Save the state
    this.latestSnapshot = await this.snapshot.get();

    if (!this.plugin) {
      throw new Error("Plugin is not initialized");
    }

    // Remove the plugin
    this.plugin.dispose();
  }

  /**
   * Refreshes the view by re-initializing the plugin and restoring the state.
   *
   * This method is useful when you need to reset the 3D canvas but then
   * restore it to a previous state. It re-initializes the plugin and sets
   * the state to the latest snapshot stored in `latestSnapshot`.
   *
   * @returns {Promise<void>} A promise that resolves when the re-initialization
   *                          and state restoration are complete.
   * @throws {Error} If there's an issue with initializing the plugin or restoring the snapshot.
   */
  public async refresh() {
    // Init the plugin
    await this.initPlugin();

    // Load the state
    this.latestSnapshot && this.snapshot.set(this.latestSnapshot);
  }

  /**
   * Retrieves the current state of the plugin.
   *
   * @returns {any} The current state data of the plugin. The exact structure
   *                of the state depends on the implementation of the `plugin`.
   *                This could be an object, an array, or any other data type.
   *
   * @throws {Error} If `plugin` is undefined or if there's an issue accessing
   *                 the state data.
   */
  get state() {
    if (!this.plugin) {
      throw new Error("Plugin is not initialized");
    }
    return this.plugin.state.data;
  }

  /**
   * Sets the background color of the 3D canvas.
   *
   * This method updates the background color of the plugin's 3D canvas to a specified
   * hexadecimal color. If the plugin or the canvas3d property is not defined, it
   * does nothing.
   *
   * @param {string} hexColor The desired background color in hexadecimal format (e.g., "#FFFFFF").
   *
   * @returns {Promise<void>} A promise that resolves when the background color is set.
   *
   * @throws {Error} If an invalid hex color string is provided or if there is an error
   *                 updating the 3D canvas settings.
   */
  public async setBackground(hexColor: string): Promise<void> {
    if (!this.plugin?.canvas3d) {
      throw new Error(
        "3D canvas is not available. Cannot set background color."
      );
    }

    try {
      const renderer = this.plugin.canvas3d.props.renderer;

      await PluginCommands.Canvas3D.SetSettings(this.plugin, {
        settings: {
          renderer: {
            ...renderer,
            backgroundColor: Color.fromHexStyle(hexColor),
          },
        },
      });
    } catch (error) {
      throw new Error(
        `Failed to set background color: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Sets the spinning animation of the 3D canvas.
   *
   * If set to 0, the spin will be removed from the canvas
   * For other numbers, it starts the spin animation with a default speed of 1.
   * If the plugin or the canvas3d property is not defined, it does nothing.
   *
   * @param {number} [speed=1] The speed of the spin animation. Defaults to 1 if not provided.
   *
   * @returns {Promise<void>} A promise that resolves once the spin setting is set.
   *
   * @throws {Error} If there's an error setting the 3D canvas settings.
   */
  private async setSpin(speed: number = 1): Promise<void> {
    if (!this.plugin?.canvas3d) {
      throw new Error("3D canvas is not available. Cannot set spin.");
    }

    try {
      const trackball = this.plugin.canvas3d.props.trackball;

      const newAnimation =
        speed === 0
          ? { name: "off", params: {} }
          : { name: "spin", params: { speed: speed } };

      await PluginCommands.Canvas3D.SetSettings(this.plugin, {
        settings: {
          trackball: {
            ...trackball,
            // @ts-ignore
            animate: newAnimation,
          },
        },
      });
    } catch (error) {
      throw new Error(
        `Failed to toggle spin: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Public property to interact with camera operations.
   */
  public camera = {
    /**
     * Sets the spin on or off based on the speed parameter.
     *
     * @param {number} speed The speed of the spin animation.
     *
     * @returns {Promise<void>} A promise that resolves once the spin setting is applied.
     */
    setSpin: async (speed: number) => {
      await this.setSpin(speed);
    },

    /**
     * Resets the camera position to its default state.
     *
     * @returns {Promise<void>} A promise that resolves once the camera is reset.
     */
    resetPosition: async () => {
      await PluginCommands.Camera.Reset(this.plugin!, {});
    },
  };

  /**
   * Serializes the current plugin session to a Blob in the "molx" format.
   *
   * This method erases previous session snapshots and creates a new session snapshot,
   * serializing it to a Blob. The "molx" format is essentially a ZIP file that contains
   * the state of the Mol* environment, including the canvas, camera, component manager,
   * and other interactive elements.
   *
   * @returns {Promise<Blob>} A promise that resolves to a Blob representing the serialized session.
   *
   * @throws {Error} If there's an error during serialization or clearing snapshots.
   */
  private async getSession(): Promise<Blob> {
    if (!this.plugin) {
      throw new Error("Plugin is not initialized. Cannot get session.");
    }

    try {
      // Erase previous session snapshots
      this.plugin.managers.snapshot.clear();

      // Serialize the current session to the "molx" format
      const molxSession = await this.plugin.managers.snapshot.serialize({
        type: "molx",
        params: {
          data: true,
          componentManager: true,
          canvas3d: true,
          interactivity: true,
          camera: true,
        },
      });

      // The molx format is a ZIP file that can store the Mol* state
      // The Blob returned contains the serialized session in "molx" format
      return molxSession;
    } catch (error) {
      throw new Error(
        `Failed to get session: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Loads a session from a given input, either as a string or a Blob.
   *
   * @param session The session data to load. It can be a string representing a hex-encoded session
   *                or a Blob representing a legacy session.
   *
   * @returns {Promise<void>} A promise that resolves when the session is loaded.
   *
   * @throws {Error} If an error occurs during session loading.
   */
  private async loadSession(session: string | Blob): Promise<void> {
    try {
      let file: File;

      if (typeof session === "string") {
        // Convert the session string to a binary Blob
        const b = hexToBlob(session);
        file = new File([b], "session.molx", {
          type: "application/zip",
        });
      } else {
        // Treat it as a Blob for a legacy session
        file = new File([session], "session.molx", {
          type: "application/zip",
        });
      }

      // Load the session
      await PluginCommands.State.Snapshots.OpenFile(this.plugin!, { file });
    } catch (error) {
      throw new Error(
        `Failed to load session: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * An object that provides methods for getting and setting session snapshots.
   *
   * This property allows you to retrieve the current session as a Blob and set
   * a session from a string or Blob. It is useful for saving and loading Mol* sessions.
   */
  public snapshot = {
    /**
     * Gets the current session as a Blob.
     *
     * This method retrieves the current Mol* session as a Blob in "molx" format.
     * It can be used to save the current state or to transfer it elsewhere for
     * later use.
     *
     * @returns {Promise<Blob>} A promise that resolves with a Blob representing the serialized session.
     *
     * @throws {Error} If an error occurs while retrieving the session.
     */
    get: async (): Promise<Blob> => {
      return await this.getSession();
    },

    /**
     * Sets a session from a given string or Blob.
     *
     * This method loads a session from either a hex-encoded string or a Blob.
     * It can be used to restore a previously saved session, allowing the user
     * to return to a specific state in Mol*.
     *
     * @param {string | Blob} snapshot The session data to set, either as a string (binary hex encoded) or a Blob.
     *
     * @returns {Promise<void>} A promise that resolves when the session is loaded.
     *
     * @throws {Error} If an error occurs while loading the session.
     */
    set: async (snapshot: string | Blob): Promise<void> => {
      await this.loadSession(snapshot);
    },
  };

  /**
   * Retrieves a structure reference from a given model ID.
   *
   * This method searches through the list of structures to find one whose model
   * has the specified ID. If a matching structure is found, it is returned.
   * Otherwise, it returns `null`.
   *
   * @param {string} modelID The unique identifier of the model to find.
   *
   * @returns {StructureRef | null} The structure reference corresponding to the given model ID,
   *                                or `null` if no matching structure is found.
   *
   * @throws {Error} If the `structures()` method or its return value is invalid.
   */
  private getStructureFromModelID(modelID: string): StructureRef | null {
    try {
      return (
        this.structures().find((s) => s.model?.cell.obj?.data.id === modelID) ??
        null
      );
    } catch (error) {
      throw new Error(
        `Failed to get structure from model ID '${modelID}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Retrieves the structure ID (suitable for focusing) associated with a given structure reference.
   *
   * This method scans through all cells in the current state, looking for those
   * with a "Structure" property whose object type matches "Structure". If a
   * matching cell is found, its key is returned. If no matching cell is found,
   * the method returns `null`.
   *
   * @param {StructureRef} structure The structure reference to find the associated model ID.
   *
   * @returns {string | null} The key corresponding to the first cell with a "Structure" property,
   *                          or `null` if no matching cell is found.
   *
   * @throws {Error} If there's an error while accessing the state cells or their properties.
   */
  private getStructureIDFromStructureRef(
    structure: StructureRef
  ): string | null {
    try {
      // Find the first cell with a "Structure" type that matches the given structure reference
      return (
        Array.from(this.state.cells.entries()).find(([, value]) => {
          return (
            value.obj?.type?.name === "Structure" &&
            value.sourceRef === structure.cell.sourceRef
          );
        })?.[0] ?? null
      ); // Retrieve the key if found, otherwise return null
    } catch (error) {
      throw new Error(
        `Error finding model ID from structure: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Retrieves the first structure reference that matches the given label.
   *
   * This method searches through the list of structures to find the first structure
   * whose cell object has a matching label. If multiple structures have the same label,
   * this method may not return the one you expect. If no structure matches the given label,
   * the method returns `null`.
   *
   * @param {string} structureLabel The label to search for.
   * @param {boolean} [first=true] Wether to find the first or the latest structure
   *
   * @returns {StructureRef | null} The first structure reference that matches the given label,
   *                                or `null` if no matching structure is found.
   *
   * @throws {Error} If there's an error while accessing the structures or their properties.
   */
  private getStructureObjectFromLabel(
    structureLabel: string,
    first: boolean = true
  ): StructureRef | null {
    try {
      const structures = this.structures();

      if (!first) {
        structures.reverse();
      }

      return (
        structures.find(
          (s) =>
            this.getLabelFromStructureRef(s.cell.sourceRef!) === structureLabel
        ) ?? null
      );
    } catch (error) {
      throw new Error(
        `Failed to get structure from label '${structureLabel}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Focuses on a specified structure, residue, and chain within a 3D visualization environment.
   *
   * If no `structureLabel` is provided, the method focuses on the first structure available.
   * If no `residueNumber` is specified, the entire structure is focused. If a specific `residueNumber`
   * and `chain` are provided, the focus is centered on that particular residue within the given chain.
   *
   * @param {string} [structureLabel] The label of the structure to focus on. If not provided, the first available structure is used.
   * @param {number} [residueNumber] The residue number to focus on. If not provided, the entire structure is focused.
   * @param {string} [chain] The chain ID within the structure to focus on. If not provided, the first available chain is used.
   * @param {number} [surroundRadius=0] The radius to focus around the specified residue. Defaults to 0.
   *
   * @returns {Promise<string>} A promise that resolves with a message describing the focus action taken.
   *
   * @throws {Error} If an unexpected error occurs during the focusing process.
   */
  public async focus(
    structureLabel?: string,
    residueNumber?: number,
    chain?: string,
    surroundRadius: number = 0
  ): Promise<string> {
    let message = "";

    const structures = this.listStructures();

    // If no structure label is specified, focus on the first available structure
    if (!structureLabel) {
      if (structures.length === 0) {
        return "No structures loaded";
      }
      structureLabel = structures[0]!.label;
      message = `No structure specified, focusing on '${structureLabel}'.`;
    } else {
      // Validate the existence of the specified structure
      const structureRef = this.getStructureObjectFromLabel(structureLabel);
      if (!structureRef) {
        message = `No structure with label '${structureLabel}' found.`;
        const structureList = structures.map((s) => s.label);
        message += ` Available structures: ${structureList.join(", ")}`;
        return message;
      }
    }

    const structureRef = this.getStructureObjectFromLabel(structureLabel);

    if (!structureRef) {
      throw new Error(
        `Could not find structure with label '${structureLabel}'`
      );
    }

    // If no residue number is specified, focus on the entire structure
    if (!residueNumber) {
      message += " No residue specified, focusing on the whole structure.";
      const boundary = structureRef.cell.obj?.data.boundary.sphere ?? {
        radius: 5,
        center: Vec3.zero(),
      };
      const radius = Math.max(boundary.radius, 5);

      const snapshot = this.plugin!.canvas3d!.camera.getFocus(
        boundary.center,
        radius
      );
      await PluginCommands.Camera.SetSnapshot(this.plugin!, {
        snapshot,
        durationMs: 250,
      });

      return message;
    }

    // If a residue number is specified, focus on the specified chain and residue
    const chains = this.listChains(structureLabel);
    if (!chain) {
      if (chains.length === 0) {
        return `No chains found in structure '${structureLabel}'.`;
      }
      chain = chains[0]!.chainID;
      message += ` Chain not specified, focusing on '${chain}'.`;
    } else {
      // Validate the existence of the specified chain
      if (!chains.some((c) => c.chainID === chain)) {
        message += ` Chain '${chain}' not found in structure '${structureLabel}'.`;
        message += ` Available chains: ${chains
          .map((c) => `'${c.chainID}'`)
          .join(", ")}`;
        return message;
      }
    }

    message += await this.focusSpecificResidue(
      residueNumber,
      structureRef,
      chain,
      surroundRadius
    );

    return message;
  }

  /**
   * Focuses on a specific residue within a given structure and chain in a 3D visualization.
   *
   * This method creates a selection of the specified residue within the provided structure
   * and optionally focuses on the surrounding area based on the `surroundRadius`. If focusing
   * on the residue fails, it defaults to focusing on the entire structure.
   *
   * @param {number} residueID The residue number to focus on.
   * @param {StructureRef} structureObject The reference to the structure containing the residue.
   * @param {string} chain The ID of the chain containing the residue.
   * @param {number} [surroundRadius=0] The radius to include additional surrounding atoms.
   *
   * @returns {Promise<string>} A promise that resolves to a message indicating the focus action taken.
   *
   * @throws {Error} If an unexpected error occurs while building or updating the state.
   */
  private async focusSpecificResidue(
    residueID: number,
    structureObject: StructureRef,
    chain: string,
    surroundRadius: number = 0
  ) {
    // Get the 'Update' object from Mol*. This is used to update the state of the visualizer
    const update = this.state.build();

    // Delete any previous selections
    update.delete(StateElements.Selection);

    // Define a label for the new selection, this will appear on the Mol* state tree
    const focusLabel = `Focus - ${residueID}`;

    // Get the residue from the provided resdiue number
    // We define a filter group. This will tell Mol* to filter the structure and only keep the residues that match the filter
    const filterGroups: any = {
      "residue-test": MS.core.rel.eq([
        MS.struct.atomProperty.macromolecular.auth_seq_id(),
        residueID,
      ]),
      "group-by": MS.core.str.concat([
        MS.struct.atomProperty.core.operatorName(),
        MS.struct.atomProperty.macromolecular.residueKey(),
      ]),
    };

    // If a chain is specified, add the chain filter to the filter group
    if (chain) {
      filterGroups["chain-test"] = MS.core.rel.eq([
        MS.struct.atomProperty.macromolecular.auth_asym_id(),
        chain || "A",
      ]);
    }

    // We call the filter function to filter the structure and obtain the first residue that matches the filter
    const filteredResidue = MS.struct.filter.first([
      MS.struct.generator.atomGroups(filterGroups),
    ]);

    // Select the model where we will place the new focus group
    const modelKey = this.getStructureIDFromStructureRef(structureObject);

    if (!modelKey) {
      return " Internal error: No suitable model found";
    }

    const model = this.state.select(modelKey)[0]!
      .obj as PluginStateObject.Molecule.Structure;

    // Now we will add, under the desired structure tree, a new model for the selection
    // We use the update object to add a new model to the structure tree. We assign to this
    // model the label we defined earlier and a reference to the selection object, so later
    // we can use it to create a representation or to delete it
    const group = update
      .to(modelKey)
      .group(
        StateTransforms.Misc.CreateGroup,
        { label: focusLabel },
        { ref: StateElements.Selection }
      );

    // Inside the new group named 'Focus' we create the actual residue selection
    // We assign to it the SelectionGroup too
    const filteredResidueInner = group.apply(
      StateTransforms.Model.StructureSelectionFromExpression,
      { label: "Residue " + residueID, expression: filteredResidue },
      { ref: StateElements.SelectionGroup }
    );

    // To our new selection, we add a representation based on the data of the structure
    // We assing the ball-and-stick representation to the selection, so we can see the residue's atoms
    filteredResidueInner.apply(
      StateTransforms.Representation.StructureRepresentation3D,
      createStructureRepresentationParams(this.plugin!, model.data, {
        type: "ball-and-stick",
      })
    );

    // If the user specified a radius for the surroundings, we will create a new selection
    if (surroundRadius > 0) {
      // We will apply a modifier to the selection, to include the surroundings of the residue
      const surroundings = MS.struct.modifier.includeSurroundings({
        0: filteredResidue,
        radius: surroundRadius,
        "as-whole-residues": true,
      });

      // Then, to the existing group, we will add a new selection which represents the surroundings
      group
        .apply(StateTransforms.Model.StructureSelectionFromExpression, {
          label: "Surroundings",
          expression: surroundings,
        })
        .apply(
          StateTransforms.Representation.StructureRepresentation3D,
          createStructureRepresentationParams(this.plugin!, model.data, {
            type: "ball-and-stick",
          })
        );
    }

    // From the new selection, we will get the bounding sphere
    let boundingSphere;
    try {
      // Now we will update the Mol* state to apply the changes we made
      // This will add to the state tree the new selection and the new representation
      // (basically everithing inside the 'update' object)
      await PluginCommands.State.Update(this.plugin!, {
        state: this.state,
        tree: update,
      });

      // Get the bounding sphere of the selection, this will be useful to center the camera
      boundingSphere = (
        this.state.select(StateElements.SelectionGroup)[0]!
          .obj as PluginStateObject.Molecule.Structure
      ).data.boundary.sphere;
    } catch {
      boundingSphere = undefined;
    }

    let message = "";
    // If the focus failed, return an error message
    if (boundingSphere === undefined) {
      boundingSphere = model.data.boundary.sphere;

      // Remove the focus group†
      const newUpdate = this.state.build();
      newUpdate.delete(StateElements.Selection);

      // Update the state
      await PluginCommands.State.Update(this.plugin!, {
        state: this.state,
        tree: newUpdate,
      });

      message = " No residues to focus found. Focusing whole structure.";
    } else {
      message = " Focusing residue " + residueID + ".";
    }

    // Now we will change the camera perspective to focus the bounding sphere, which happens to be
    // centered around the desired residue
    const radius = Math.max(boundingSphere.radius, 5);
    const snapshot = this.plugin!.canvas3d!.camera.getFocus(
      boundingSphere.center,
      radius
    );

    // Finally, we will animate the camera to the new position
    PluginCommands.Camera.SetSnapshot(this.plugin!, {
      snapshot,
      durationMs: 250,
    });

    return message;
  }

  /**
   * Loads a molecule file into the plugin and applies default presets for visualization.
   *
   * This method reads the provided file, parses it as a molecule data asset, and applies
   * default presets for visualization. It supports optional configuration options such as
   * specifying a label for the loaded molecule.
   *
   * @param {File} file The molecule file to load.
   * @param {object} [options] Additional configuration options.
   * @param {string} [options.label] The label to assign to the loaded molecule.
   *
   * @returns {Promise<void>} A promise that resolves once the molecule file is loaded and presets are applied.
   *
   * @throws {Error} If an error occurs during file parsing or preset application, or if the plugin is not initialized.
   */
  public async loadMoleculeFile(
    file: File,
    options?: {
      label?: string;
    }
  ): Promise<void> {
    if (!this.plugin) {
      throw new Error("Plugin is not initialized. Cannot load molecule file.");
    }

    try {
      const parseFileAsAsset = Asset.File(file);

      const ext = file.name.split(".").pop();
      const isAllowed = BuiltInTrajectoryFormats.find(
        (format) => format[0] === ext
      );

      if (isAllowed) {
        // Read the file and parse it as a molecule data asset
        const data = await this.plugin.builders.data.readFile({
          file: parseFileAsAsset,
          label: options?.label ?? void 0,
        });

        // Parse the trajectory data and apply default presets for visualization
        const trajectory =
          // @ts-ignore -> Ignore the extension
          await this.plugin!.builders.structure.parseTrajectory(data.data, ext);

        await this.plugin.builders.structure.hierarchy.applyPreset(
          trajectory,
          "default"
        );
      } else {
        // Use the old method of dropping a file into molstar
        // Using "drag and drop action" to upload a structure

        console.warn(
          `When loading ${ext} files, setting the label is not supported.`
        );

        await this.plugin.runTask(
          this.plugin.state.data.applyAction(OpenFiles, {
            files: [parseFileAsAsset],
            format: { name: "auto", params: {} },
            visuals: true,
          })
        );
      }
    } catch (error) {
      console.error(
        `Failed to load molecule file: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async loadPDBString(pdbString: string, label: string) {
    console.warn(
      "loadPDBString will be soon deprecated use loadMoleculeString instead."
    );

    // Parse the data from the string
    pdbString = parsePDB(pdbString);
    // Load the parsed data
    const data = await this.plugin!.builders.data.rawData({
      data: pdbString,
      label: label,
    });
    const trajectory = await this.plugin!.builders.structure.parseTrajectory(
      data,
      "pdb"
    );
    const model = await this.plugin!.builders.structure.createModel(trajectory);
    const structure = await this.plugin!.builders.structure.createStructure(
      model
    );

    const components = {
      polymer: await this.plugin!.builders.structure.tryCreateComponentStatic(
        structure,
        "polymer"
      ),
      ligand: await this.plugin!.builders.structure.tryCreateComponentStatic(
        structure,
        "ligand"
      ),
      water: await this.plugin!.builders.structure.tryCreateComponentStatic(
        structure,
        "water"
      ),
    };

    const proteinColorType = "polymer-id";
    const ligandColorType = "element-symbol";

    const builder = this.plugin!.builders.structure.representation;
    const update = this.plugin!.build();
    if (components.polymer)
      builder.buildRepresentation(
        update,
        components.polymer,
        {
          type: "cartoon",
          typeParams: { alpha: 1 },
          color: proteinColorType as any,
          colorParams: { value: Color.fromRgb(1, 0, 0) },
        },
        { tag: "polymer" }
      );
    if (components.ligand)
      builder.buildRepresentation(
        update,
        components.ligand,
        {
          type: "ball-and-stick",
          color: ligandColorType as any,
          colorParams: { value: Color.fromRgb(1, 0, 0) },
        },
        { tag: "ligand" }
      );
    if (components.water)
      builder.buildRepresentation(
        update,
        components.water,
        { type: "ball-and-stick", typeParams: { alpha: 0.6 } },
        { tag: "water" }
      );
    await update.commit();
  }

  /**
   * Generates a selection Loci for a given structure based on a predefined script.
   *
   * This method creates an atom group selection based on a specific condition,
   * such as matching a particular chain label. It returns the selection in the
   * form of a Loci, which can be used to identify specific atoms or regions within
   * the structure.
   *
   * @param {Structure} structure The structure to generate the Loci for.
   *
   * @returns {Loci} The generated Loci representing the selection within the structure.
   *
   * @throws {Error} If there's an error creating the selection or converting it to a Loci.
   */
  private getLociForStructure(structure: Structure): Loci {
    if (!structure) {
      throw new Error("Structure is not provided. Cannot generate Loci.");
    }

    try {
      const selection = Script.getStructureSelection(
        (Q) =>
          Q.struct.generator.atomGroups({
            "chain-test": Q.core.rel.eq(["B", Q.ammp("label_asym_id")]),
          }),
        structure
      );

      const loci = StructureSelection.toLociWithSourceUnits(selection);

      return loci;
    } catch (error) {
      throw new Error(
        `Failed to generate Loci for structure: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private extractAtomInfo(
    loc: StructureElement.Location<Unit>,
    structureID?: string
  ): AtomInfo {
    // auth_seq_id  : UniProt coordinate space
    // label_seq_id : PDB coordinate space
    const resID = StructureProperties.residue.label_seq_id(loc);
    const sourceIndex = StructureProperties.atom.sourceIndex(loc);
    let auth_comp_id = StructureProperties.atom.auth_comp_id(loc);
    const auth_atom_id = StructureProperties.atom.auth_atom_id(loc);
    const chainID = StructureProperties.chain.label_asym_id(loc);
    const type = StructureProperties.atom.type_symbol(loc);
    const x = StructureProperties.atom.x(loc);
    const y = StructureProperties.atom.y(loc);
    const z = StructureProperties.atom.z(loc);
    const label = structureID
      ? this.getLabelFromStructureRef(structureID)
      : StructureProperties.unit.model_label(loc);

    // If auth_comp_id has 2 characters instead of 3, then add a space
    // before it
    if (auth_comp_id.length === 2) {
      auth_comp_id = " " + auth_comp_id;
    }

    // Define the information about the clicked element
    return {
      name: `${auth_comp_id}:${resID} - ${label}`,
      residue: resID,
      chainID: chainID,
      atom_index: sourceIndex,
      auth_comp_id: auth_comp_id,
      auth_atom_id: auth_atom_id,
      type: type,
      x: x,
      y: y,
      z: z,
      label: label,
      structureID: structureID,
    };
  }

  private extractAtomInfoFromLoci(loci: StructureElement.Loci) {
    // Get the location based on the clicked element
    const loc = StructureElement.Location.create();
    StructureElement.Loci.getFirstLocation(loci, loc);
    return this.extractAtomInfo(loc);
  }

  /**
   * Retrieves the list of current structures in the plugin's structure hierarchy.
   *
   * This method accesses the current structures in the Mol* plugin's structure hierarchy
   * through the plugin's managers. It can be used to get an array of structure references
   * currently managed by the plugin.
   *
   * @returns {StructureRef[]} An array of structures currently in the plugin's hierarchy.
   *
   * @throws {Error} If the plugin is not initialized or if the structure hierarchy is unavailable.
   */
  private structures(): StructureRef[] {
    if (!this.plugin || !this.plugin.managers.structure.hierarchy.current) {
      throw new Error(
        "Plugin is not properly initialized. Cannot retrieve structures."
      );
    }

    return this.plugin.managers.structure.hierarchy.current.structures;
  }

  //Get all root SourceRef in the current hierarchy in a listed manner
  // private getStructureRoots() {
  //   const rootKeys = [];
  //   for (let key of this.plugin.state.data.cells.keys()) {
  //     if (this.plugin.state.data.cells.get(key)["sourceRef"] === "-=root=-") {
  //       rootKeys.push(key);
  //     }
  //   }
  //   return rootKeys;
  // }

  /**
   * Recursively finds the root source reference from a given structure source reference.
   *
   * This method traverses the state tree to find the root source reference,
   * starting from a given child structure reference. It continues recursively
   * until it finds the root source, which is indicated by `"-=root=-"`.
   *
   * @param {string} structureSourceRef The source reference of the child structure.
   *
   * @returns {string} The root source reference associated with the given structure source reference.
   *
   * @throws {Error} If the `structureSourceRef` is not found or if there's an unexpected error during traversal.
   */
  private getStructureRootIDFromStructureSourceRef(
    structureSourceRef: string
  ): string {
    if (!this.plugin || !this.plugin.state || !this.plugin.state.data) {
      throw new Error(
        "Plugin state is not initialized. Cannot find the structure root."
      );
    }

    const currentRef =
      this.plugin.state.data.cells.get(structureSourceRef)?.sourceRef;

    if (!currentRef) {
      throw new Error(
        `Unexpected error while finding the structure root. Cell '${structureSourceRef}' not found.`
      );
    }

    if (currentRef === "-=root=-") {
      // If the current reference is the root, return the original structure source reference
      return structureSourceRef;
    }

    // Otherwise, continue recursively to find the root source reference
    return this.getStructureRootIDFromStructureSourceRef(currentRef);
  }

  /**
   * Retrieves a file's contents as a hexadecimal string from a given root reference.
   *
   * This method takes a root reference, retrieves the associated file from the state,
   * and converts its contents into a hexadecimal string. It also extracts the file name
   * and its format based on the file extension.
   *
   * @param {string} rootRef The root reference to the file in the plugin's state data.
   *
   * @returns {{ fileContents: string; fileName: string; format: string }} An object containing the hexadecimal representation of the file's contents,
   *                                                                      the file name, and the file's format (extension).
   *
   * @throws {Error} If the root reference is invalid, the file cannot be found, or an unexpected error occurs during conversion.
   */
  private getFileAsHexStringFromRootRef(rootRef: string): {
    fileContents: string;
    fileName: string;
    format: string;
  } {
    const fileName =
      this.plugin!.state.data.cells.get(rootRef)!.params!.values.file.name;
    let fileContents = "";
    if (fileName.endsWith(".bcif")) {
      const uint8Arr = this.plugin!.state.data.cells.get(rootRef)?.obj?.data;
      fileContents = uint8Arr.toString(16);
    } else {
      const data = this.plugin!.state.data.cells.get(rootRef)?.obj?.data;
      fileContents = data.toString(16);
    }

    return {
      fileContents,
      fileName,
      format: fileName.split(".").pop() ?? "unknown", // Default to 'unknown' if no extension found
    };
  }

  // Will search iteratibely until finding the actual label of the structure (the one on the root)
  private getLabelFromStructureRef(refID: string) {
    return this.plugin!.state.data.cells.get(
      this.getStructureRootIDFromStructureSourceRef(refID)
    )!.obj!.label;
  }

  /**
   * Lists information about all current structures in the Mol* plugin.
   *
   * This method retrieves all the current structures from the plugin's hierarchy,
   * and creates a list of `MolInfo` objects containing information about each structure,
   * including its ID, label, and hexadecimal representation of its source file.
   *
   * @returns {MolInfo[]} An array of `MolInfo` objects representing the current structures.
   *
   * @throws {Error} If an unexpected error occurs while retrieving structures or their data.
   */
  public listStructures(): MolInfo[] {
    const structures = this.structures();

    const molList: MolInfo[] = [];

    try {
      for (const structure of structures) {
        const rootRef = this.getStructureRootIDFromStructureSourceRef(
          structure.cell.sourceRef!
        );

        const molInfo: MolInfo = {
          id: structure.cell.sourceRef!,
          label: this.getLabelFromStructureRef(rootRef),
          ...this.getFileAsHexStringFromRootRef(rootRef),
        };

        molList.push(molInfo);
      }
    } catch (error) {
      alert(
        `Failed to list structures: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    return molList;
  }

  /**
   * Extracts residue information from a given structure reference.
   *
   * This method iterates through all atoms in a structure and collects residue-related
   * information based on the specified filter criteria. The `get` parameter allows you to
   * choose which type of residues to retrieve, and the `unique` parameter determines
   * whether to include only unique residues.
   *
   * @param {StructureRef} structureRef The reference to the structure from which residues will be extracted.
   * @param {"all" | "hetero" | "standard" | "chain"} [get="all"] Determines which residues to retrieve:
   *                                                             - "all": retrieves all residues except waters.
   *                                                             - "hetero": retrieves only hetero atoms.
   *                                                             - "standard": retrieves only standard residues.
   *                                                             - "chain": retrieves one residue per chain.
   * @param {boolean} [unique=true] If true, only unique residues will be included in the result.
   *
   * @returns {AtomInfo[]} An array of `AtomInfo` objects representing the extracted residues.
   *
   * @throws {Error} If there's an error accessing the structure or extracting residue information.
   */
  private getResiduesFromStructure(
    structureRef: StructureRef,
    get?: "all" | "hetero" | "standard" | "chain",
    unique: boolean = true
  ): AtomInfo[] {
    const resInfo: AtomInfo[] = [];
    Structure.eachAtomicHierarchyElement(structureRef.cell.obj!.data, {
      atom: (loc) => {
        // auth_comp_id is the 3 letter code for the residue like "ALA", "GLY", etc.
        const auth_comp_id = StructureProperties.atom.auth_comp_id(loc);

        // Skip waters
        if (auth_comp_id === "HOH") return;

        if (get === "hetero" && standardResidues.includes(auth_comp_id)) return;
        else if (get === "standard" && !standardResidues.includes(auth_comp_id))
          return;

        const res = this.extractAtomInfo(loc, structureRef.cell.sourceRef);

        // If the molInfo.ID and the current auth_comp_id are already in the
        // heteroInfo array, then don't add it again
        if (unique) {
          for (const info of resInfo) {
            if (
              info.structureID === res.structureID &&
              info.auth_comp_id === auth_comp_id &&
              info.residue === res.residue
            ) {
              return;
            }
          }
        }

        // For standard residues, we need to add the residue one time per atom
        if (get == "standard") {
          for (const info of resInfo) {
            if (info.residue === res.residue) {
              return;
            }
          }
        }

        if (get == "chain") {
          for (const info of resInfo) {
            if (info.chainID === res.chainID) {
              return;
            }
          }
        }
        resInfo.push(res);
      },
    });

    return resInfo;
  }

  /**
   * Lists the hetero residues in the currently loaded structures.
   *
   * This method retrieves all hetero residues from the loaded structures. If a `label` is provided,
   * it returns hetero residues from the specified structure; otherwise, it lists hetero residues
   * from all current structures.
   *
   * @param {string} [label] The label of the structure to list hetero residues from (optional).
   *
   * @returns {Array} An array of hetero residues from the specified or all structures.
   */

  public listHeteroRes(label?: string): AtomInfo[] {
    // Determine which structures to list based on the provided label
    const structuresToList = label
      ? (() => {
          const structure = this.getStructureObjectFromLabel(label);
          return structure ? [structure] : []; // Return an empty array if no valid structure
        })()
      : this.structures();

    if (label && structuresToList.length === 0) {
      throw new Error(`No structure with label '${label}'`);
    }

    // Map each structure to its list of hetero residues
    return structuresToList.flatMap((s) =>
      this.getResiduesFromStructure(s, "hetero")
    );
  }

  /**
   * Lists the standard residues in the currently loaded structures.
   *
   * This method retrieves all standard residues from the loaded structures. If a `label` is provided,
   * it returns standard residues from the specified structure; otherwise, it lists standard residues
   * from all current structures.
   *
   * @param {string} [label] The label of the structure to list standard residues from (optional).
   *
   * @returns {Array} An array of standard residues from the specified or all structures.
   */

  public listStandardRes(label?: string): AtomInfo[] {
    // Determine which structures to list based on the provided label
    const structuresToList = label
      ? (() => {
          const structure = this.getStructureObjectFromLabel(label);
          return structure ? [structure] : []; // Return an empty array if no valid structure
        })()
      : this.structures();

    if (label && structuresToList.length === 0) {
      throw new Error(`No structure with label '${label}'`);
    }

    // Map each structure to its list of hetero residues
    return structuresToList.flatMap((s) =>
      this.getResiduesFromStructure(s, "standard", false)
    );
  }

  /**
   * Lists the chains in the currently loaded structures.
   *
   * This method retrieves all chains from the loaded structures. If a `label` is provided,
   * it returns chains from the specified structure; otherwise, it lists chains
   * from all current structures.
   *
   * @param {string} [label] The label of the structure to list chains from (optional).
   *
   * @returns {Array} An array of chains from the specified or all structures.
   */

  public listChains(label?: string): AtomInfo[] {
    // Determine which structures to list based on the provided label
    const structuresToList = label
      ? (() => {
          const structure = this.getStructureObjectFromLabel(label);
          return structure ? [structure] : []; // Return an empty array if no valid structure
        })()
      : this.structures();

    if (label && structuresToList.length === 0) {
      throw new Error(`No structure with label '${label}'`);
    }

    // Map each structure to its list of hetero residues
    return structuresToList.flatMap((s) =>
      this.getResiduesFromStructure(s, "chain")
    );
  }

  /**
   * Creates an empty structure node with a specified name.
   *
   * This method creates a structure node containing only a minimal set of data,
   * simulating an empty structure. It uses a simple PDB data string to construct
   * the structure and assigns it a label based on `nodeName`.
   *
   * @param {string} nodeName The name to assign to the created node.
   *
   * @returns {Promise<Structure>} A promise that resolves with the created empty structure node.
   *
   * @throws {Error} If an error occurs during the node creation process.
   */
  private async createEmptyNode(nodeName: string) {
    // Use fake data to create a node
    const data = await this.plugin!.builders.data.rawData({
      data: "HETATM 1  H   H   A   1       0.000   0.000   0.000  1.00  0.00           H",
      label: nodeName,
    });
    const trajectory = await this.plugin!.builders.structure.parseTrajectory(
      data,
      "pdb"
    );
    const model = await this.plugin!.builders.structure.createModel(trajectory);
    return await this.plugin!.builders.structure.createStructure(model);
  }

  /**
   * Adds a sphere to the current structure at a specified position and with a given radius.
   *
   * This method adds a 3D sphere to the Mol* structure at the specified `position`, with the given `radius`.
   * It can also delete a previous sphere if a `deletePrevious` reference is provided. The `opacity` and `color`
   * of the sphere can be customized.
   *
   * @param {object} position The position where the sphere should be added.
   * @param {number} position.x The x-coordinate of the sphere's position.
   * @param {number} position.y The y-coordinate of the sphere's position.
   * @param {number} position.z The z-coordinate of the sphere's position.
   * @param {number} radius The radius of the sphere.
   * @param {number} [opacity=0.3] The opacity of the sphere (optional, defaults to 0.3).
   * @param {Color} [color] The color of the sphere (optional).
   * @param {SphereRef} [deletePrevious] A reference to a sphere to delete before adding the new one (optional).
   *
   * @returns {Promise<SphereRef>} A promise that resolves with a `SphereRef` for the newly added sphere.
   *
   * @throws {Error} If there is an issue adding the sphere to the structure or if the structure is invalid.
   */
  public async addSphere(
    position: {
      x: number;
      y: number;
      z: number;
    },
    radius: number,
    opacity?: number,
    color?: Color,
    deletePrevious?: SphereRef
  ): Promise<SphereRef> {
    deletePrevious && this.removeShape(deletePrevious.ref);

    // Get the first structure or null if no structures exist
    const structureFirst = this.structures()[0];

    // Determine the structure to use based on the existence of structureFirst
    const structureRef = structureFirst?.cell.transform.ref;
    const structure = structureRef
      ? this.plugin!.state.data.cells.get(structureRef)
      : await this.createEmptyNode("Sphere");

    if (!structure) {
      throw new Error(
        "Failed to add sphere to mosltar. Could not get a valid structure to place it."
      );
    }

    const sphere: SphereRef = {
      x: position.x,
      y: position.y,
      z: position.z,
      radius: radius,
      color: deletePrevious?.color ?? color ?? randomColor(),
      alpha: opacity ?? 0.3,
      ref: "",
    };

    // @ts-ignore
    sphere.ref = await addSphereTo(this.plugin!, structure, sphere);

    return sphere;
  }

  /**
   * Adds a 3D box to the current structure with specified vertices, radius scale, and radial segments.
   *
   * This method creates and adds a box to the Mol* structure. It allows for the specification
   * of a set of positions (defining box vertices), a radius scale, and radial segments. Additionally,
   * it can remove a previous box if a `deletePrevious` reference is provided. Opacity and color
   * can be customized.
   *
   * @param {object} position The position of the box vertices.
   * @param {number} position.x0 - x-coordinate of the first vertex.
   * @param {number} position.y0 - y-coordinate of the first vertex.
   * @param {number} position.z0 - z-coordinate of the first vertex.
   * @param {number} position.x1 - x-coordinate of the second vertex.
   * @param {number} position.y1 - y-coordinate of the second vertex.
   * @param {number} position.z1 - z-coordinate of the second vertex.
   * @param {number} position.x2 - x-coordinate of the third vertex.
   * @param {number} position.y2 - y-coordinate of the third vertex.
   * @param {number} position.z2 - z-coordinate of the third vertex.
   * @param {number} position.x3 - x-coordinate of the fourth vertex.
   * @param {number} position.y3 - y-coordinate of the fourth vertex.
   * @param {number} position.z3 - z-coordinate of the fourth vertex.
   * @param {number} radiusScale The scale of the box's radius.
   * @param {number} radialSegments The number of radial segments for the box.
   * @param {number} [opacity=0.3] The opacity of the box (optional, defaults to 0.3).
   * @param {Color} [color] The color of the box (optional).
   * @param {BoxRef} [deletePrevious] A reference to a box to delete before adding the new one (optional).
   *
   * @returns {Promise<BoxRef>} A promise that resolves with a `BoxRef` for the newly added box.
   *
   * @throws {Error} If there's an issue creating or adding the box, or if the structure is invalid.
   */

  public async addBox(
    position: {
      x0: number;
      y0: number;
      z0: number;
      x1: number;
      y1: number;
      z1: number;
      x2: number;
      y2: number;
      z2: number;
      x3: number;
      y3: number;
      z3: number;
    },
    radiusScale: number,
    radialSegments: number,
    opacity?: number,
    color?: Color,
    deletePrevious?: BoxRef
  ): Promise<BoxRef> {
    deletePrevious && this.removeShape(deletePrevious.ref);

    // Get the first structure or null if no structures exist
    const structureFirst = this.structures()[0];

    // Determine the structure to use based on the existence of structureFirst
    const structureRef = structureFirst?.cell.transform.ref;
    const structure = structureRef
      ? this.plugin!.state.data.cells.get(structureRef)
      : await this.createEmptyNode("Box");

    if (!structure) {
      throw new Error(
        "Failed to add sphere to mosltar. Could not get a valid structure to place it."
      );
    }

    const box: BoxRef = {
      x0: position.x0,
      y0: position.y0,
      z0: position.z0,
      x1: position.x1 / 2,
      y1: position.y1,
      z1: position.z1,
      x2: position.x2,
      y2: position.y2 / 2,
      z2: position.z2,
      x3: position.x3,
      y3: position.y3,
      z3: position.z3 / 2,
      radiusScale: radiusScale,
      radialSegments: radialSegments,
      color: deletePrevious?.color ?? color ?? randomColor(),
      alpha: opacity ?? 0.3,
      ref: "",
    };

    // @ts-ignore
    box.ref = await addBoxTo(this.plugin!, structure, box);

    return box;
  }

  /**
   * Removes a shape from the Mol* structure by its reference.
   *
   * This method deletes a shape from the plugin's state data based on the given reference.
   * It builds a state update to remove the specified shape and then commits the change.
   *
   * @param {string} ref The reference ID of the shape to be removed.
   *
   * @returns {Promise<void>} A promise that resolves once the shape is removed.
   *
   * @throws {Error} If there's an issue removing the shape or committing the change.
   */
  public async removeShape(ref: string) {
    const builder = this.plugin!.state.data.build();
    builder.delete(ref);
    builder.commit();
  }

  /**
   * An internal array to store references to programatically added representations.
   *
   * This variable is used to keep track of representations added to the Mol* structure
   * during the course of various operations. It can be used to manage, update, or delete
   * specific representations as needed.
   *
   * @type {Array<StateObjectSelector>} An array of references to added representations.
   */
  private addedReprs: Array<StateObjectSelector> = [];

  /**
   * Adds a specified representation to existing structures, or all structures if `structure` is null.
   *
   * This method applies a given representation ("cartoon" or "ball-and-stick") to one or more structures.
   * If a `structure` is provided, the representation is applied to it; otherwise, it is applied to all
   * existing structures. The method also handles hidden structures and restores the camera position after
   * updating the representations.
   *
   * @param {StructureRef | "all"} structure The structure to add the representation to, or `null` to add to all structures.
   * @param {"cartoon" | "ball-and-stick"} representation The type of representation to apply.
   *
   * @returns {Promise<void>} A promise that resolves once the representations are added and committed.
   */

  public async addStructureRepresentation(
    structure: StructureRef | "all",
    representation: "cartoon" | "ball-and-stick"
  ) {
    const structures = structure === "all" ? this.structures() : [structure];

    // Get the builder
    const builder = this.plugin!.builders.structure.representation;
    const update = this.plugin!.build();

    const reprTag = `internal-representation`;

    const snapshot = await this.plugin!.canvas3d?.camera.getSnapshot();

    // Loop over the structures
    for (const structure of structures) {
      // Skip hidden structures
      if (structure.cell.state.isHidden) continue;

      // Update the representation
      const newRepr = builder.buildRepresentation(
        update,
        structure.cell,
        {
          type: representation,
        },
        {
          tag: reprTag,
        }
      );
      this.addedReprs.push(newRepr);
    }
    // await build.commit();
    await update.commit();

    // Restore the camera
    this.plugin!.canvas3d?.requestCameraReset({ snapshot, durationMs: 0 });
  }

  /**
   * Removes all previously added internal representations from structures.
   *
   * This method removes representations that were previously added to structures.
   * It iterates over the `addedReprs` list, deleting each representation, and then commits
   * the changes to the plugin's state. This can be used to clear or reset representations in Mol*.
   *
   * @returns {Promise<void>} A promise that resolves once the representations are deleted and committed.
   */
  public async deleteStructureRepresentations() {
    const builder = await this.plugin!.state.data.build();

    // Loop over the added reps
    for (const repr of this.addedReprs) {
      // Delete the representation if the structure has "-internal-representation"
      builder.delete(repr);
    }
    await builder.commit();
  }

  /**
   * A queue to store pending actions.
   *
   * This queue is used to manage actions to be applied in sequence. It holds pending actions
   * until they can be processed, ensuring they are executed in the correct order.
   *
   * @type {Array<{ id: string, type: string, data: any }>}
   */
  actionsQueue: Array<{ id: string; type: string; data: any }> = [];

  /**
   * Applies a specified action in the correct order, ensuring that pending actions are processed sequentially.
   *
   * This method accepts an action with a type and associated data, assigns it a unique ID,
   * and pushes it to the `actionsQueue`. It waits until the action is at the front of the queue
   * before processing it. The method then handles various action types and applies the appropriate
   * logic. If an error occurs, it alerts the user, and once the action is processed, it is removed
   * from the queue.
   *
   * @param {object} action The action to be applied.
   * @param {string} action.type The type of the action.
   * @param {any} action.data The data associated with the action.
   *
   * @returns {Promise<void>} A promise that resolves when the action is applied and processed.
   *
   * @throws {Error} If there is an issue with the action or its application.
   */
  public async applyAction(action: any) {
    const { type, data } = action;

    // Assing an ID to the action
    action.id = Math.random().toString(36);

    this.actionsQueue.push(action);

    // Wait till the action is the first in the queue
    while (this.actionsQueue[0]?.id !== action.id) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    try {
      switch (type) {
        case "addPDB":
          // Add PDB will be soon deprecated, use addMolecule Instead
          const label = data.label ? data.label : "PDB";
          const pdb = data.pdb;

          // If the PDB data is empty, throw an error
          if (!pdb || pdb === "") {
            throw new Error("The PDB data is empty");
          }

          await this.loadPDBString(pdb, label);
          break;

        case "addMolecule":
          await this.loadMoleculeFile(
            new File([hexToBlob(data.molContent)], data.fileName),
            {
              label: data.label,
            }
          );
          break;
        case "loadMVJS":
          await this.loadMolViewSpecSession(data.session, data.replaceExisting);
          break;
        case "focus":
          await this.focus(
            data.structureLabel,
            data.residue,
            data.chain,
            data.nearRadius
          );
          break;
        case "addBox":
          await this.addBox(
            data.position,
            data.radiousScale,
            data.radialSegments,
            data.opacity ?? 1,
            data.color ? Color.fromHexStyle(data.color) : randomColor()
          );
          break;
        case "addSphere":
          await this.addSphere(
            data.position,
            data.radius,
            data.opacity,
            data.color ? Color.fromHexStyle(data.color) : randomColor()
          );
          break;
        case "setBackgroundColor":
          await this.setBackground(data.color);
          break;
        case "setSpin":
          await this.setSpin(data.speed);
          break;
        case "reset":
          await this.reset();
          break;
        default:
          throw new Error(`Unknown action type: ${type}`);
      }
    } catch (error) {
      alert(
        "There was an error applying the following Mol* action: " +
          type +
          "\n\n" +
          error
      );
    } finally {
      // Once the action has been applied, remove it from the pending actions
      this.actionsQueue.shift();
    }
  }

  /**
   * Loads a Mol* session from a serialized MolViewSpec (MVS) session string.
   *
   * This method takes a serialized MolViewSpec session string and loads it into
   * the Mol* plugin. If `replaceExisting` is `true`, the existing session is replaced
   * with the new one; otherwise, it is merged or added to the current session.
   *
   * @param {string} session The serialized MolViewSpec session string.
   * @param {boolean} [replaceExisting=false] Whether to replace the existing session with the new one (optional, defaults to `false`).
   *
   * @returns {Promise<void>} A promise that resolves once the session is loaded.
   *
   */
  private async loadMolViewSpecSession(
    session: string,
    replaceExisting: boolean = false
  ) {
    const parsedData = MVSData.fromMVSJ(session);

    // Loads the session
    await loadMVS(this.plugin!, parsedData, {
      replaceExisting: replaceExisting,
    });
  }
}

/*
 * Standard residues
 */
const standardResidues = [
  "ALA",
  "ARG",
  "ASN",
  "ASP",
  "CYS",
  "GLN",
  "GLU",
  "GLY",
  "HIS",
  "ILE",
  "LEU",
  "LYS",
  "MET",
  "PHE",
  "PRO",
  "SER",
  "THR",
  "TRP",
  "TYR",
  "VAL",
  "GLH",
  "ASH",
  "CYX",
  "HID",
  "HIE",
];

// Gets a random color from ColorNames enum
function randomColor(): Color {
  const colors = Object.values(ColorNames);
  const randomIndex = Math.floor(Math.random() * colors.length);
  return colors[randomIndex]!;
}

export type BoxRef = {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
  x2: number;
  y2: number;
  z2: number;
  x3: number;
  y3: number;
  z3: number;
  radiusScale: number;
  radialSegments: number;
  color: Color;
  alpha: number;
  ref: string;
};

export type SphereRef = {
  x: number;
  y: number;
  z: number;
  radius: number;
  color: Color;
  alpha: number;
  ref: string;
};

/**
 * Converts a hexadecimal string into a Blob.
 *
 * This function takes a hexadecimal string, converts it into an array of bytes,
 * and then creates a Blob from those bytes. It is useful for converting hexadecimal
 * data into binary data that can be used in various applications, such as file storage
 * or network transmission.
 *
 * @param {string} hexString The hexadecimal string to convert.
 *
 * @returns {Blob} A Blob containing the binary representation of the hexadecimal string.
 *
 * @throws {Error} If the hexadecimal string contains invalid characters or is not a valid hex format.
 */
function hexToBlob(hexString: string) {
  const bytePairs = hexString.match(/.{1,2}/g) || [];
  const byteArray = bytePairs.map((byte) => parseInt(byte, 16));

  return new Blob([new Uint8Array(byteArray)]);
}

function parsePDB(pdbString: string) {
  const wantedLines = [
    "ATOM",
    "HETATM",
    "ANISOU",
    "TER",
    "ENDMDL",
    "CONNECT",
    "MASTER",
    "END",
  ];
  const lines = pdbString.split("\n");

  // Loop over the lines and only keep the lines that start with the 'wantedLines' strings
  const filteredLines = lines.filter((line) => {
    for (const wantedLine of wantedLines) {
      if (line.startsWith(wantedLine)) return true;
    }
    return false;
  });

  // Join the lines back into a string
  const filteredPDB = filteredLines.join("\n");

  return filteredPDB;
}
