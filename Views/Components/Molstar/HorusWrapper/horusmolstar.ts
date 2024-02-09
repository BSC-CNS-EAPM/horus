/**
 * Copyright (c) 2019 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 */

import * as ReactDOM from "react-dom";
import {
  Canvas3DProps,
  DefaultCanvas3DParams,
} from "molstar/lib/mol-canvas3d/canvas3d";
import { AnimateModelIndex } from "molstar/lib/mol-plugin-state/animation/built-in/model-index";
import { createStructureRepresentationParams } from "molstar/lib/mol-plugin-state/helpers/structure-representation-params";
import {
  PluginStateObject,
  PluginStateObject as PSO,
} from "molstar/lib/mol-plugin-state/objects";
import { StateTransforms } from "molstar/lib/mol-plugin-state/transforms";
import { createPluginUI } from "molstar/lib/mol-plugin-ui/react18";
import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";
import { DefaultPluginUISpec } from "molstar/lib/mol-plugin-ui/spec";
import {
  CreateVolumeStreamingInfo,
  InitVolumeStreaming,
} from "molstar/lib/mol-plugin/behavior/dynamic/volume-streaming/transformers";
import { PluginCommands } from "molstar/lib/mol-plugin/commands";
import { MolScriptBuilder as MS } from "molstar/lib/mol-script/language/builder";
import {
  StateBuilder,
  StateObject,
  StateSelection,
} from "molstar/lib/mol-state";
import { Asset } from "molstar/lib/mol-util/assets";
import { Color } from "molstar/lib/mol-util/color";
import { ColorNames } from "molstar/lib/mol-util/color/names";
import { RxEventHelper } from "molstar/lib/mol-util/rx-event-helper";
import { EvolutionaryConservation } from "./annotation";
import { PluginConfig } from "molstar/lib/mol-plugin/config";
import {
  LoadParams,
  ModelInfo,
  RepresentationStyle,
  StateElements,
  SupportedFormats,
} from "./helpers";
import { volumeStreamingControls } from "./ui/controls";
import { Script } from "molstar/lib/mol-script/script";
import { StructureSelection } from "molstar/lib/mol-model/structure/query";
import {
  Structure,
  StructureElement,
  StructureProperties,
  to_mmCIF,
} from "molstar/lib/mol-model/structure";
import { Loci } from "molstar/lib/mol-model/structure/structure/element/loci";
import { addSphereTo } from "./sphere";
import { DockingSphereRepresentationProvider } from "./sphere";

// Import the molviewspec library
import { loadMVS } from "molstar/lib/extensions/mvs/load";
import { MVSData } from "molstar/lib/extensions/mvs/mvs-data";
import { MolViewSpec } from "molstar/lib/extensions/mvs/behavior";
import { ObjectKeys } from "molstar/lib/mol-util/type-helpers";
import { PluginSpec } from "molstar/lib/mol-plugin/spec";
import { StructureRef } from "molstar/lib/mol-plugin-state/manager/structure/hierarchy-state";

class HorusMolstar {
  static VERSION_MAJOR = 5;
  static VERSION_MINOR = 5;

  private _ev = RxEventHelper.create();

  readonly events = {
    modelInfo: this._ev<ModelInfo>(),
  };

  // @ts-ignore
  plugin: PluginUIContext;

  // @ts-ignore
  target: HTMLDivElement;

  async init(target: HTMLDivElement) {
    this.target = target;
    await this.initPlugin();
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
      alert("Failed to load Mol*");
      return;
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
    this.plugin.behaviors.layout.leftPanelTabName.next("data");

    // Add the coordinates event listener
    this.coordinatesListener();
  }

  private coordinatesListener() {
    this.plugin.behaviors.interaction.click.subscribe((e) => {
      if (e.position != undefined) {
        const x = e.position[0].toFixed(1);
        const y = e.position[1].toFixed(1);
        const z = e.position[2].toFixed(1);

        const detail = {
          x: Number(x),
          y: Number(y),
          z: Number(z),
        };

        if (StructureElement.Loci.is(e.current.loci)) {
          const loc = StructureElement.Location.create();
          StructureElement.Loci.getFirstLocation(e.current.loci, loc);
          // auth_seq_id  : UniProt coordinate space
          // label_seq_id : PDB coordinate space
          const resID = StructureProperties.residue.label_seq_id(loc);
          const sourceIndex = StructureProperties.atom.sourceIndex(loc);
          const auth_comp_id = StructureProperties.atom.auth_comp_id(loc);
          const auth_atom_id = StructureProperties.atom.auth_atom_id(loc);
          const chainID = StructureProperties.chain.label_asym_id(loc);
          const type = StructureProperties.atom.type_symbol(loc);
          const x = StructureProperties.atom.x(loc);
          const y = StructureProperties.atom.y(loc);
          const z = StructureProperties.atom.z(loc);

          let molInfo = this.extractFromLoci(e.current.loci);

          molInfo = {
            ...molInfo,
            structure: molInfo.name,
          };

          const atomInfo = {
            name: `${auth_comp_id}:${resID} - ${molInfo.name}`,
            residue: resID,
            chainID: chainID,
            atom_index: sourceIndex,
            auth_comp_id: auth_comp_id,
            auth_atom_id: auth_atom_id,
            type: type,
            x: x,
            y: y,
            z: z,
            structure_label: molInfo.name,
            structure: molInfo,
          };
          detail["atom"] = atomInfo;
        }

        // Send the values through a custom event "molstar-coordinates"
        const event = new CustomEvent("molstar-coordinates", {
          detail: detail,
        });

        window.dispatchEvent(event);
      }
      e = undefined;
    });
  }

  latestSnapshot: any;

  // Reset molstar to a new state
  async reset() {
    await this.initPlugin();
  }

  // Method to unload the 3D canvas
  async unload() {
    // Save the state
    this.latestSnapshot = await this.snapshot.get();

    // Remove the plugin
    this.plugin?.dispose();
  }

  async redispose() {
    // Init the plugin
    await this.initPlugin();

    // Load the state
    this.snapshot.set(this.latestSnapshot);
  }

  get state() {
    return this.plugin.state.data;
  }

  private download(
    b: StateBuilder.To<PSO.Root>,
    url: string,
    isBinary: boolean
  ) {
    return b.apply(StateTransforms.Data.Download, {
      url: Asset.Url(url),
      isBinary,
    });
  }

  private model(
    b: StateBuilder.To<PSO.Data.Binary | PSO.Data.String>,
    format: SupportedFormats
  ) {
    const parsed =
      format === "cif"
        ? b
            .apply(StateTransforms.Data.ParseCif)
            .apply(StateTransforms.Model.TrajectoryFromMmCif)
        : b.apply(StateTransforms.Model.TrajectoryFromPDB);

    return parsed.apply(
      StateTransforms.Model.ModelFromTrajectory,
      { modelIndex: 0 },
      { ref: StateElements.Model }
    );
  }

  private structure(assemblyId: string) {
    const model = this.state.build().to(StateElements.Model);
    const props = {
      type: assemblyId
        ? {
            name: "assembly" as const,
            params: { id: assemblyId },
          }
        : {
            name: "model" as const,
            params: {},
          },
    };

    const s = model.apply(StateTransforms.Model.StructureFromModel, props, {
      ref: StateElements.Assembly,
    });

    s.apply(
      StateTransforms.Model.StructureComplexElement,
      { type: "atomic-sequence" },
      { ref: StateElements.Sequence }
    );
    s.apply(
      StateTransforms.Model.StructureComplexElement,
      { type: "atomic-het" },
      { ref: StateElements.Het }
    );
    s.apply(
      StateTransforms.Model.StructureComplexElement,
      { type: "water" },
      { ref: StateElements.Water }
    );

    return s;
  }

  private visual(_style?: RepresentationStyle, partial?: boolean) {
    const structure = this.getObj<PluginStateObject.Molecule.Structure>(
      StateElements.Assembly
    );
    if (!structure) return;

    const style = _style || {};

    const update = this.state.build();

    if (!partial || (partial && style.sequence)) {
      const root = update.to(StateElements.Sequence);
      if (style.sequence && style.sequence.hide) {
        root.delete(StateElements.SequenceVisual);
      } else {
        root.applyOrUpdate(
          StateElements.SequenceVisual,
          StateTransforms.Representation.StructureRepresentation3D,
          createStructureRepresentationParams(this.plugin, structure, {
            type: (style.sequence && style.sequence.kind) || "cartoon",
            color: (style.sequence && style.sequence.coloring) || "unit-index",
          })
        );
      }
    }

    if (!partial || (partial && style.hetGroups)) {
      const root = update.to(StateElements.Het);
      if (style.hetGroups && style.hetGroups.hide) {
        root.delete(StateElements.HetVisual);
      } else {
        if (style.hetGroups && style.hetGroups.hide) {
          root.delete(StateElements.HetVisual);
        } else {
          root.applyOrUpdate(
            StateElements.HetVisual,
            StateTransforms.Representation.StructureRepresentation3D,
            createStructureRepresentationParams(this.plugin, structure, {
              type:
                (style.hetGroups && style.hetGroups.kind) || "ball-and-stick",
              // color: style.hetGroups && style.hetGroups.coloring,
            })
          );
        }
      }
    }

    if (!partial || (partial && style.snfg3d)) {
      const root = update.to(StateElements.Het);
      if (style.hetGroups && style.hetGroups.hide) {
        root.delete(StateElements.HetVisual);
      } else {
        if (style.snfg3d && style.snfg3d.hide) {
          root.delete(StateElements.Het3DSNFG);
        } else {
          root.applyOrUpdate(
            StateElements.Het3DSNFG,
            StateTransforms.Representation.StructureRepresentation3D,
            createStructureRepresentationParams(this.plugin, structure, {
              type: "carbohydrate",
            })
          );
        }
      }
    }

    if (!partial || (partial && style.water)) {
      const root = update.to(StateElements.Water);
      if (style.water && style.water.hide) {
        root.delete(StateElements.WaterVisual);
      } else {
        root.applyOrUpdate(
          StateElements.WaterVisual,
          StateTransforms.Representation.StructureRepresentation3D,
          createStructureRepresentationParams(this.plugin, structure, {
            type: (style.water && style.water.kind) || "ball-and-stick",
            typeParams: { alpha: 0.51 },
            // color: style.water && style.water.coloring
          })
        );
      }
    }

    return update;
  }

  private getObj<T extends StateObject>(ref: string): T["data"] {
    const state = this.state;
    const cell = state.select(ref)[0];
    if (!cell || !cell.obj) return void 0;
    return (cell.obj as T).data;
  }

  private async doInfo(checkPreferredAssembly: boolean) {
    const model = this.getObj<PluginStateObject.Molecule.Model>("model");
    if (!model) return;

    const info = await ModelInfo.get(
      this.plugin,
      model,
      checkPreferredAssembly
    );
    this.events.modelInfo.next(info);
    return info;
  }

  private applyState(tree: StateBuilder) {
    return PluginCommands.State.Update(this.plugin, {
      state: this.plugin.state.data,
      tree,
    });
  }

  private emptyLoadedParams: LoadParams = {
    url: "",
    format: "cif",
    isBinary: false,
    assemblyId: "",
  };
  private loadedParams: LoadParams = {
    url: "",
    format: "cif",
    isBinary: false,
    assemblyId: "",
  };
  async load({
    url,
    format = "cif",
    assemblyId = "",
    isBinary = false,
    representationStyle,
  }: LoadParams) {
    let loadType: "full" | "update" = "full";

    const state = this.plugin.state.data;

    if (this.loadedParams.url !== url || this.loadedParams.format !== format) {
      loadType = "full";
    } else if (this.loadedParams.url === url) {
      if (state.select(StateElements.Assembly).length > 0) loadType = "update";
    }

    if (loadType === "full") {
      await PluginCommands.State.RemoveObject(this.plugin, {
        state,
        ref: state.tree.root.ref,
      });
      const modelTree = this.model(
        this.download(state.build().toRoot(), url, isBinary),
        format
      );
      await this.applyState(modelTree);
      const info = await this.doInfo(true);
      const asmId =
        (assemblyId === "preferred" && info && info.preferredAssemblyId) ||
        assemblyId;
      const structureTree = this.structure(asmId);
      await this.applyState(structureTree);
    } else {
      const tree = state.build();
      const info = await this.doInfo(true);
      const asmId =
        (assemblyId === "preferred" && info && info.preferredAssemblyId) ||
        assemblyId;
      const props = {
        type: assemblyId
          ? {
              name: "assembly" as const,
              params: { id: asmId },
            }
          : {
              name: "model" as const,
              params: {},
            },
      };
      tree
        .to(StateElements.Assembly)
        .update(StateTransforms.Model.StructureFromModel, (p) => ({
          ...p,
          ...props,
        }));
      await this.applyState(tree);
    }

    await this.updateStyle(representationStyle);

    this.loadedParams = { url, format, assemblyId };
  }

  async updateStyle(style?: RepresentationStyle, partial?: boolean) {
    const tree = this.visual(style, partial);
    if (!tree) return;
    await PluginCommands.State.Update(this.plugin, {
      state: this.plugin.state.data,
      tree,
    });
  }

  async setBackground(color: number) {
    if (!this.plugin.canvas3d) return;
    const renderer = this.plugin.canvas3d.props.renderer;
    await PluginCommands.Canvas3D.SetSettings(this.plugin, {
      settings: { renderer: { ...renderer, backgroundColor: Color(color) } },
    });
  }

  async toggleSpin() {
    if (!this.plugin.canvas3d) return;
    const trackball = this.plugin.canvas3d.props.trackball;
    await PluginCommands.Canvas3D.SetSettings(this.plugin, {
      settings: {
        trackball: {
          ...trackball,
          animate:
            trackball.animate.name === "spin"
              ? { name: "off", params: {} }
              : { name: "spin", params: { speed: 1 } },
        },
      },
    });
  }

  viewport = {
    setSettings: (settings?: Canvas3DProps) => {
      PluginCommands.Canvas3D.SetSettings(this.plugin, {
        settings: settings || DefaultCanvas3DParams,
      });
    },
  };

  camera = {
    toggleSpin: () => this.toggleSpin(),
    resetPosition: () => PluginCommands.Camera.Reset(this.plugin, {}),
  };

  private animateModelIndexTargetFps() {
    return Math.max(1, this.animate.modelIndex.targetFps | 0);
  }

  animate = {
    modelIndex: {
      targetFps: 8,
      onceForward: () => {
        this.plugin.managers.animation.play(AnimateModelIndex, {
          duration: {
            name: "computed",
            params: { targetFps: this.animateModelIndexTargetFps() },
          },
          mode: { name: "once", params: { direction: "forward" } },
        });
      },
      onceBackward: () => {
        this.plugin.managers.animation.play(AnimateModelIndex, {
          duration: {
            name: "computed",
            params: { targetFps: this.animateModelIndexTargetFps() },
          },
          mode: { name: "once", params: { direction: "backward" } },
        });
      },
      palindrome: () => {
        this.plugin.managers.animation.play(AnimateModelIndex, {
          duration: {
            name: "computed",
            params: { targetFps: this.animateModelIndexTargetFps() },
          },
          mode: { name: "palindrome", params: {} },
        });
      },
      loop: () => {
        this.plugin.managers.animation.play(AnimateModelIndex, {
          duration: {
            name: "computed",
            params: { targetFps: this.animateModelIndexTargetFps() },
          },
          mode: { name: "loop", params: { direction: "forward" } },
        });
      },
      stop: () => this.plugin.managers.animation.stop(),
    },
  };

  coloring = {
    evolutionaryConservation: async (params?: {
      sequence?: boolean;
      het?: boolean;
      keepStyle?: boolean;
    }) => {
      if (!params || !params.keepStyle) {
        await this.updateStyle({ sequence: { kind: "spacefill" } }, true);
      }

      const state = this.state;
      const tree = state.build();
      const colorTheme = {
        name: EvolutionaryConservation.propertyProvider.descriptor.name,
        params:
          this.plugin.representation.structure.themes.colorThemeRegistry.get(
            EvolutionaryConservation.propertyProvider.descriptor.name
          ).defaultValues,
      };

      if (!params || !!params.sequence) {
        tree
          .to(StateElements.SequenceVisual)
          .update(
            StateTransforms.Representation.StructureRepresentation3D,
            (old) => ({ ...old, colorTheme })
          );
      }
      if (params && !!params.het) {
        tree
          .to(StateElements.HetVisual)
          .update(
            StateTransforms.Representation.StructureRepresentation3D,
            (old) => ({ ...old, colorTheme })
          );
      }

      await PluginCommands.State.Update(this.plugin, { state, tree });
    },
  };

  private experimentalDataElement?: Element = void 0;
  experimentalData = {
    init: async (parent: Element) => {
      const asm = this.state.select(StateElements.Assembly)[0].obj!;
      const params = InitVolumeStreaming.createDefaultParams(asm, this.plugin);
      params.options.behaviorRef = StateElements.VolumeStreaming;
      params.defaultView = "box";
      params.options.channelParams["fo-fc(+ve)"] = { wireframe: true };
      params.options.channelParams["fo-fc(-ve)"] = { wireframe: true };
      await this.plugin.runTask(
        this.state.applyAction(
          InitVolumeStreaming,
          params,
          StateElements.Assembly
        )
      );
      this.experimentalDataElement = parent;
      volumeStreamingControls(this.plugin, parent);
    },
    remove: () => {
      const r = this.state.select(
        StateSelection.Generators.ofTransformer(CreateVolumeStreamingInfo)
      )[0];
      if (!r) return;
      PluginCommands.State.RemoveObject(this.plugin, {
        state: this.state,
        ref: r.transform.ref,
      });
      if (this.experimentalDataElement) {
        ReactDOM.unmountComponentAtNode(this.experimentalDataElement);
        this.experimentalDataElement = void 0;
      }
    },
  };

  private async getSession(): Promise<Blob> {
    // Erase previous session snapshots
    this.plugin.managers.snapshot.clear();

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

    // The molx format is basically a zip file
    // but for storing the molstar state in the flow, we need to convert it to a string
    // Therefore we will read the bytes of the zip file and convert it to a hex string
    // const textSession = await blobToHex(molxSession);

    return molxSession;
  }

  private async legacySession(session) {
    // If the session object is empty, return
    if (Object.keys(session).length === 0) {
      return;
    }

    const assets = session["assets.json"];
    const assetData = Object.create(null);

    for (const [k, v] of Object.entries(session)) {
      if (k === "session" || k === "assets.json") continue;
      const name = k.substring(k.indexOf("/") + 1);
      assetData[name] = v;
    }

    if (assets) {
      for (const [id, asset] of assets) {
        this.plugin.managers.asset.set(
          asset,
          new File([assetData[id]], asset.name)
        );
      }
    }

    const snapshot = session.session;
    await this.plugin.managers.snapshot.setStateSnapshot(snapshot);
  }

  private async loadSession(session) {
    // If the session is an object instead of a string, load it as a legacy session
    if (typeof session !== "string") {
      this.legacySession(session);
      return;
    }

    // Convert the session string to a binary zip file
    // Create a new file
    const blob = hexToBlob(session);

    const file = new File([blob], "session.molx", {
      type: "application/zip",
    });

    // Load the session
    await PluginCommands.State.Snapshots.OpenFile(this.plugin, { file: file });
  }

  snapshot = {
    get: async () => {
      return await this.getSession();
    },
    set: async (snapshot: string) => {
      await this.loadSession(snapshot);
    },
  };

  getStructureKeyFromLabel(structureLabel: string): string {
    const structures = this.listStructures();
    let structureKey = null;
    structures.some((structure) => {
      if (structure.name === structureLabel) {
        structureKey = structure.id;
        return true;
      }
    });

    return structureKey;
  }

  // Find the first cell to have a "Structure" property cell.obj.type.name
  findFirstCellKeyWithStructureProp(parentKey: string): string | null {
    // From all the cells of the state, get the ones that have a "Structure" property
    const cellsArray = Array.from(this.state.cells.entries());
    let structureKey: null | string = null;
    cellsArray.some((cell) => {
      const [key, value] = cell;
      if (value.obj.type.name === "Structure") {
        if (value.sourceRef !== parentKey) {
          return false;
        } else {
          structureKey = key;
          return true;
        }
      }
    });

    return structureKey;
  }

  getStructureObjectFromLabel(structureLabel: string): StructureRef {
    const structureKey = this.getStructureKeyFromLabel(structureLabel);
    const structure = this.structures().filter(
      (structure) => structure.cell.sourceRef === structureKey
    )[0];

    return structure;
  }

  async focus(
    structureLabel?: string,
    residueNumber?: number,
    chain?: string,
    surroundRadius: number = 0
  ) {
    let message = "";

    // If no structure label is specified, focus the first structure
    const structures = this.listStructures();
    if (!structureLabel) {
      if (structures.length === 0) {
        return "No structures loaded";
      }
      structureLabel = structures[0].name;
      message = "No structure specified, focusing " + structureLabel + ".";
    } else {
      // Verify that the structure exists
      const structureKey = this.getStructureKeyFromLabel(structureLabel);
      if (structureKey === null) {
        message = "No structure with label " + structureLabel + " found.";
        const structureList = structures.map((structure) => structure.name);
        message += " Available structures: " + structureList.join(", ");
        return message;
      }
    }

    // Get the structure object from the structure label
    const structureObject = this.getStructureObjectFromLabel(structureLabel);

    // If no residue number is specified, just focus the structure
    if (!residueNumber) {
      message += " No residue specified, focusing whole structure";
      const sphere = structureObject.cell.obj.data.boundary.sphere;
      const radius = Math.max(sphere.radius, 5);
      const snapshot = this.plugin.canvas3d!.camera.getFocus(
        sphere.center,
        radius
      );
      PluginCommands.Camera.SetSnapshot(this.plugin, {
        snapshot,
        durationMs: 250,
      });
    } else {
      // Focus the residue
      // If no chain was provided, use the first chain of the provided structure
      const chains = this.listChains(structureLabel);
      if (!chain) {
        if (chains.length === 0) {
          message += " No chains found in " + structureLabel;
          return message;
        }

        chain = chains[0].chainID;
        message += " Chain not specified, using '" + chain + "'.";
      } else {
        // Check if the chain exists
        if (!chains.some((c) => c.chainID === chain)) {
          message += " Chain " + chain + " not found in " + structureLabel;
          message +=
            " Available chains: " +
            chains.map((chain) => `'${chain.chainID}'`).join(", ");
          return message;
        }
      }

      message += await this.focusSpecificResidue(
        residueNumber,
        structureObject,
        chain,
        surroundRadius
      );
    }

    return message;
  }

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
    const filterGroups = {
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
    const modelKey = this.findFirstCellKeyWithStructureProp(
      structureObject.cell.sourceRef
    );

    if (!modelKey) {
      return " Internal error: No suitable model found";
    }

    const model = this.state.select(modelKey)[0]
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
      createStructureRepresentationParams(this.plugin, model.data, {
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
          createStructureRepresentationParams(this.plugin, model.data, {
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
      await PluginCommands.State.Update(this.plugin, {
        state: this.state,
        tree: update,
      });

      // Get the bounding sphere of the selection, this will be useful to center the camera
      boundingSphere = (
        this.state.select(StateElements.SelectionGroup)[0]
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
      await PluginCommands.State.Update(this.plugin, {
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
    const snapshot = this.plugin.canvas3d!.camera.getFocus(
      boundingSphere.center,
      radius
    );

    // Finally, we will animate the camera to the new position
    PluginCommands.Camera.SetSnapshot(this.plugin, {
      snapshot,
      durationMs: 250,
    });

    return message;
  }

  // Loaded PDBfiles in the form of a string
  loadedPDBs: { [key: string]: string } = {};

  async loadPDBString(pdbString, label) {
    // Parse the data from the string
    pdbString = this.parsePDB(pdbString);
    // Load the parsed data
    const data = await this.plugin.builders.data.rawData({
      data: pdbString,
      label: label,
    });
    const trajectory = await this.plugin.builders.structure.parseTrajectory(
      data,
      "pdb"
    );
    const model = await this.plugin.builders.structure.createModel(trajectory);
    const structure = await this.plugin.builders.structure.createStructure(
      model
    );

    const structureObject = {
      structure: structure,
      label: label,
    };

    const components = {
      polymer: await this.plugin.builders.structure.tryCreateComponentStatic(
        structure,
        "polymer"
      ),
      ligand: await this.plugin.builders.structure.tryCreateComponentStatic(
        structure,
        "ligand"
      ),
      water: await this.plugin.builders.structure.tryCreateComponentStatic(
        structure,
        "water"
      ),
    };

    var proteinColorType = "polymer-id";
    var ligandColorType = "element-symbol";

    const builder = this.plugin.builders.structure.representation;
    const update = this.plugin.build();
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

    // If the label exists, add a number to the end of it
    if (label in this.loadedPDBs) {
      let i = 1;
      while (label + i in this.loadedPDBs) {
        i++;
      }
      label = label + i;
    }

    // Add the structure to the state
    const newStructure = {
      pdbString: pdbString,
      name: label,
    };

    // Add the structure to the state
    this.loadedPDBs[label] = pdbString;
  }

  private structureToCIF(loci: Loci) {
    const name = loci.structure.label;
    const structure = loci.structure;
    return to_mmCIF(name, structure);
  }

  private extractFromLoci(loci: Loci): MolInfo {
    // Define the default label
    // This is the label that apears on top of the state tree,
    // which the one that the user can modify
    let label = "Unknown";
    try {
      label = loci.structure.units[0].model.sourceData.name;
    } catch {
      label = loci.structure.model.label;
    }

    // Internal label
    // This label is inherent of the structure data that was
    // used to load the molecule on Mol*
    const internalLabel = loci.structure.model.label;

    let sourceData;
    let type;
    try {
      sourceData =
        loci.structure.model.sourceData.data["source"].data.lines.data;
      type = "pdb";
    } catch (error) {
      sourceData = this.structureToCIF(loci);
      type = "cif";
    }

    const structureInfo: MolInfo = {
      name: label,
      internalLabel: internalLabel,
      structure: sourceData,
      type: type,
      id: loci.structure.model.id,
    };

    return structureInfo;
  }

  private getLociForStructure(structure: Structure) {
    const selection = Script.getStructureSelection(
      (Q) =>
        Q.struct.generator.atomGroups({
          "chain-test": Q.core.rel.eq(["B", Q.ammp("label_asym_id")]),
        }),
      structure
    );

    const loci = StructureSelection.toLociWithSourceUnits(selection);

    return loci;
  }

  private structures() {
    return this.plugin.managers.structure.hierarchy.current.structures;
  }

  /*
   * List all the structures in the current hierarchy
   * @returns {Array} - List of structures
   */
  listStructures(): MolInfo[] {
    const structures = this.structures();
    if (!structures) return;

    const molList = [];
    for (const structure of structures) {
      const data = structure.cell.obj.data;
      const loci = this.getLociForStructure(data);
      const molInfo = this.extractFromLoci(loci);
      molInfo["id"] = structure.cell.sourceRef;
      molList.push(molInfo);
      console.log(molInfo);
    }

    return molList;
  }

  private getResiduesFromStructure(
    structure: Structure,
    get?: "all" | "hetero" | "standard" | "chain",
    unique: boolean = true
  ): AtomInfo[] {
    const loci = this.getLociForStructure(structure);
    let molInfo = this.extractFromLoci(loci);

    molInfo = {
      ...molInfo,
      structure: molInfo.name,
    };

    const resInfo = [];
    Structure.eachAtomicHierarchyElement(structure, {
      atom: (loc) => {
        // auth_comp_id is the 3 letter code for the residue like "ALA", "GLY", etc.
        let auth_comp_id = StructureProperties.atom.auth_comp_id(loc);

        if (get === "hetero" && standardResidues.includes(auth_comp_id)) return;
        else if (get === "standard" && !standardResidues.includes(auth_comp_id))
          return;

        // resID is the residue number (1, 2, 3, etc.)
        const resID = StructureProperties.residue.label_seq_id(loc);

        // Source index is the index of the atom in the structure
        const sourceIndex = StructureProperties.atom.sourceIndex(loc);
        const auth_atom_id = StructureProperties.atom.auth_atom_id(loc);
        const chainID = StructureProperties.chain.label_asym_id(loc);
        const type = StructureProperties.atom.type_symbol(loc);
        const x = StructureProperties.atom.x(loc);
        const y = StructureProperties.atom.y(loc);
        const z = StructureProperties.atom.z(loc);

        // If the molInfo.ID and the current auth_comp_id are already in the
        // heteroInfo array, then don't add it again
        if (unique) {
          for (const info of resInfo) {
            if (
              info.structure.id === molInfo.id &&
              info.auth_comp_id === auth_comp_id
            ) {
              return;
            }
          }
        }

        // For standard residues, we need to add the residue one time per atom
        if (get == "standard") {
          for (const info of resInfo) {
            if (info.residue === resID) {
              return;
            }
          }
        }

        if (get == "chain") {
          for (const info of resInfo) {
            if (info.chainID === chainID) {
              return;
            }
          }
        }

        // If auth_comp_id has 2 characters instead of 3, then add a space
        // before it
        if (auth_comp_id.length === 2) {
          auth_comp_id = " " + auth_comp_id;
        }

        const atomInfo: AtomInfo = {
          name: `${auth_comp_id}:${resID} - ${molInfo.name}`,
          residue: resID,
          chainID: chainID,
          atom_index: sourceIndex,
          auth_comp_id: auth_comp_id,
          auth_atom_id: auth_atom_id,
          type: type,
          x: x,
          y: y,
          z: z,
          structure_label: molInfo.name,
          structure: molInfo,
        };

        resInfo.push(atomInfo);
      },
    });

    return resInfo;
  }

  /*
   * List the hetero residues in the current loaded structures
   * @returns {Array} - List of hetero residues
   */
  listHeteroRes() {
    const structures = this.structures();

    if (!structures) return;

    const heteroList = [];
    for (const structure of structures) {
      const data = structure.cell.obj.data;
      const residues = this.getResiduesFromStructure(data, "hetero");
      heteroList.push(...residues);
    }

    return heteroList;
  }

  /*
   * List the standard residues in the current loaded structures
   * @returns {Array} - List of standard residues
   */
  listStdRes() {
    const structures = this.structures();

    if (!structures) return;

    const stdList = [];
    for (const structure of structures) {
      const data = structure.cell.obj.data;
      const residues = this.getResiduesFromStructure(data, "standard", false);
      stdList.push(...residues);
    }

    return stdList;
  }

  /*
   * List the chains in the current loaded structures
   * @returns {Array} - List of chains
   */
  listChains(structureLabel?: string): AtomInfo[] {
    let structures = [];
    if (structureLabel) {
      structures.push(this.getStructureObjectFromLabel(structureLabel));
    } else {
      structures = this.structures();
    }

    const chainList: AtomInfo[] = [];
    for (const structure of structures) {
      if (!structure) continue;

      const data = structure.cell.obj.data;
      const chains = this.getResiduesFromStructure(data, "chain");
      chainList.push(...chains);
    }

    return chainList;
  }

  /*
   * Get the structures selected
   * @returns {Array} - List of structures
   */
  getSelectedStructures() {
    const selections = Array.from(
      this.plugin.managers.structure.selection.entries.values()
    );
    const selectionList = [];
    for (const { structure } of selections) {
      if (!structure) continue;

      const loci = this.getLociForStructure(structure);
      let molInfo = this.extractFromLoci(loci);

      molInfo = {
        ...molInfo,
        structure: null,
      };

      Structure.eachAtomicHierarchyElement(structure, {
        atom: (loc) => {
          const resID = StructureProperties.residue.label_seq_id(loc);
          const sourceIndex = StructureProperties.atom.sourceIndex(loc);
          const auth_comp_id = StructureProperties.atom.auth_comp_id(loc);
          const auth_atom_id = StructureProperties.atom.auth_atom_id(loc);
          const chainID = StructureProperties.chain.label_asym_id(loc);
          const type = StructureProperties.atom.type_symbol(loc);
          const x = StructureProperties.atom.x(loc);
          const y = StructureProperties.atom.y(loc);
          const z = StructureProperties.atom.z(loc);

          const atomInfo = {
            name: `${auth_comp_id}:${resID} - ${molInfo.name}`,
            residue: resID,
            chainID: chainID,
            atom_index: sourceIndex,
            auth_comp_id: auth_comp_id,
            auth_atom_id: auth_atom_id,
            type: type,
            x: x,
            y: y,
            z: z,
            structure_label: molInfo.name,
            structure: molInfo,
          };

          selectionList.push(atomInfo);
        },
      });
    }

    return selectionList;
  }

  private parsePDB(pdbString) {
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

  private async createEmptyNode(nodeName: string) {
    const fakeData = {
      data: "HETATM 1  H   H   A   1       0.000   0.000   0.000  1.00  0.00           H",
      label: nodeName,
    };

    // We will create an empty node
    const data = await this.plugin.builders.data.rawData(fakeData);

    const trajectory = await this.plugin.builders.structure.parseTrajectory(
      data,
      "pdb"
    );

    const model = await this.plugin.builders.structure.createModel(trajectory);

    const structure = await this.plugin.builders.structure.createStructure(
      model
    );

    return structure;
  }

  /*
   * Add a sphere to the current structure
   * @returns {String} - The ref of the sphere
   */
  async addSphere(
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
    if (deletePrevious) {
      // Remove the previous sphere
      const builder = this.plugin.state.data.build();
      builder.delete(deletePrevious.ref);
      builder.commit();
    }

    let structureFirst = this.structures()[0];
    let structure: any = null;
    if (!structureFirst) {
      structure = await this.createEmptyNode("Sphere");
    } else {
      const structureRef = structureFirst.cell.transform.ref;
      structure = this.plugin.state.data.cells.get(structureRef);
    }

    if (!structure) {
      alert(
        "Failed to get a valid structure from Mol*. Could not add the sphere"
      );
    }

    const colorToUse = deletePrevious?.color || color || randomColor();

    let sphere: SphereRef = {
      x: position.x,
      y: position.y,
      z: position.z,
      radius: radius,
      color: colorToUse,
      alpha: opacity || 0.3,
      ref: "",
    };

    const sphereRef = await addSphereTo(this.plugin, structure, sphere);

    sphere.ref = sphereRef;

    return sphere;
  }

  async removeSphere(ref: string) {
    const builder = this.plugin.state.data.build();
    builder.delete(ref);
    builder.commit();
  }

  // Create a new internal variable to store added representations
  private addedReprs: Array<any> = [];

  /*
   * Adds representations to already present structures, if null, adds to all structures
   * @param {Structure} structure - The structure to add the representation to
   * @param {String} representation - The representation to apply:
   *  - "cartoon"
   * - "ball-and-stick"
   */
  async addStructureRepresentation(
    structure: StructureRef | null,
    representation: "cartoon" | "ball-and-stick"
  ) {
    let structures: StructureRef[] | null = null;
    if (!structure) {
      // Get the structures
      structures = this.structures();
    } else {
      structures = [structure];
    }

    if (!structures) return;

    // Get the builder
    const builder = this.plugin.builders.structure.representation;
    const update = this.plugin.build();

    const reprTag = `internal-representation`;

    const snapshot = await this.plugin.canvas3d.camera.getSnapshot();

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
    this.plugin.canvas3d.requestCameraReset({ snapshot, durationMs: 0 });
  }

  /*
   * Removes representations from already present structures, if null, removes from all structures
   * @param {Structure} structure - The structure to remove the representation from
   */
  async deleteStructureRepresentations() {
    const builder = await this.plugin.state.data.build();

    // Loop over the added reps
    for (const repr of this.addedReprs) {
      // Delete the representation if the structure has "-internal-representation"
      builder.delete(repr);
    }
    await builder.commit();
  }

  actionsQueue = [];
  async applyAction(action: any) {
    const { type, data } = action;

    // Assing an ID to the action
    action.id = Math.random().toString(36);

    this.actionsQueue.push(action);

    // Wait till the action is the first in the queue
    while (this.actionsQueue[0].id !== action.id) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    try {
      switch (type) {
        case "addPDB":
          const label = data.label ? data.label : "PDB";
          const pdb = data.pdb;

          // If the PDB data is empty, throw an error
          if (!pdb || pdb === "") {
            throw "The PDB data is empty";
          }

          await this.loadPDBString(pdb, label);
          break;
        case "loadMVJS":
          const session = data.session;
          const replaceExisting = data.replaceExisting;
          await this.loadMolViewSpecSession(session, replaceExisting);
          break;
        case "focus":
          const residue = data.residue;
          const structureLabel = data.structureLabel;
          const chain = data.chain;
          const nearRadius = data.nearRadius;
          await this.focus(structureLabel, residue, chain, nearRadius);
          break;
        case "addSphere":
          const position = data.position;
          const radius = data.radius;
          const opacity = data.opacity;

          let sphereColor = data.color;
          if (!sphereColor) {
            sphereColor = "#ff0000";
          }
          // Convert the hex string color to a Color object
          const parsedSphereColor = Color(Color.fromHexStyle(sphereColor));

          await this.addSphere(position, radius, opacity, parsedSphereColor);
          break;
        case "setBackgroundColor":
          const color = data.color;

          // Convert the hex string color to a Color object
          const parsedColor = Color(Color.fromHexStyle(color));

          await this.setBackground(parsedColor);
          break;
        case "toggleSpin":
          await this.toggleSpin();
          break;
        case "reset":
          await this.reset();
          break;
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

  async loadMolViewSpecSession(
    session: string,
    replaceExisting: boolean = false
  ) {
    const parsedData = MVSData.fromMVSJ(session);

    // Loads the session
    await loadMVS(this.plugin, parsedData, {
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
const randomColor = () => {
  const colors = Object.values(ColorNames);
  const randomIndex = Math.floor(Math.random() * colors.length);
  return colors[randomIndex];
};

type SphereRef = {
  x: number;
  y: number;
  z: number;
  radius: number;
  color: Color;
  alpha: number;
  ref: string;
};

export default HorusMolstar;

export { SphereRef };

async function blobToHex(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      if (reader.readyState === FileReader.DONE) {
        const arrayBuffer = reader.result;
        const byteArray = new Uint8Array(arrayBuffer as ArrayBuffer);

        // Convert byteArray to hex string
        const hexArray = Array.from(byteArray, (byte) =>
          byte.toString(16).padStart(2, "0")
        );
        const hexString = hexArray.join("");

        resolve(hexString);
      }
    };

    reader.onerror = reject;

    // Read the Blob as an ArrayBuffer
    reader.readAsArrayBuffer(blob);
  });
}

function hexToBlob(hexString) {
  const bytePairs = hexString.match(/.{1,2}/g) || [];
  const byteArray = bytePairs.map((byte) => parseInt(byte, 16));

  return new Blob([new Uint8Array(byteArray)]);
}

export type MolInfo = {
  id: string;
  name: string;
  internalLabel: string;
  structure: string;
  type: string;
};

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
  structure_label: string;
  structure: MolInfo;
};
