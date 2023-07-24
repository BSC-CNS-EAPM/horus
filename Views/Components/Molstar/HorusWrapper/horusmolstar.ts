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
import { PluginState } from "molstar/lib/mol-plugin/state";
import { MolScriptBuilder as MS } from "molstar/lib/mol-script/language/builder";
import {
  StateBuilder,
  StateObject,
  StateSelection,
} from "molstar/lib/mol-state";
import { Asset } from "molstar/lib/mol-util/assets";
import { Color } from "molstar/lib/mol-util/color";
import { ColorNames } from "molstar/lib/mol-util/color/names";
import { getFormattedTime } from "molstar/lib/mol-util/date";
import { download } from "molstar/lib/mol-util/download";
import { RxEventHelper } from "molstar/lib/mol-util/rx-event-helper";
import { EvolutionaryConservation } from "./annotation";
import { createProteopediaCustomTheme } from "./coloring";
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
  StructureProperties,
  to_mmCIF,
} from "molstar/lib/mol-model/structure";
import { Loci } from "molstar/lib/mol-model/structure/structure/element/loci";

// Style
require("molstar/lib/mol-plugin-ui/skin/light.scss");

class HorusMolstar {
  static VERSION_MAJOR = 5;
  static VERSION_MINOR = 5;

  private _ev = RxEventHelper.create();

  readonly events = {
    modelInfo: this._ev<ModelInfo>(),
  };

  plugin: PluginUIContext;

  target: HTMLDivElement;

  async init(target: HTMLDivElement) {
    this.target = target;
    await this.initPlugin();
  }

  private async initPlugin() {
    this.plugin = await createPluginUI(this.target, {
      ...DefaultPluginUISpec(),
      animations: [AnimateModelIndex],
      config: [
        [PluginConfig.Viewport.ShowExpand, false],
        [PluginConfig.Viewport.ShowControls, true],
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

    const renderer = this.plugin.canvas3d!.props.renderer;
    PluginCommands.Canvas3D.SetSettings(this.plugin, {
      settings: {
        renderer: {
          ...renderer,
          backgroundColor: ColorNames.white,
        },
      },
    });

    this.plugin.behaviors.layout.leftPanelTabName.next("data");
  }

  latetstSnapshot: PluginState.Snapshot = void 0;

  // Method to unload the 3D canvas
  unload() {
    // Save the state
    this.latetstSnapshot = this.snapshot.get({
      data: true,
      canvas3d: true,
      camera: true,
    });

    // Remove the plugin
    this.plugin?.dispose();
  }

  async redispose() {
    // Init the plugin
    await this.initPlugin();

    console.log("Redispose snapshot: ", this.latetstSnapshot);

    // Load the state
    this.snapshot.set(this.latetstSnapshot);
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

  setBackground(color: number) {
    if (!this.plugin.canvas3d) return;
    const renderer = this.plugin.canvas3d.props.renderer;
    PluginCommands.Canvas3D.SetSettings(this.plugin, {
      settings: { renderer: { ...renderer, backgroundColor: Color(color) } },
    });
  }

  toggleSpin() {
    if (!this.plugin.canvas3d) return;
    const trackball = this.plugin.canvas3d.props.trackball;
    PluginCommands.Canvas3D.SetSettings(this.plugin, {
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

  snapshot = {
    get: (params?: PluginState.SnapshotParams) => {
      return this.plugin.state.getSnapshot(params);
    },
    set: (snapshot: PluginState.Snapshot) => {
      return this.plugin.state.setSnapshot(snapshot);
    },
    download: async (
      type: "molj" | "molx" = "molj",
      params?: PluginState.SnapshotParams
    ) => {
      const data = await this.plugin.managers.snapshot.serialize({
        type,
        params,
      });
      download(data, `mol-star_state_${getFormattedTime()}.${type}`);
    },
    fetch: async (url: string, type: "molj" | "molx" = "molj") => {
      try {
        const data = await this.plugin.runTask(
          this.plugin.fetch({ url, type: "binary" })
        );
        this.loadedParams = { ...this.emptyLoadedParams };
        return await this.plugin.managers.snapshot.open(
          new File([data], `state.${type}`)
        );
      } catch (e) {
        alert(e);
      }
    },
  };

  async focusFirst(compId: number, options?: { surroundRadius?: number }) {
    // Find the first cell to have a "Structure" property cell.obj.type.name
    const cellsArray = Array.from(this.state.cells.entries());
    let structureKey = null;
    cellsArray.some((cell) => {
      const [key, value] = cell;
      if (value.obj.type.name === "Structure") {
        structureKey = key;
        return true;
      }
    });

    if (structureKey === null) {
      return "No valid structure found.";
    }

    await PluginCommands.Camera.Reset(this.plugin, {});

    const update = this.state.build();

    update.delete(StateElements.Selection);

    const labelID = String(compId);

    const core = MS.struct.filter.first([
      MS.struct.generator.atomGroups({
        "residue-test": MS.core.rel.eq([
          MS.struct.atomProperty.macromolecular.auth_seq_id(),
          compId,
        ]),
        "group-by": MS.core.str.concat([
          MS.struct.atomProperty.core.operatorName(),
          MS.struct.atomProperty.macromolecular.residueKey(),
        ]),
      }),
    ]);

    const group = update
      .to(structureKey)
      .group(
        StateTransforms.Misc.CreateGroup,
        { label: "Focus" },
        { ref: StateElements.Selection }
      );
    const asm = this.state.select(structureKey)[0]
      .obj as PluginStateObject.Molecule.Structure;
    const coreSel = group.apply(
      StateTransforms.Model.StructureSelectionFromExpression,
      { label: "Residue " + labelID, expression: core },
      { ref: StateElements.SelectionGroup }
    );

    coreSel.apply(
      StateTransforms.Representation.StructureRepresentation3D,
      createStructureRepresentationParams(this.plugin, asm.data, {
        type: "ball-and-stick",
      })
    );

    if (options?.surroundRadius) {
      const surroundings = MS.struct.modifier.includeSurroundings({
        0: core,
        radius: options.surroundRadius,
        "as-whole-residues": true,
      });
      group
        .apply(StateTransforms.Model.StructureSelectionFromExpression, {
          label: "Surroundings",
          expression: surroundings,
        })
        .apply(
          StateTransforms.Representation.StructureRepresentation3D,
          createStructureRepresentationParams(this.plugin, asm.data, {
            type: "ball-and-stick",
          })
        );
    }

    await PluginCommands.State.Update(this.plugin, {
      state: this.state,
      tree: update,
    });

    const focus = (
      this.state.select(StateElements.SelectionGroup)[0]
        .obj as PluginStateObject.Molecule.Structure
    ).data;

    if (focus === undefined) {
      return "No residue with id " + labelID + " found";
    }

    const sphere = focus.boundary.sphere;
    const radius = Math.max(sphere.radius, 5);
    const snapshot = this.plugin.canvas3d!.camera.getFocus(
      sphere.center,
      radius
    );
    PluginCommands.Camera.SetSnapshot(this.plugin, {
      snapshot,
      durationMs: 250,
    });
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
          color: proteinColorType,
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
          color: ligandColorType,
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

  private extractFromLoci(loci: Loci) {
    const label = loci.structure.label;
    const id = loci.structure.model.id;
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

    const structureInfo = {
      name: label,
      id: id,
      structure: sourceData,
      type: type,
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

  /*
   * List all the structures in the current hierarchy
   * @returns {Array} - List of structures
   */
  listStructures() {
    const structures =
      this.plugin.managers.structure.hierarchy.current.structures;
    if (!structures) return;

    const molList = [];
    for (const structure of structures) {
      const data = structure.cell.obj.data;
      const loci = this.getLociForStructure(data);
      const molInfo = this.extractFromLoci(loci);
      molList.push(molInfo);
    }

    return molList;
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

      Structure.eachAtomicHierarchyElement(structure, {
        atom: (loc) => {
          const sourceIndex = StructureProperties.atom.sourceIndex(loc);
          const auth_comp_id = StructureProperties.atom.auth_comp_id(loc);
          const auth_atom_id = StructureProperties.atom.auth_atom_id(loc);
          const type = StructureProperties.atom.type_symbol(loc);
          const x = StructureProperties.atom.x(loc);
          const y = StructureProperties.atom.y(loc);
          const z = StructureProperties.atom.z(loc);

          const atomInfo = {
            sourceIndex: sourceIndex,
            auth_comp_id: auth_comp_id,
            auth_atom_id: auth_atom_id,
            type: type,
            x: x,
            y: y,
            z: z,
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
}

export default HorusMolstar;
