// Mol* imports
import { AnimateModelIndex } from "molstar/lib/mol-plugin-state/animation/built-in/model-index";
import { createStructureRepresentationParams } from "molstar/lib/mol-plugin-state/helpers/structure-representation-params";
import { PluginStateObject } from "molstar/lib/mol-plugin-state/objects";
import { StateTransforms } from "molstar/lib/mol-plugin-state/transforms";
import { createPluginUI } from "molstar/lib/mol-plugin-ui/";
import { renderReact18 } from "molstar/lib/mol-plugin-ui/react18";
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
  Frame,
  Structure,
  StructureElement,
  StructureProperties,
  Time,
  Unit
} from "molstar/lib/mol-model/structure";
import { Loci as LociType } from "molstar/lib/mol-model/structure/structure/element/loci";
import { Loci } from "molstar/lib/mol-model/loci";
import { addSphereTo } from "./sphere";
import { DockingSphereRepresentationProvider } from "./sphere";
import { addBoxTo } from "./box";
import { DockingBoxRepresentationProvider } from "./box";
import { ObjectKeys } from "molstar/lib/mol-util/type-helpers";
import { PluginSpec } from "molstar/lib/mol-plugin/spec";
import {
  StructureComponentRef,
  StructureRef
} from "molstar/lib/mol-plugin-state/manager/structure/hierarchy-state";
import { Mat4, Vec3 } from "molstar/lib/mol-math/linear-algebra";
import { Expression } from "molstar/lib/mol-script/language/expression";

import { Mp4Export } from "molstar/lib/extensions/mp4-export";
import {
  StateObjectCell,
  StateObjectRef,
  StateObjectSelector,
  StateSelection
} from "molstar/lib/mol-state";
import { BuiltInTrajectoryFormats } from "molstar/lib/mol-plugin-state/formats/trajectory";
import { HorusMolstarViewportComponent } from "./ui/viewport";
import { HorusLeftPanelControls } from "./ui/HorusLeftPanelControls";

// Optimization types
export interface OptimizationProgress {
  step: number;
  totalSteps: number;
  message: string;
  intermediatePdb?: string;
  newCoords?: { frame: number; coords: number[][] };
  completed?: boolean;
}

export interface OptimizationResult {
  optimizedStructure: string;
  trajectory: number[][][];
}

type OptimizationConstraints = {
  mode: "freeze" | "flexible";
  atoms: {
    chain: string;
    residue?: number;
    atom?: number;
  }[];
};
export interface OptimizationOptions {
  constraints?: OptimizationConstraints;
  steps?: number;
  chunk?: number;
  forceField?: "uff" | "mmff94" | "ghemical";
  steepestDescent?: boolean;
  conjugateGradients?: boolean;
  steepestDescentThreshold?: number;
  conjugateGradientsThreshold?: number;
  onProgress?: (progress: OptimizationProgress) => void;
}
import {
  ModelFromTrajectory,
  TrajectoryFromModelAndCoordinates
} from "molstar/lib/mol-plugin-state/transforms/model";
import { getFileNameInfo } from "molstar/lib/mol-util/file-info";
import { Task } from "molstar/lib/mol-task";
import { ColorTheme } from "molstar/lib/mol-theme/color";
import { SizeTheme } from "molstar/lib/mol-theme/size";
import {
  presetStaticComponent,
  PresetStructureRepresentations
} from "molstar/lib/mol-plugin-state/builder/structure/representation-preset";
import { StructureRepresentationRegistry } from "molstar/lib/mol-repr/structure/registry";
import { ParamDefinition } from "molstar/lib/mol-util/param-definition";
import {
  StructureSelectionQueries,
  StructureSelectionQuery
} from "molstar/lib/mol-plugin-state/helpers/structure-selection-query";
import { StaticStructureComponentType } from "molstar/lib/mol-plugin-state/helpers/structure-component";
import { ColorName, HexColor } from "molstar/lib/extensions/mvs/helpers/utils";
import { OrderedSet, Segmentation } from "molstar/lib/mol-data/int";
import { UnitIndex } from "molstar/lib/mol-model/structure/structure/element/util";
import { InteractivityManager } from "molstar/lib/mol-plugin-state/manager/interactivity";
import { superpose } from "molstar/lib/mol-model/structure/structure/util/superposition";
import { StructureSelectionHistoryEntry } from "molstar/lib/mol-plugin-state/manager/structure/selection";
import { SymmetryOperator } from "molstar/lib/mol-math/geometry";

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
  structure: MolInfo;
};

export type BondInfo = {
  aUnit: Unit;
  bUnit: Unit;
  aIndex: StructureElement.UnitIndex;
  bIndex: StructureElement.UnitIndex;
  type: string;
  order: string;
  key: string;
  //Modified from original
  strucrureRef: string;
};

export type MolInfoKind = "structure" | "sphere" | "box";

export type MolInfo = {
  id: string;
  label: string;
  fileContents: string | null;
  fileName: string;
  format: string;
  rootRef: string;
  kind: MolInfoKind;
};

export interface MolInfoWithRef extends MolInfo {
  structureRef: StructureRef;
}

export type MolstarClickEventDetail = {
  x: number;
  y: number;
  z: number;
  atom: AtomInfo | null;
  rawEvent: InteractivityManager.ClickEvent;
};

export type MolstarStateEventDetail = {
  updating: boolean;
};

export interface StructureInfoWithLoci {
  chains: Array<{
    id: string;
    loci: StructureElement.Loci;
    residues: Array<{
      id: string;
      loci: StructureElement.Loci;
    }>;
    hetero: Array<{
      id: string;
      loci: StructureElement.Loci;
    }>;
  }>;
}

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
  SelectionGroup = "selection-group"
}

// Mol* events
export enum MolstarEvents {
  COORDINATES = "molstar-coordinates",
  STATE = "molstar-state-event"
}
export type MolstarInitOptions = {
  showControls?: boolean;
};

export type RepresentationThemeOptions = _RepresentationThemeOptions<
  ColorTheme.BuiltIn,
  SizeTheme.BuiltIn
>;

type _RepresentationThemeOptions<
  C extends ColorTheme.BuiltIn,
  S extends SizeTheme.BuiltIn
> = {
  representation: StructureRepresentationRegistry.BuiltIn;
  representationParams: Record<string, any>;
  color?: C;
  size?: S;
  colorParams?: ColorTheme.BuiltInParams<C> & { value: string };
  sizeParams?: SizeTheme.BuiltInParams<S>;
};

// Type for the hook loadMoleculeFile
export type LoadMoleculeFileType = (
  file: File,
  options?: {
    label?: string;
    theme?: RepresentationThemeOptions;
  }
) => Promise<StructureRef | null>;

export type SelectionLanguage = "mol-script" | "vmd" | "pymol" | "jmol";

export type ResidueRange = {
  start: number;
  end: number;
};

export type ChainAndResidue = {
  chain: string;
  residue: number;
};

export type AuthChainAndResidue = {
  auth_chain: string;
  auth_residue: number;
};

export type WithinDistance = {
  radius: number;
  target: MolecularSelection; // recursive type
};

export type MolecularSelection = {
  // Script-based selections
  script?: string;
  language?: SelectionLanguage;
  loci?: LociType;

  // Chain selections
  chain?: string;
  auth_chain?: string;

  // Entity selection
  entity?: string;

  // Residue selections
  residue?: number;
  auth_residue?: number;
  residue_range?: ResidueRange;
  auth_residue_range?: ResidueRange;

  // Atom selections
  atom_name?: string;
  auth_atom_name?: string;
  element_symbol?: string;
  atom_id?: number;
  atom_index?: number;

  // Insertion code
  insertion_code?: string;

  // Combined selections
  chain_and_residue?: ChainAndResidue;
  auth_chain_and_residue?: AuthChainAndResidue;

  // Structural selections
  secondary_structure?: "helix" | "sheet" | "coil";
  type?: StaticStructureComponentType;

  // Proximity selections
  within_distance?: WithinDistance;
};

export type AlignmentOptions = {
  chain: string;
  residue?: number;
};

interface LociEntry {
  loci: StructureElement.Loci;
  label: string;
  cell: StateObjectCell<PluginStateObject.Molecule.Structure>;
}

interface AtomsLociEntry extends LociEntry {
  atoms: StructureSelectionHistoryEntry[];
}

export function isMolstarLoaded(
  molstar: typeof window.molstar
): molstar is HorusMolstar {
  return Boolean((molstar as HorusMolstar | undefined)?.plugin);
}

export default class HorusMolstar {
  plugin: PluginUIContext | null = null;
  target: HTMLDivElement;
  private openBabelWorker: Worker;
  private optimizationPromises: Map<
    string,
    {
      resolve: (value: OptimizationResult) => void;
      reject: (reason: any) => void;
      onProgress?: (progress: OptimizationProgress) => void;
    }
  > = new Map();

  constructor(target: HTMLDivElement, options?: MolstarInitOptions) {
    this.target = target;
    this.initPlugin(options);

    this.openBabelWorker = new Worker(
      // @ts-ignore
      new URL("../../OpenBabel/openBabel.worker.js", import.meta.url)
    );
  }

  private async initPlugin(options?: MolstarInitOptions) {
    const ExtensionMap = {
      // @ts-ignore
      "mp4-export": PluginSpec.Behavior(Mp4Export)
    };

    this.plugin = await createPluginUI({
      target: this.target,
      render: renderReact18,
      spec: {
        ...DefaultPluginUISpec(),
        behaviors: [
          ...DefaultPluginUISpec().behaviors,
          ...ObjectKeys(ExtensionMap).map((k) => ExtensionMap[k])
        ],
        animations: [AnimateModelIndex],
        config: [
          [PluginConfig.Viewport.ShowExpand, false],
          [PluginConfig.Viewport.ShowControls, true],
          [PluginConfig.Viewport.ShowSelectionMode, true],
          [PluginConfig.Viewport.ShowSettings, true]
        ],
        layout: {
          initial: {
            isExpanded: true,
            showControls: options?.showControls ?? false
          }
        },
        components: {
          controls: {
            right: "none",
            bottom: "none",
            left: HorusLeftPanelControls
          },
          remoteState: "none",
          viewport: {
            view: HorusMolstarViewportComponent
          }
        }
      }
    });

    const renderer = this.plugin?.canvas3d?.props?.renderer;

    if (!renderer) {
      throw new Error("Failed to initialize Mol*. Is WebGL available?");
    }

    PluginCommands.Canvas3D.SetSettings(this.plugin, {
      settings: {
        renderer: {
          ...renderer,
          backgroundColor: ColorNames.white
        }
      }
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

    // Configure structures to always be model
    // Override the structure creation to always use model
    const originalCreateStructure =
      this.plugin.builders.structure.createStructure;
    this.plugin.builders.structure.createStructure = function (
      modelRef,
      params,
      initialState,
      tags
    ) {
      // Force model creation regardless of input params
      const modelParams = { name: "model", params };
      return originalCreateStructure.call(
        this,
        modelRef,
        modelParams as any,
        initialState,
        tags
      );
    };

    // await this.loadMoleculeFile(
    //   await window.horus
    //     .getFile("/Users/cdominguez/Downloads/test_allpdb_3_copy.pdb")
    //     .then((blob) => new File([blob], "test_allpdb_3_copy.pdb"))
    // );
  }

  private molstarEvents() {
    this.plugin!.behaviors.interaction.click.subscribe((e) => {
      // Get the position of the click
      if (e.position) {
        const x: number = Number(e.position[0]?.toFixed(1) ?? 0);
        const y: number = Number(e.position[1]?.toFixed(1) ?? 0);
        const z: number = Number(e.position[2]?.toFixed(1) ?? 0);

        // If the item we clicked can be interacted, extract its information
        // To do se, first we need to normalize the loci. This fixes an issue
        // where clicking a bond, instead of an atom, did not return any atom information
        const normalizedLoci = Loci.normalize(e.current.loci);

        const detail: MolstarClickEventDetail = {
          x,
          y,
          z,
          atom: StructureElement.Loci.is(normalizedLoci)
            ? this.extractAtomInfoFromLoci(normalizedLoci)
            : null,
          rawEvent: e
        };

        // Send the values through a custom event "molstar-coordinates"
        const event = new CustomEvent(MolstarEvents.COORDINATES, {
          detail: detail
        });

        window.dispatchEvent(event);
      }
    });

    this.plugin!.behaviors.state.isUpdating.subscribe((e) => {
      // Only send the event if the state finished updating
      if (e) {
        return;
      }

      // Send the values through a custom event "molstar-state-event"
      const detail: MolstarStateEventDetail = {
        updating: e
      };

      const event = new CustomEvent(MolstarEvents.STATE, {
        detail: detail
      });

      window.dispatchEvent(event);
      // if (this.plugin) {
      //   assemblyObliberator(this.plugin).then(() => {
      //   })
      // }
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
  public async unload() {
    if (this.plugin) {
      // Remove the plugin
      this.plugin.dispose();
      this.plugin.unmount();
    }

    // Launch a STATE event
    const event = new CustomEvent(MolstarEvents.STATE, {
      detail: {}
    });
    window.dispatchEvent(event);
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
            backgroundColor: Color.fromHexStyle(hexColor)
          }
        }
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
            animate: newAnimation
          }
        }
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
    }
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
          camera: true
        }
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
  private async loadSession(session: Blob): Promise<void> {
    const ALLOWED_MB = 1500;

    const MAX_SESSION_SIZE = ALLOWED_MB * 1024 * 1024;

    if (session.size > MAX_SESSION_SIZE) {
      throw new Error(
        `Session size exceeds the maximum size of ${ALLOWED_MB} MB.`
      );
    }

    const file = new File([session], "session.molx", {
      type: "application/zip"
    });

    // Load the session
    await PluginCommands.State.Snapshots.OpenFile(this.plugin!, { file });
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
    set: async (snapshot: Blob): Promise<void> => {
      await this.loadSession(snapshot);
    }
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
  public getStructureIDFromStructureRef(
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
  public getStructureObjectFromLabel(
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
    }

    // Validate the existence of the specified structure
    const structureRef = this.getStructureObjectFromLabel(structureLabel);
    if (!structureRef) {
      message = `No structure with label '${structureLabel}' found.`;
      const structureList = structures.map((s) => s.label);
      message += ` Available structures: ${structureList.join(", ")}`;
      return message;
    }

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
        center: Vec3.zero()
      };
      const radius = Math.max(boundary.radius, 5);

      const snapshot = this.plugin!.canvas3d!.camera.getFocus(
        boundary.center,
        radius
      );
      await PluginCommands.Camera.SetSnapshot(this.plugin!, {
        snapshot,
        durationMs: 250
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
    const filterGroups: Record<string, Expression> = {
      "residue-test": MS.core.rel.eq([
        MS.struct.atomProperty.macromolecular.auth_seq_id(),
        residueID
      ]),
      "group-by": MS.core.str.concat([
        MS.struct.atomProperty.core.operatorName(),
        MS.struct.atomProperty.macromolecular.residueKey()
      ])
    };

    // If a chain is specified, add the chain filter to the filter group
    if (chain) {
      filterGroups["chain-test"] = MS.core.rel.eq([
        MS.struct.atomProperty.macromolecular.auth_asym_id(),
        chain || "A"
      ]);
    }

    // We call the filter function to filter the structure and obtain the first residue that matches the filter
    const filteredResidue = MS.struct.filter.first([
      MS.struct.generator.atomGroups(filterGroups)
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
        type: "ball-and-stick"
      })
    );

    // If the user specified a radius for the surroundings, we will create a new selection
    if (surroundRadius > 0) {
      // We will apply a modifier to the selection, to include the surroundings of the residue
      const surroundings = MS.struct.modifier.includeSurroundings({
        0: filteredResidue,
        radius: surroundRadius,
        "as-whole-residues": true
      });

      // Then, to the existing group, we will add a new selection which represents the surroundings
      group
        .apply(StateTransforms.Model.StructureSelectionFromExpression, {
          label: "Surroundings",
          expression: surroundings
        })
        .apply(
          StateTransforms.Representation.StructureRepresentation3D,
          createStructureRepresentationParams(this.plugin!, model.data, {
            type: "ball-and-stick"
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
        tree: update
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
        tree: newUpdate
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
      durationMs: 250
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
   * @returns {Promise<StructureRef | null>} A promise that resolves once the molecule file is loaded and presets are applied.
   *
   * @throws {Error} If an error occurs during file parsing or preset application, or if the plugin is not initialized.
   */

  public loadMoleculeFile: LoadMoleculeFileType = async (
    file,
    options
  ): Promise<StructureRef | null> => {
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
          label: options?.label ?? void 0
        });

        // Parse the trajectory data and apply default presets for visualization
        const trajectory =
          // @ts-ignore -> Ignore the extension
          await this.plugin!.builders.structure.parseTrajectory(data.data, ext);

        // Create the model
        const model =
          await this.plugin.builders.structure.createModel(trajectory);

        // Force model representation instead of assembly
        const structure = await this.plugin.builders.structure.createStructure(
          model,
          { name: "model", params: {} }
        );

        // Get the structure components from the hierarchy
        const structureRef =
          this.plugin.managers.structure.hierarchy.current.structures.find(
            (s) => s.cell.transform.ref === structure.ref
          );

        const component = await presetStaticComponent(
          this.plugin,
          structure,
          "all"
        );
        if (!structureRef || !component) {
          return null;
        }
        const update = this.plugin.state.data.build();

        if (options?.theme) {
          update
            .to(component)
            .apply(StateTransforms.Representation.StructureRepresentation3D, {
              type: {
                name: options?.theme?.representation ?? "cartoon",
                params: {
                  ...options?.theme?.representationParams,
                  value: options?.theme?.representation ?? "cartoon"
                }
              },
              colorTheme: {
                name: options?.theme?.color ?? "uniform",
                params: {
                  ...options?.theme?.colorParams,
                  value: options?.theme?.colorParams?.value
                    ? getColor(options?.theme?.colorParams?.value)
                    : randomColor()
                }
              },
              sizeTheme: {
                name: options?.theme?.size ?? "physical",
                params: options?.theme?.sizeParams
              }
            });
        } else {
          // Apply default preset using the component manager when no theme is provided
          const defaultPreset =
            this.plugin.config.get(
              PluginConfig.Structure.DefaultRepresentationPreset
            ) || PresetStructureRepresentations.auto.id;
          const provider =
            this.plugin.builders.structure.representation.resolveProvider(
              defaultPreset
            );
          await this.plugin.managers.structure.component.applyPreset(
            [structureRef],
            provider
          );
        }

        await update.commit();

        return structureRef;
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
            visuals: true
          })
        );

        return null;
      }
    } catch (error) {
      console.error(
        `Failed to load molecule file: ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      return null;
    }
  };
  /**
   * Loads a trajectory using a topology file and a coordinates file
   *
   * @param topology File representing the topology/model structure
   * @param coordinates File representing the trajectory coordinates
   * @param label Optional label for the loaded trajectory
   * @returns Promise resolving to the loaded trajectory
   */
  public async loadTrajectory({
    topology,
    trajectory,
    label = "Loaded Trajectory"
  }: {
    topology: File;
    trajectory: File;
    label?: string;
  }) {
    if (!this.plugin) {
      throw new Error("Plugin is not initialized");
    }

    const t = Task.create("Load Trajectory", (taskCtx) => {
      const ctx = this.plugin!;

      return this.state
        .transaction(async () => {
          const processFile = async (file: Asset.File | null) => {
            if (!file) throw new Error("No file selected");

            const info = getFileNameInfo(file.file?.name ?? "");
            const isBinary = ctx.dataFormats.binaryExtensions.has(info.ext);
            const { data } = await ctx.builders.data.readFile({
              file,
              isBinary,
              label
            });

            // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
            const provider = ctx.dataFormats.auto(info, data.cell?.obj!);

            if (!provider) {
              ctx.log.warn(
                `LoadTrajectory: could not find data provider for '${info.ext}'`
              );
              await ctx.state.data.build().delete(data).commit();
              return;
            }

            return provider.parse(ctx, data);
          };

          try {
            const modelParsed = await processFile(Asset.File(topology));

            let model;
            if ("trajectory" in modelParsed) {
              model = await this.state
                .build()
                .to(modelParsed.trajectory)
                .apply(ModelFromTrajectory, { modelIndex: 0 })
                .commit();
            } else {
              model = modelParsed.topology;
            }

            const coordinates = await processFile(Asset.File(trajectory));

            const dependsOn = [model.ref, coordinates.ref];
            const traj = this.state
              .build()
              .toRoot()
              .apply(
                TrajectoryFromModelAndCoordinates,
                {
                  modelRef: model.ref,
                  coordinatesRef: coordinates.ref
                },
                { dependsOn }
              )
              .apply(StateTransforms.Model.ModelFromTrajectory, {
                modelIndex: 0
              });

            await this.state.updateTree(traj).runInContext(taskCtx);
            const structure = await ctx.builders.structure.createStructure(
              traj.selector
            );
            await ctx.builders.structure.representation.applyPreset(
              structure,
              "auto"
            );
          } catch (e) {
            console.error(e);
            ctx.log.error(`Error loading trajectory`);
          }
        })
        .runInContext(taskCtx);
    });
    // Run the task
    return this.plugin.runTask(t, { useOverlay: true });
  }

  // Deprecated method
  async loadPDBString(pdbString: string, label: string) {
    console.warn(
      "loadPDBString will be soon deprecated use loadMoleculeString instead."
    );

    // Parse the data from the string
    pdbString = parsePDB(pdbString);
    // Load the parsed data
    const data = await this.plugin!.builders.data.rawData({
      data: pdbString,
      label: label
    });
    const trajectory = await this.plugin!.builders.structure.parseTrajectory(
      data,
      "pdb"
    );
    const model = await this.plugin!.builders.structure.createModel(trajectory);
    const structure =
      await this.plugin!.builders.structure.createStructure(model);

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
      )
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
          colorParams: { value: Color.fromRgb(1, 0, 0) }
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
          colorParams: { value: Color.fromRgb(1, 0, 0) }
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

  public async selectWithScript({
    label,
    script,
    language
  }: {
    label?: string;
    script: string;
    language: SelectionLanguage;
  }): Promise<LociType | null> {
    let structuresToProcess: StructureRef[];

    if (label) {
      // If label is provided, use the existing logic
      const structureRef = this.getStructureObjectFromLabel(label);
      if (!structureRef) {
        return null;
      }
      structuresToProcess = [structureRef];
    } else {
      // If no label provided, get all loaded structures
      structuresToProcess =
        (this.plugin?.managers.structure.hierarchy.selection
          .structures as StructureRef[]) || [];
      if (structuresToProcess.length === 0) {
        return null;
      }
    }

    let combinedLoci: LociType | null = null;

    for (const structureRef of structuresToProcess) {
      const selection = Script.getStructureSelection(
        Script.toExpression(createSelectionScript(script, language)),
        structureRef.cell.obj!.data
      );

      const loci = StructureSelection.toLociWithSourceUnits(selection);

      if (combinedLoci) {
        // Combine loci from multiple structures
        combinedLoci = LociType.union(combinedLoci, loci);
      } else {
        combinedLoci = loci;
      }
    }

    if (combinedLoci) {
      this.plugin?.managers.interactivity.lociSelects.select({
        loci: combinedLoci
      });
    }

    return combinedLoci;
  }

  async createComponentForSelection({
    label,
    representation,
    color
  }: {
    label?: string;
    representation?: StructureRepresentationRegistry.BuiltIn;
    color?: string;
  }) {
    if (!this.plugin) return null;

    const structures =
      this.plugin!.managers.structure.hierarchy.current.structures;

    const newComponents = [];
    for (const structureRef of structures) {
      const component =
        await this.plugin.builders.structure.tryCreateComponentFromSelection(
          structureRef.cell,
          StructureSelectionQueries.current,
          `selection-${Date.now()}`,
          { label: label ?? "Custom Selection" }
        );

      if (component) {
        newComponents.push(component);

        // Apply representation with color directly
        const update = this.plugin.state.data.build();
        await update
          .to(component)
          .apply(StateTransforms.Representation.StructureRepresentation3D, {
            type: { name: representation ?? "ball-and-stick", params: {} },
            colorTheme: {
              name: "uniform",
              params: {
                value: color ? getColor(color) : randomColor()
              }
            }
          })
          .commit();
      }
    }

    return "Created";
  }

  async createComponent({
    structure,
    newSelectionLabel,
    structureLabel,
    selectionOptions,
    representationParams
  }: {
    structure?: StateObjectRef<PluginStateObject.Molecule.Structure>;
    structureLabel?: string;
    newSelectionLabel: string;
    selectionOptions?: MolecularSelection;
    representationParams?: RepresentationThemeOptions;
  }) {
    if (!this.plugin) {
      return null;
    }

    // Build the selection expression based on options
    let selectionExpression: Expression;

    // If a script string is provided, compile it with language
    if (selectionOptions?.loci) {
      selectionExpression = StructureElement.Loci.toExpression(
        selectionOptions.loci
      );
    } else if (selectionOptions?.script && selectionOptions?.language) {
      selectionExpression = buildExpressionFromSelection(
        selectionOptions.script,
        selectionOptions.language
      );
    } else if (selectionOptions?.chain_and_residue) {
      selectionExpression = MS.struct.generator.atomGroups({
        "chain-test": MS.core.rel.eq([
          MS.struct.atomProperty.macromolecular.label_asym_id(),
          selectionOptions.chain_and_residue.chain
        ]),
        "residue-test": MS.core.rel.eq([
          MS.struct.atomProperty.macromolecular.label_seq_id(),
          selectionOptions.chain_and_residue.residue
        ])
      });
    } else if (selectionOptions?.auth_chain_and_residue) {
      selectionExpression = MS.struct.generator.atomGroups({
        "chain-test": MS.core.rel.eq([
          MS.struct.atomProperty.macromolecular.auth_asym_id(),
          selectionOptions.auth_chain_and_residue.auth_chain
        ]),
        "residue-test": MS.core.rel.eq([
          MS.struct.atomProperty.macromolecular.auth_seq_id(),
          selectionOptions.auth_chain_and_residue.auth_residue
        ])
      });
    } else {
      const tests: Record<string, Expression> = {};

      if (selectionOptions?.chain) {
        tests["chain-test"] = MS.core.rel.eq([
          MS.struct.atomProperty.macromolecular.label_asym_id(),
          selectionOptions.chain
        ]);
      } else if (selectionOptions?.auth_chain) {
        tests["chain-test"] = MS.core.rel.eq([
          MS.struct.atomProperty.macromolecular.auth_asym_id(),
          selectionOptions.auth_chain
        ]);
      }

      if (selectionOptions?.entity) {
        tests["entity-test"] = MS.core.rel.eq([
          MS.struct.atomProperty.macromolecular.label_entity_id(),
          selectionOptions.entity
        ]);
      }

      if (selectionOptions?.residue) {
        tests["residue-test"] = selectionOptions.insertion_code
          ? MS.core.logic.and([
              MS.core.rel.eq([
                MS.struct.atomProperty.macromolecular.label_seq_id(),
                selectionOptions.residue
              ]),
              MS.core.rel.eq([
                MS.struct.atomProperty.macromolecular.pdbx_PDB_ins_code(),
                selectionOptions.insertion_code
              ])
            ])
          : MS.core.rel.eq([
              MS.struct.atomProperty.macromolecular.label_seq_id(),
              selectionOptions.residue
            ]);
      } else if (selectionOptions?.auth_residue !== undefined) {
        tests["residue-test"] = selectionOptions.insertion_code
          ? MS.core.logic.and([
              MS.core.rel.eq([
                MS.struct.atomProperty.macromolecular.auth_seq_id(),
                selectionOptions.auth_residue
              ]),
              MS.core.rel.eq([
                MS.struct.atomProperty.macromolecular.pdbx_PDB_ins_code(),
                selectionOptions.insertion_code
              ])
            ])
          : MS.core.rel.eq([
              MS.struct.atomProperty.macromolecular.auth_seq_id(),
              selectionOptions.auth_residue
            ]);
      } else if (selectionOptions?.residue_range) {
        tests["residue-test"] = MS.core.rel.inRange([
          MS.struct.atomProperty.macromolecular.label_seq_id(),
          selectionOptions.residue_range.start,
          selectionOptions.residue_range.end
        ]);
      } else if (selectionOptions?.auth_residue_range) {
        tests["residue-test"] = MS.core.rel.inRange([
          MS.struct.atomProperty.macromolecular.auth_seq_id(),
          selectionOptions.auth_residue_range.start,
          selectionOptions.auth_residue_range.end
        ]);
      }

      if (selectionOptions?.atom_name) {
        tests["atom-test"] = MS.core.rel.eq([
          MS.struct.atomProperty.macromolecular.label_atom_id(),
          selectionOptions.atom_name
        ]);
      } else if (selectionOptions?.auth_atom_name) {
        tests["atom-test"] = MS.core.rel.eq([
          MS.struct.atomProperty.macromolecular.auth_atom_id(),
          selectionOptions.auth_atom_name
        ]);
      } else if (selectionOptions?.element_symbol) {
        tests["atom-test"] = MS.core.rel.eq([
          MS.struct.atomProperty.core.elementSymbol(),
          selectionOptions.element_symbol
        ]);
      } else if (selectionOptions?.atom_id) {
        tests["atom-test"] = MS.core.rel.eq([
          MS.struct.atomProperty.macromolecular.id(),
          selectionOptions.atom_id
        ]);
      } else if (selectionOptions?.atom_index) {
        tests["atom-test"] = MS.core.rel.eq([
          MS.struct.atomProperty.core.sourceIndex(),
          selectionOptions.atom_index
        ]);
      }

      if (selectionOptions?.secondary_structure) {
        tests["ss-test"] = MS.core.rel.eq([
          MS.struct.type.secondaryStructureFlags,
          selectionOptions.secondary_structure
        ]);
      }

      if (selectionOptions?.type) {
        const nucleicScript = Script(selectionOptions.type, "vmd");
        selectionExpression = Script.toExpression(nucleicScript);
      }

      // Proximity selection is recursive
      if (selectionOptions?.within_distance) {
        const { radius, target } = selectionOptions.within_distance;
        selectionExpression = MS.struct.modifier.includeSurroundings({
          0: buildExpressionFromSelection(target.script, target.language),
          radius,
          "as-whole-residues": true
        });
      } else {
        selectionExpression = MS.struct.generator.atomGroups(tests);
      }
    }

    if (!structure) {
      // Get root-level structure cells using substructure parent helper
      const structureCells = this.plugin.state.data.select(
        StateSelection.Generators.ofType(PluginStateObject.Molecule.Structure)
      );

      // Find the root parent for each structure and check its label
      structure =
        structureCells.find((s) => {
          if (!s.obj?.data) return false;

          // Get the root parent cell using the substructure parent helper
          const parentCell = this.plugin!.helpers.substructureParent.get(
            s.obj.data
          );
          return parentCell?.obj?.label === structureLabel;
        }) ?? structureCells[0];

      if (!structure) {
        return;
      }
    }
    // Create a component from the selection
    const component =
      await this.plugin?.builders.structure.tryCreateComponentFromExpression(
        structure,
        selectionExpression,
        `selection-${Date.now()}`,
        { label: newSelectionLabel }
      );

    if (!component) {
      console.log("expression", selectionExpression, "produced error");
      throw new Error("Failed to create component from selection");
    }

    // Apply ball-and-stick representation
    const update = this.plugin.state.data.build();
    update
      .to(component)
      .apply(StateTransforms.Representation.StructureRepresentation3D, {
        type: {
          name: representationParams?.representation ?? "ball-and-stick",
          params: representationParams?.representationParams
        },
        colorTheme: {
          name: representationParams?.color ?? newSelectionLabel,
          params: {
            ...representationParams?.colorParams,
            value: representationParams?.colorParams?.value
              ? getColor(representationParams.colorParams.value)
              : randomColor()
          }
        },
        sizeTheme: {
          name: representationParams?.size ?? "physical",
          params: representationParams?.sizeParams
        }
      });

    await update.commit();
    return component;
  }

  async createBallAndStickFromLoci(
    loci: StructureElement.Loci,
    structureRef: StructureRef
  ): Promise<void> {
    if (!this.plugin) return;

    const expression = StructureElement.Loci.toExpression(loci);
    const selectionQuery = StructureSelectionQuery(
      "Custom Selection",
      expression
    );

    // Create component from selection query
    const component =
      await this.plugin.builders.structure.tryCreateComponentFromSelection(
        structureRef.cell,
        selectionQuery,
        "ball-stick-component",
        { label: "Ball & Stick Selection" }
      );

    if (!component) return;

    // Add ball-and-stick representation
    await this.plugin.builders.structure.representation.addRepresentation(
      component,
      {
        type: this.plugin.representation.structure.registry.get(
          "ball-and-stick"
        ),
        typeParams: {
          sizeFactor: 0.15,
          sizeAspectRatio: 2 / 3,
          quality: "auto"
        }
      }
    );
  }

  public getStructureFromLoci<T extends boolean = false>(
    loci: StructureElement.Location<Unit> | StructureElement.Loci,
    options: {
      includeRef: T;
    } = { includeRef: false } as { includeRef: T }
  ): T extends true ? MolInfoWithRef : MolInfo {
    // Handle both Location and Loci types
    let location: StructureElement.Location<Unit>;
    if ("kind" in loci && loci.kind === "element-loci") {
      // It's a StructureElement.Loci, get the first location
      const firstLocation = StructureElement.Loci.getFirstLocation(loci);
      if (!firstLocation) {
        throw new Error("Could not get first location from loci");
      }
      location = firstLocation;
    } else {
      // It's already a StructureElement.Location<Unit>
      location = loci as StructureElement.Location<Unit>;
    }

    const lociID = location.structure.model.id;

    const structure = this.listStructures({ includeRef: true }).find((s) =>
      s.structureRef.cell.obj?.data.units
        .map((u) => u.model.id)
        .includes(lociID)
    );

    if (!structure)
      throw new Error("Could not find structure for the given loci");

    if (options?.includeRef) {
      return structure;
    }

    // Remove the structureRef, the structure already contains the ID, and the structureRef
    // is a big object which we prefer to not include. In case a developer needs it,
    // it can be accessed from the listStructures({includeRef: true}) method.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { structureRef, ...structureWithoutRef } = structure;

    return structureWithoutRef as T extends true ? MolInfoWithRef : MolInfo;
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
    const chainID = StructureProperties.chain.auth_asym_id(loc);
    const type = StructureProperties.atom.type_symbol(loc);
    const x = StructureProperties.atom.x(loc);
    const y = StructureProperties.atom.y(loc);
    const z = StructureProperties.atom.z(loc);
    const label = structureID
      ? this.getLabelFromStructureRef(structureID)
      : StructureProperties.unit.model_label(loc);
    const structure = this.getStructureFromLoci(loc);

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
      label: label ?? "No label",
      structure: structure
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

  structures(): StructureRef[] {
    if (!this.plugin || !this.plugin.managers.structure.hierarchy.current) {
      return [];
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
  // Gets file contents as hex string from root reference
  private getFileAsHexStringFromRootRef(rootRef: string): {
    fileContents: string | null;
    fileName: string;
    format: string;
  } {
    try {
      const cell = this.plugin?.state?.data?.cells?.get(rootRef);
      if (!cell?.obj) {
        return { fileContents: null, fileName: "Unknown", format: "Unknown" };
      }

      // Try trajectory data first
      const trajectoryData = cell.obj.data?.representative?.sourceData;
      if (trajectoryData?.data?.source?.data?.lines?.data) {
        return {
          fileContents: trajectoryData.data.source.data.lines.data,
          fileName: trajectoryData.name ?? "Unknown",
          format: trajectoryData.data.source.kind ?? "unknown"
        };
      }

      // Fall back to structure data
      const fileName = cell.params?.values?.file?.name || "Unknown";
      const data = cell.obj.data;
      const fileContents = data ? data.toString(16) : null;

      return {
        fileContents,
        fileName,
        format: fileName.split(".").pop() || "unknown"
      };
    } catch (error) {
      console.error(
        `Error retrieving file contents from root reference '${rootRef}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return {
        fileContents: null,
        fileName: "Unknown",
        format: "Unknown"
      };
    }
  }

  // Searches iteratively until finding the actual label of the structure (the one on the root)
  public getLabelFromStructureRef(refID: string): string {
    if (!this.plugin?.state?.data?.cells) return "Unknown";

    // Try getting the label from the topology data if it's a trajectory
    const cell = this.plugin.state.data.cells.get(refID);
    const trajectoryLabel = cell?.obj?.data?.representative?.label;
    if (trajectoryLabel) return trajectoryLabel;

    // If it fails, try getting the label from the structure cell (e.g. PDB files)
    try {
      const structureRootID =
        this.getStructureRootIDFromStructureSourceRef(refID);
      const structureLabel =
        this.plugin.state.data.cells.get(structureRootID)?.obj?.label;
      return structureLabel || "Unknown";
    } catch (error) {
      console.error(
        `Error retrieving label from structure reference '${refID}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return "Unknown";
    }
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
  public listStructures<T extends boolean = false>(
    {
      includeRef
    }: {
      includeRef?: T;
    } = {} as { includeRef?: T }
  ): T extends true ? MolInfoWithRef[] : MolInfo[] {
    const structures = this.structures();

    const molList: MolInfo[] = [];

    try {
      for (const structure of structures) {
        const rootRef = this.getStructureRootIDFromStructureSourceRef(
          structure.cell.sourceRef!
        );

        let kind: MolInfoKind = "structure";
        if (structure.genericRepresentations) {
          const params =
            structure.genericRepresentations[0]?.cell.params?.values || {};

          kind = params?.type?.name ?? "structure";
        }

        const molInfo: MolInfoWithRef | MolInfo = {
          kind,
          id: structure.cell.sourceRef!,
          structureRef: includeRef ? structure : undefined,
          rootRef: rootRef,
          label: this.getLabelFromStructureRef(rootRef) ?? "Unknown",
          ...this.getFileAsHexStringFromRootRef(rootRef)
        };

        if (molInfo.fileContents !== null) {
          molList.push(molInfo);
        }
      }
    } catch (error) {
      alert(
        `Failed to list structures: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    return molList as T extends true ? MolInfoWithRef[] : MolInfo[];
  }

  public listHeteroAtoms(label?: string): { [id: string]: AtomInfo[] } {
    // Determine which structures to list based on the provided label
    const structuresToList = label
      ? (() => {
          const structure = this.getStructureObjectFromLabel(label);
          return structure ? [structure] : []; // Return an empty array if no valid structure
        })()
      : this.structures();

    if (label && structuresToList.length === 0) {
      return {};
    }

    const atoms: { [id: string]: AtomInfo[] } = {};
    for (const s of structuresToList) {
      atoms[s.cell.sourceRef!] = this.getAtomsFromStructure(s);
    }

    // Map each structure to its list of hetero atoms
    return atoms;
  }

  /**
   * Retrieves the information of all hetero atoms in the given structure.
   *
   * @param {StructureRef} structureRef - The reference to the structure from which to retrieve the atoms.
   * @return {AtomInfo[]} An array of AtomInfo objects representing the hetero atoms in the structure.
   */
  private getAtomsFromStructure(structureRef: StructureRef): AtomInfo[] {
    const resInfo: AtomInfo[] = [];

    Structure.eachAtomicHierarchyElement(structureRef.cell.obj!.data, {
      atom: (loc) => {
        // auth_comp_id is the 3 letter code for the residue like "ALA", "GLY", etc.
        const auth_comp_id = StructureProperties.atom.auth_comp_id(loc);

        // Skip waters
        if (auth_comp_id === "HOH") return;

        if (
          standardResidues.includes(auth_comp_id) ||
          nucleotidesResidues.includes(auth_comp_id)
        )
          return;

        const res = this.extractAtomInfo(loc, structureRef.cell.sourceRef);
        resInfo.push(res);
      }
    });

    return resInfo;
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
        const res = this.extractAtomInfo(loc, structureRef.cell.sourceRef);

        const { auth_comp_id } = res;

        // Skip waters
        if (auth_comp_id === "HOH") return;

        // auth_comp_id is the 3 letter code for the residue like "ALA", "GLY", etc.
        if (get === "hetero" && standardResidues.includes(auth_comp_id)) return;
        else if (get === "standard" && !standardResidues.includes(auth_comp_id))
          return;

        // If the molInfo.ID and the current auth_comp_id are already in the
        // heteroInfo array, then don't add it again
        if (unique) {
          for (const info of resInfo) {
            if (
              info.structure?.id === res.structure?.id &&
              info.auth_comp_id === res.auth_comp_id &&
              info.residue === res.residue &&
              info.chainID === res.chainID
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
      }
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
      return [];
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
      return [];
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
      return [];
    }

    // Map each structure to its list of hetero residues
    return structuresToList.flatMap((s) =>
      this.getResiduesFromStructure(s, "chain")
    );
  }
  private getStructureFromRef(
    structureRef: StructureRef
  ): Structure | undefined {
    if (!this.plugin) return;

    const structureCell = StateObjectRef.resolveAndCheck(
      this.plugin.state.data,
      structureRef.cell.transform.ref
    );
    return structureCell?.obj?.data;
  }

  public getStructureInfo(
    structureRef: StructureRef
  ): StructureInfoWithLoci | undefined {
    const structure = this.getStructureFromRef(structureRef);
    if (!structure) return;

    const chains = new Map<
      string,
      {
        loci: StructureElement.Loci;
        residues: Map<string, StructureElement.Loci>;
        hetero: Map<string, StructureElement.Loci>;
      }
    >();

    const location = StructureElement.Location.create(structure);

    // Iterate through all atomic units in the structure
    for (const unit of structure.units) {
      if (unit.kind !== 0) continue; // 0 are strictly atoms

      location.unit = unit;
      const elements = unit.elements;
      const chainSegments = unit.model.atomicHierarchy.chainAtomSegments;
      const residueSegments = unit.model.atomicHierarchy.residueAtomSegments;

      const chainsIt = Segmentation.transientSegments(chainSegments, elements);
      const residuesIt = Segmentation.transientSegments(
        residueSegments,
        elements
      );

      while (chainsIt.hasNext) {
        const chainSegment = chainsIt.move();
        location.element = elements[chainSegment.start]!;
        const chainId = StructureProperties.chain.auth_asym_id(location);

        // Create chain loci
        const chainIndices = OrderedSet.ofRange(
          chainSegment.start,
          chainSegment.end
        );
        const chainLoci = StructureElement.Loci(structure, [
          { unit, indices: chainIndices as OrderedSet<UnitIndex> }
        ]);

        // Initialize chain entry if it doesn't exist
        if (!chains.has(chainId)) {
          chains.set(chainId, {
            loci: chainLoci,
            residues: new Map<string, StructureElement.Loci>(),
            hetero: new Map<string, StructureElement.Loci>()
          });
        }

        const chainData = chains.get(chainId)!;

        residuesIt.setSegment(chainSegment);
        while (residuesIt.hasNext) {
          const residueSegment = residuesIt.move();
          location.element = elements[residueSegment.start]!;
          const resName = StructureProperties.atom.auth_comp_id(location);
          const resSeqId = StructureProperties.residue.auth_seq_id(location);
          const residueKey = `${chainId}:${resName}:${resSeqId}`;

          // Create residue loci
          const residueIndices = OrderedSet.ofRange(
            residueSegment.start,
            residueSegment.end
          );
          const residueLoci = StructureElement.Loci(structure, [
            { unit, indices: residueIndices as OrderedSet<UnitIndex> }
          ]);

          // Check if it's a hetero residue
          const isHet =
            StructureProperties.residue.group_PDB(location) !== "ATOM";
          if (isHet) {
            chainData.hetero.set(residueKey, residueLoci);
          } else {
            // Add residue to the chain's residues
            chainData.residues.set(residueKey, residueLoci);
          }
        }
      }
    }

    return {
      chains: Array.from(chains.entries()).map(([id, chainData]) => ({
        id,
        loci: chainData.loci,
        residues: Array.from(chainData.residues.entries()).map(
          ([residueId, loci]) => ({
            id: residueId,
            loci
          })
        ),
        hetero: Array.from(chainData.hetero.entries()).map(
          ([heteroId, loci]) => ({
            id: heteroId,
            loci
          })
        )
      }))
    };
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
      label: nodeName
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
  public async addSphere({
    position,
    radius,
    opacity,
    color,
    deletePrevious
  }: {
    position: {
      x: number;
      y: number;
      z: number;
    };
    radius: number;
    opacity?: number;
    color?: Color;
    deletePrevious?: SphereRef;
  }): Promise<SphereRef> {
    deletePrevious &&
      this.removeShape(deletePrevious.ref, { removeNode: true });

    const structure = await this.createEmptyNode("Sphere");

    if (!structure) {
      throw new Error(
        "Failed to add sphere to molstar. Could not get a valid structure to place it."
      );
    }

    const sphere: SphereRef = {
      x: position.x,
      y: position.y,
      z: position.z,
      radius: radius,
      color: deletePrevious?.color ?? color ?? randomColor(),
      alpha: opacity ?? 0.3,
      ref: ""
    };

    // @ts-ignore
    sphere.ref = await addSphereTo(this.plugin!, structure, sphere);

    return sphere;
  }

  public async moveSphere({
    sphereRef,
    newPosition,
    newRadius,
    newColor,
    newOpacity
  }: {
    sphereRef?: string;
    newPosition?: { x: number; y: number; z: number };
    newRadius?: number;
    newColor?: Color;
    newOpacity?: number;
  }): Promise<boolean> {
    if (!sphereRef) return false;

    // Get the state object from the ref
    const stateObject = this.plugin!.state.data.select(sphereRef)[0];

    if (!stateObject) {
      return false;
    }

    // Update the sphere's transform or recreate with new position
    const currentTransform = stateObject.transform;

    // Ensure params and position exist before updating
    const params = currentTransform.params?.type?.params;
    if (
      !params ||
      typeof params.x !== "number" ||
      typeof params.y !== "number" ||
      typeof params.z !== "number" ||
      typeof params.radius !== "number"
    ) {
      return false;
    }

    const newParams = {
      ...currentTransform.params,
      type: {
        ...currentTransform.params.type,
        params: {
          ...params,
          x: newPosition?.x ?? params.x,
          y: newPosition?.y ?? params.y,
          z: newPosition?.z ?? params.z,
          radius: newRadius ?? params.radius,
          color: newColor ?? params.color,
          opacity: newOpacity ?? params.opacity
        }
      }
    };

    // Update the state object with new parameters
    await this.plugin!.state.updateTransform(
      this.plugin!.state.data,
      sphereRef,
      newParams
    );

    return true;
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

  public async addBox({
    position,
    radiusScale,
    radialSegments,
    opacity,
    color,
    deletePrevious
  }: {
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
    };
    radiusScale: number;
    radialSegments: number;
    opacity?: number;
    color?: Color;
    deletePrevious?: BoxRef;
  }): Promise<BoxRef> {
    deletePrevious &&
      this.removeShape(deletePrevious.ref, { removeNode: true });

    // Generate a box node
    const structure = await this.createEmptyNode("Box");

    if (!structure) {
      throw new Error(
        "Failed to add box to molstar. Could not get a valid structure to place it."
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
      ref: ""
    };

    // @ts-ignore
    box.ref = await addBoxTo(this.plugin!, structure, box);

    return box;
  }

  /**
   * Moves an existing box to a new position and/or updates its properties.
   *
   * This method updates an existing box's position, radius scale, radial segments, and/or color
   * by modifying the state object parameters. It follows the same pattern as moveSphere.
   *
   * @param {object} params The parameters for moving the box.
   * @param {string} params.boxRef The reference ID of the box to move.
   * @param {object} [params.newPosition] The new position for the box vertices (optional).
   * @param {number} [params.newPosition.x0] New x-coordinate of the first vertex.
   * @param {number} [params.newPosition.y0] New y-coordinate of the first vertex.
   * @param {number} [params.newPosition.z0] New z-coordinate of the first vertex.
   * @param {number} [params.newPosition.x1] New x-coordinate of the second vertex.
   * @param {number} [params.newPosition.y1] New y-coordinate of the second vertex.
   * @param {number} [params.newPosition.z1] New z-coordinate of the second vertex.
   * @param {number} [params.newPosition.x2] New x-coordinate of the third vertex.
   * @param {number} [params.newPosition.y2] New y-coordinate of the third vertex.
   * @param {number} [params.newPosition.z2] New z-coordinate of the third vertex.
   * @param {number} [params.newPosition.x3] New x-coordinate of the fourth vertex.
   * @param {number} [params.newPosition.y3] New y-coordinate of the fourth vertex.
   * @param {number} [params.newPosition.z3] New z-coordinate of the fourth vertex.
   * @param {number} [params.newRadiusScale] The new radius scale for the box (optional).
   * @param {number} [params.newRadialSegments] The new number of radial segments for the box (optional).
   * @param {Color} [params.newColor] The new color for the box (optional).
   *
   * @returns {Promise<boolean>} A promise that resolves to true if the box was successfully moved, false otherwise.
   */
  public async moveBox({
    boxRef,
    newPosition,
    newRadiusScale,
    newRadialSegments,
    newColor,
    newOpacity
  }: {
    boxRef?: string;
    newPosition?: {
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
    };
    newRadiusScale?: number;
    newRadialSegments?: number;
    newColor?: Color;
    newOpacity?: number;
  }): Promise<boolean> {
    if (!boxRef) {
      return false;
    }

    // Get the state object from the ref
    const stateObject = this.plugin!.state.data.select(boxRef)[0];
    if (!stateObject) {
      return false;
    }

    // Update the box's transform or recreate with new parameters
    const currentTransform = stateObject.transform;

    // Ensure params and position exist before updating
    const params = currentTransform.params?.type?.params;
    if (
      !params ||
      typeof params.x0 !== "number" ||
      typeof params.y0 !== "number" ||
      typeof params.z0 !== "number" ||
      typeof params.x1 !== "number" ||
      typeof params.y1 !== "number" ||
      typeof params.z1 !== "number" ||
      typeof params.x2 !== "number" ||
      typeof params.y2 !== "number" ||
      typeof params.z2 !== "number" ||
      typeof params.x3 !== "number" ||
      typeof params.y3 !== "number" ||
      typeof params.z3 !== "number" ||
      typeof params.radiusScale !== "number" ||
      typeof params.radialSegments !== "number"
    ) {
      return false;
    }

    const newParams = {
      ...currentTransform.params,
      type: {
        ...currentTransform.params.type,
        params: {
          ...params,
          x0: newPosition?.x0 ?? params.x0,
          y0: newPosition?.y0 ?? params.y0,
          z0: newPosition?.z0 ?? params.z0,
          x1: newPosition?.x1 ?? params.x1,
          y1: newPosition?.y1 ?? params.y1,
          z1: newPosition?.z1 ?? params.z1,
          x2: newPosition?.x2 ?? params.x2,
          y2: newPosition?.y2 ?? params.y2,
          z2: newPosition?.z2 ?? params.z2,
          x3: newPosition?.x3 ?? params.x3,
          y3: newPosition?.y3 ?? params.y3,
          z3: newPosition?.z3 ?? params.z3,
          radiusScale: newRadiusScale ?? params.radiusScale,
          radialSegments: newRadialSegments ?? params.radialSegments,
          color: newColor ?? params.color,
          opacity: newOpacity ?? params.opacity
        }
      }
    };

    // Update the state object with new parameters
    await this.plugin!.state.updateTransform(
      this.plugin!.state.data,
      boxRef,
      newParams
    );

    return true;
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
  public async removeShape(
    ref: string,
    { removeNode }: { removeNode?: boolean } = {}
  ) {
    const builder = this.plugin?.state.data.build();
    builder?.delete(ref);
    builder?.commit();

    // Remove the node, not only the representation
    // used for removing spheres and boxes when needed
    if (removeNode) {
      // Get the shape object to find its parent structure
      const shapeObj = this.plugin?.state.data.select(ref);
      if (!shapeObj || !shapeObj[0]) return;

      // find the structure that contains this shape
      const strucNode = this.listStructures({ includeRef: true }).find(
        (s) => shapeObj[0]?.sourceRef === s.structureRef.cell.transform.ref
      );

      if (strucNode) {
        this.removeStructure(strucNode);
      }
    }
  }

  public removeStructure(structure: MolInfoWithRef) {
    if (!this.plugin) return;

    PluginCommands.State.RemoveObject(this.plugin, {
      state: structure.structureRef.cell.parent!,
      ref: structure.rootRef,
      removeParentGhosts: true
    });
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
          type: representation
        },
        {
          tag: reprTag
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

  public substractSelection() {
    const sel =
      this.plugin?.managers.structure.hierarchy.getStructuresWithSelection() ??
      [];
    const components: StructureComponentRef[] = [];
    for (const s of sel) components.push(...s.components);
    if (components.length === 0) return;
    this.plugin?.managers.structure.component.modifyByCurrentSelection(
      components,
      "subtract"
    );

    return components.length;
  }

  private atomEntries() {
    const plugin = this.plugin;

    if (!plugin) return [];

    const structureEntries = new Map<
      Structure,
      StructureSelectionHistoryEntry[]
    >();
    const history = plugin.managers.structure.selection.additionsHistory;

    for (let i = 0, il = history.length; i < il; ++i) {
      const e = history[i]!;

      // if (StructureElement.Loci.size(e.loci) !== 1) continue;

      const k = e.loci.structure;
      if (structureEntries.has(k)) structureEntries.get(k)!.push(e);
      else structureEntries.set(k, [e]);
    }

    const entries: AtomsLociEntry[] = [];
    structureEntries.forEach((atoms, structure) => {
      const cell = plugin.helpers.substructureParent.get(structure)!;

      const elements: StructureElement.Loci["elements"][0][] = [];
      for (let i = 0, il = atoms.length; i < il; ++i) {
        // note, we don't do loci union here to keep order of selected atoms
        // for atom pairing during superposition
        elements.push(atoms[i]!.loci.elements[0]!);
      }

      const loci = StructureElement.Loci(atoms[0]!.loci.structure, elements);
      const label = loci.structure.label.split(" | ")[0]!;
      entries.push({ loci, label, cell, atoms });
    });
    return entries;
  }

  public getRootStructure(s: Structure) {
    const parent = this.plugin!.helpers.substructureParent.get(s)!;
    const rootData = this.plugin!.state.data.selectQ((q) =>
      q.byValue(parent).rootOfType(PluginStateObject.Molecule.Structure)
    )[0]?.obj?.data;

    return rootData;
  }

  async transform(
    s: StateObjectRef<PluginStateObject.Molecule.Structure>,
    matrix: Mat4,
    coordinateSystem?: SymmetryOperator
  ) {
    const plugin = this.plugin;
    if (!plugin) return;

    const r = StateObjectRef.resolveAndCheck(plugin.state.data, s);
    if (!r) return;
    const o = plugin.state.data.selectQ((q) =>
      q
        .byRef(r.transform.ref)
        .subtree()
        .withTransformer(StateTransforms.Model.TransformStructureConformation)
    )[0];

    const transform =
      coordinateSystem && !Mat4.isIdentity(coordinateSystem.matrix)
        ? Mat4.mul(Mat4(), coordinateSystem.matrix, matrix)
        : matrix;

    const params = {
      transform: {
        name: "matrix" as const,
        params: { data: transform, transpose: false }
      }
    };
    const b = o
      ? plugin.state.data.build().to(o).update(params)
      : plugin.state.data
          .build()
          .to(s)
          .insert(
            StateTransforms.Model.TransformStructureConformation,
            params,
            { tags: "SuperpositionTransform" }
          );
    await plugin.runTask(plugin.state.data.updateTree(b));
  }

  public async alignAtoms() {
    const plugin = this.plugin;
    if (!plugin) return;

    const entries = this.atomEntries();

    let atomLocis: StructureElement.Loci[];
    try {
      atomLocis = entries.map((e) => {
        const rootS = this.getRootStructure(e.loci.structure);

        if (!rootS) {
          return e.loci;
        }

        return StructureElement.Loci.remap(e.loci, rootS);
      });
    } catch (e) {
      console.error("Error during loci remapping:", e);
      return;
    }

    if (atomLocis.length < 2) {
      alert(
        "At least two different structures must be selected for alignment."
      );
      return;
    }

    const transforms = superpose(atomLocis);

    const pivot = plugin.managers.structure.hierarchy.findStructure(
      atomLocis[0]?.structure
    );
    const coordinateSystem = pivot?.transform?.cell.obj?.data.coordinateSystem;

    for (let i = 1, il = atomLocis.length; i < il; ++i) {
      const eB = entries[i]!;
      const { bTransform } = transforms[i - 1]!;
      await this.transform(eB.cell, bTransform, coordinateSystem);
    }
  }

  /**
   * Aligns multiple structures based on a root structure and target structures.
   *
   * This method is intended to align a set of target structures to a specified root structure.
   * The alignment process typically involves superimposing the target structures onto the root
   * structure based on their atomic coordinates. The method currently serves as a placeholder
   * for future implementation.
   * * @param {object} params The parameters for the alignment.
   * @param {string} params.root The label of the root structure to align to.
   * @param {string[]} params.targets An array of labels for the target structures to be aligned.
   *
   * @returns {void}
   *
   * @throws {Error} If there is an issue with the alignment process or if the specified structures are invalid.
   */
  // public async align({ root, targets }: { root: string; targets: string[] }) {
  public async alignStructures({
    root,
    targets
  }: {
    root: Structure;
    targets: Structure[];
    options?: AlignmentOptions;
  }) {
    if (!root) {
      console.error(`Root structure data not found for alignment`);
      return;
    }

    const plugin = this.plugin;
    if (!plugin) return;

    // Get the loci representation of the structures
    const datasLoci = [root, ...targets].map((s) =>
      Structure.toStructureElementLoci(s)
    );

    // Get the matris transform to superpose the structures
    const transforms = superpose(datasLoci);

    // Apply transformations
    // TODO: Animate the transition between states
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];

      const bTransform = transforms[i]?.bTransform;

      if (!bTransform || !t) continue;

      // Apply the transform
      const params = {
        transform: {
          name: "matrix" as const,
          params: { data: bTransform, transpose: false }
        }
      };

      const cell = plugin.managers.structure.hierarchy.findStructure(t);

      if (!cell) continue;

      const task = plugin.state.data
        .build()
        .to(cell.cell)
        .insert(StateTransforms.Model.TransformStructureConformation, params, {
          tags: "Superposition"
        });

      await plugin.runTask(plugin.state.data.updateTree(task));
    }
  }

  public async optimizeMolecule({
    structure,
    loadResult = true,
    options
  }: {
    structure: MolInfoWithRef;
    loadResult?: boolean;
    options?: OptimizationOptions;
  }) {
    if (!structure) {
      console.error(`Structure data not found for optimization`);
      return null;
    }

    const plugin = this.plugin;
    if (!plugin) {
      console.error("Plugin not initialized");
      return null;
    }

    if (!structure.fileContents) {
      console.error("Structure file contents not available");
      return null;
    }

    const optimizationId = this.generateOptimizationId();

    const promise = new Promise<OptimizationResult>((resolve, reject) => {
      this.optimizationPromises.set(optimizationId, {
        resolve,
        reject,
        onProgress: options?.onProgress
      });
    });

    // Set up message handler if not already done
    if (!this.openBabelWorker.onmessage) {
      this.openBabelWorker.onmessage = (event) => {
        const { result, error, conversionId, progress, trajectory } =
          event.data;
        const promiseHandlers = this.optimizationPromises.get(conversionId);

        if (promiseHandlers) {
          if (error) {
            promiseHandlers.reject(new Error(error));
            this.optimizationPromises.delete(conversionId);
          } else if (progress) {
            // Handle progress updates
            if (promiseHandlers.onProgress) {
              promiseHandlers.onProgress(progress);
            }

            // If optimization is completed
            if (progress.completed && result) {
              promiseHandlers.resolve({
                optimizedStructure: result,
                trajectory: trajectory || []
              });
              this.optimizationPromises.delete(conversionId);

              // Optionally load the optimized structure & restore the original modificated structure
              if (loadResult) {
                const optimizedLabel = `${structure.label}_optimized.${
                  structure.format
                }`;
                this.loadOptimizedStructure(result, optimizedLabel);

                // Restore original structure
                const existingTransform = this.plugin!.state.data.selectQ((q) =>
                  q
                    .byRef(structure.structureRef.model!.cell.transform.ref)
                    .subtree()
                    .withTransformer(StateTransforms.Model.ModelWithCoordinates)
                )[0];

                if (existingTransform) {
                  // If ModelWithCoordinates transform exists, remove it to revert to original
                  this.plugin!.state.data.build()
                    .to(existingTransform)
                    .update({
                      atomicCoordinateFrame: undefined
                    })
                    .commit();
                }
              }
            }
          } else if (result) {
            // Handle final result without progress
            promiseHandlers.resolve({
              optimizedStructure: result,
              trajectory: trajectory || []
            });
            this.optimizationPromises.delete(conversionId);

            // Optionally load the optimized structure & restore the original modificated structure
            if (loadResult) {
              const optimizedLabel = `${structure.label}_optimized.${
                structure.format
              }`;
              this.loadOptimizedStructure(result, optimizedLabel);

              console.log("Loaded optimized structure:", optimizedLabel);

              // Restore original structure
              const existingTransform = this.plugin!.state.data.selectQ((q) =>
                q
                  .byRef(structure.structureRef.model!.cell.transform.ref)
                  .subtree()
                  .withTransformer(StateTransforms.Model.ModelWithCoordinates)
              )[0];

              if (existingTransform) {
                // If ModelWithCoordinates transform exists, remove it to revert to original
                this.plugin!.state.data.build()
                  .delete(existingTransform)
                  .commit();
              }
            }
          }
        }
      };

      this.openBabelWorker.onerror = (error) => {
        console.error("Optimization worker error:", error);
        // Reject all pending promises
        this.optimizationPromises.forEach(({ reject }) => {
          reject(new Error("Worker error occurred"));
        });
        this.optimizationPromises.clear();
      };
    }

    // Send optimization task to worker
    this.openBabelWorker.postMessage({
      task: "optimize",
      molecule: structure.fileContents,
      options: {
        inputFormat: structure.format || "pdb",
        outputFormat: "pdb",
        constraints: options?.constraints || [],
        steps: options?.steps || 200,
        chunk: options?.chunk || 10,
        forceField: options?.forceField || "uff"
      },
      conversionId: optimizationId,
      baseURL: location.origin + (window as any).__HORUS_ROOT__
    });

    return promise;
  }

  private generateOptimizationId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  /**
   * Loads an optimized structure back into Molstar
   *
   * @param optimizedPdb - The optimized PDB structure content
   * @param label - Label for the new structure
   * @param replaceOriginal - Whether to replace the original structure or add as new
   */
  public async loadOptimizedStructure(
    optimizedPdb: string,
    label: string = "Optimized Structure"
  ) {
    if (!this.plugin) {
      console.error("Plugin not initialized");
      return null;
    }

    try {
      // Create a blob from the PDB content
      const blob = new Blob([optimizedPdb], { type: "text/plain" });
      const file = new File([blob], `${label}.pdb`, { type: "text/plain" });

      // Load the optimized structure
      const result = await this.loadMoleculeFile(file, {
        label: label
      });

      return result;
    } catch (error) {
      console.error("Error loading optimized structure:", error);
      return null;
    }
  }

  // /**
  //  * Optimizes a specific residue in a structure and optionally loads the result
  //  *
  //  * @param structureLabel - Label of the structure to optimize
  //  * @param chainId - Chain ID containing the residue to optimize
  //  * @param residueNumber - Residue number to optimize
  //  * @param optimizationOptions - Additional optimization parameters
  //  */
  // public async optimizeResidue({
  //   targetStructure,
  //   loadResult = true,
  //   ...optimizationOptions
  // }: {
  //   targetStructure: MolInfo;
  //   loadResult?: boolean;
  // } & OptimizationOptions) {
  //   if (!targetStructure) {
  //     console.error(`Structure missing or not found`);
  //     return null;
  //   }

  //   try {
  //     // Perform optimization
  //     const result = await this.optimizeMolecule({
  //       structure: targetStructure,
  //       options: {
  //         chainId,
  //         residueNumber,
  //         ...optimizationOptions
  //       }
  //     });

  //     if (!result) {
  //       console.error("Optimization failed");
  //       return null;
  //     }

  //     // Optionally load the optimized structure
  //     if (loadResult) {
  //       const optimizedLabel = `${targetStructure.label}_optimized_${chainId}_${residueNumber}.${targetStructure.format}`;
  //       await this.loadOptimizedStructure(
  //         result.optimizedStructure,
  //         optimizedLabel
  //       );
  //     }

  //     return result;
  //   } catch (error) {
  //     console.error("Error during residue optimization:", error);
  //     return null;
  //   }
  // }

  public async updateCoordinates(
    structure: MolInfoWithRef,
    newCoordinates: { frame: number; coords: number[][] }
  ) {
    const model = structure.structureRef.model?.cell.obj?.data;

    if (!model) {
      console.error("Model not found for the given structure reference");
      return;
    }

    const atomCount = model.atomicHierarchy.atoms._rowCount;
    const { coords } = newCoordinates;

    // Create NEW coordinate arrays from the new coordinates
    const x = new Float32Array(atomCount);
    const y = new Float32Array(atomCount);
    const z = new Float32Array(atomCount);

    // Apply the new coordinates
    for (let i = 0; i < Math.min(atomCount, coords.length); i++) {
      x[i] = coords[i]![0]!;
      y[i] = coords[i]![1]!;
      z[i] = coords[i]![2]!;
    }

    // Create a NEW Frame object each time - this is crucial!
    // The ModelWithCoordinates transform uses reference equality check
    const frame: Frame = {
      elementCount: atomCount,
      time: Time(newCoordinates.frame, "step"),
      x,
      y,
      z,
      xyzOrdering: { isIdentity: true }
    };

    // Check if ModelWithCoordinates transform already exists
    const existingTransform = this.plugin!.state.data.selectQ((q) =>
      q
        .byRef(structure.structureRef.model!.cell.transform.ref)
        .subtree()
        .withTransformer(StateTransforms.Model.ModelWithCoordinates)
    )[0];

    if (existingTransform) {
      // Update existing ModelWithCoordinates transform
      await this.plugin!.state.data.build()
        .to(existingTransform)
        .update({
          frameIndex: newCoordinates.frame,
          atomicCoordinateFrame: frame
        })
        .commit();
    } else {
      // Apply new ModelWithCoordinates transform
      await this.plugin!.state.data.build()
        .to(structure.structureRef.model!.cell)
        .apply(StateTransforms.Model.ModelWithCoordinates, {
          frameIndex: newCoordinates.frame,
          frameCount: 1,
          atomicCoordinateFrame: frame
        })
        .commit();
    }
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
        case "loadTrajectory":
          const topology = await window.horus.getFile(data.topology);
          const trajectory = await window.horus.getFile(data.trajectory);
          const label = data.label;

          await this.loadTrajectory({
            topology: new File([topology], data.topologyFileName),
            trajectory: new File([trajectory], data.trajectoryFileName),
            label
          });
          break;

        case "addMolecule":
          const blob = await window.horus.getFile(data.molContent);
          await this.loadMoleculeFile(new File([blob], data.fileName), {
            ...data.options
          });
          break;
        case "addComponent":
          await this.createComponent({
            structureLabel: data.label,
            newSelectionLabel: data.selectionLabel ?? "Add Component",
            selectionOptions: data.options?.selection,
            representationParams: data.options?.theme
          });
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
          await this.addBox({
            position: data.position,
            radiusScale: data.radiusScale,
            radialSegments: data.radialSegments,
            opacity: data.opacity ?? 1,
            color: data.color ? Color.fromHexStyle(data.color) : randomColor()
          });
          break;
        case "addSphere":
          await this.addSphere({
            position: data.position,
            radius: data.radius,
            opacity: data.opacity,
            color: data.color ? Color.fromHexStyle(data.color) : randomColor(),
            deletePrevious: data.deletePrevious
          });
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
  "HIE"
];

/*
 * Nucleotides residues
 */
const nucleotidesResidues = ["DA", "DC", "DG", "DT", "A", "C", "G", "U"];

// Gets a random color from ColorNames enum
export function randomColor(): Color {
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
  // This ref corresponds to the representation
  ref: string;
};

export type SphereRef = {
  x: number;
  y: number;
  z: number;
  radius: number;
  color: Color;
  alpha: number;
  // This ref corresponds to the representation
  ref: string;
};

function parsePDB(pdbString: string) {
  const wantedLines = [
    "ATOM",
    "HETATM",
    "ANISOU",
    "TER",
    "ENDMDL",
    "CONNECT",
    "MASTER",
    "END"
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

function createSelectionScript(
  selectionString: string,
  targetLanguage: SelectionLanguage
): Script {
  return Script(selectionString, targetLanguage);
}

// Helper for nested withinDistance selections
function buildExpressionFromSelection(
  script?: string,
  language?: SelectionLanguage
): Expression {
  if (script && language) {
    return Script.toExpression(createSelectionScript(script, language));
  }
  // Otherwise, manually recurse
  // (This can be expanded like the main function)
  return MS.struct.generator.atomGroups({});
}

// Returns a Color instance given the color in Hexstyle (#FF0000)
// or givena  color name 'red'
function getColor(color: string) {
  const isHexColor = (color: string): color is HexColor => {
    return color.startsWith("#");
  };

  if (isHexColor(color)) {
    return Color.fromHexStyle(color);
  }

  return ColorNames[color as ColorName] ?? ColorNames.blue;
}
