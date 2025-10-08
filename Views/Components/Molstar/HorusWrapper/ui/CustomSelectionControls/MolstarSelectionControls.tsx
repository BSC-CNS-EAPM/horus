/**
 * Copyright (c) 2019-2024 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @author David Sehnal <david.sehnal@gmail.com>
 * @author Jason Pattle <jpattle.exscientia.co.uk>
 * @author Ludovic Autin <ludovic.autin@gmail.com>
 * @author Ventura Rivera <venturaxrivera@gmail.com>
 */

import * as React from "react";
import { Structure } from "molstar/lib/mol-model/structure/structure/structure";
import {
  StructureElement,
  StructureProperties
} from "molstar/lib/mol-model/structure";
import {
  getElementQueries,
  getNonStandardResidueQueries,
  getPolymerAndBranchedEntityQueries,
  StructureSelectionQueries,
  StructureSelectionQuery
} from "molstar/lib/mol-plugin-state/helpers/structure-selection-query";
import { InteractivityManager } from "molstar/lib/mol-plugin-state/manager/interactivity";
import { StructureComponentManager } from "molstar/lib/mol-plugin-state/manager/structure/component";
import {
  StructureComponentRef,
  StructureRef
} from "molstar/lib/mol-plugin-state/manager/structure/hierarchy-state";
import {
  StructureSelectionModifier,
  StructureSelectionHistoryEntry
} from "molstar/lib/mol-plugin-state/manager/structure/selection";
import { PluginConfig } from "molstar/lib/mol-plugin/config";
import { PluginContext } from "molstar/lib/mol-plugin/context";
import { compileIdListSelection } from "molstar/lib/mol-script/util/id-list";
import { memoizeLatest } from "molstar/lib/mol-util/memoize";
import { ParamDefinition } from "molstar/lib/mol-util/param-definition";
import { capitalize } from "molstar/lib/mol-util/string";
import {
  PluginUIComponent,
  PurePluginUIComponent
} from "molstar/lib/mol-plugin-ui/base";
import { ActionMenu } from "molstar/lib/mol-plugin-ui/controls/action-menu";
import {
  Button,
  ControlGroup,
  IconButton,
  ToggleButton
} from "molstar/lib/mol-plugin-ui/controls/common";
import {
  BrushSvg,
  CancelOutlinedSvg,
  CloseSvg,
  CubeOutlineSvg,
  Icon,
  IntersectSvg,
  RemoveSvg,
  RestoreSvg,
  SetSvg,
  SubtractSvg,
  UnionSvg
} from "molstar/lib/mol-plugin-ui/controls/icons";
import {
  ParameterControls,
  ParamOnChange,
  PureSelectControl
} from "molstar/lib/mol-plugin-ui/controls/parameters";
import {
  HelpGroup,
  HelpText,
  ViewportHelpContent
} from "molstar/lib/mol-plugin-ui/viewport/help";
import { AddComponentControls } from "molstar/lib/mol-plugin-ui/structure/components";
// Horus-specific imports
import {
  IconArrowsMinimize,
  IconGradienter,
  IconRulerMeasure
} from "@tabler/icons-react";
import HorusMolstar, { isMolstarLoaded } from "../../horusmolstar";
import RotatingLines from "../../../../RotatingLines/rotatinglines";
import { OptimizationProgress } from "./Controls/OptimizationControls";

// Optimization state interface for Horus molecular minimization
interface OptimizationState {
  steps: number;
  chunk: number;
  forceField: "uff" | "mmff94" | "ghemical";
  steepestDescent: boolean;
  conjugateGradients: boolean;
  steepestDescentThreshold: number;
  conjugateGradientsThreshold: number;
}

const StructureSelectionParams = {
  granularity: InteractivityManager.Params.granularity
};

type SelectionHelperType = "residue-list";

interface StructureSelectionActionsControlsState {
  isEmpty: boolean;
  isBusy: boolean;
  canUndo: boolean;

  action?:
    | StructureSelectionModifier
    | "theme"
    | "add-component"
    | "help"
    | "optimize"
    | "measure";
  helper?: SelectionHelperType;

  structureSelectionParams?: typeof StructureSelectionParams;

  // Horus optimization state
  isOptimizing: boolean;
  constraintMode: "flexible" | "freeze";
  optimizationParams: OptimizationState;
  optimizationProgress: {
    currentStep: number;
    totalSteps: number;
  };

  // Measurement state
  measurementMode: "auto" | "distance" | "angle" | "dihedral";
  currentAutoMeasurement?: string; // ID of the current auto measurement
}

const ActionHeader = new Map<StructureSelectionModifier, string>([
  ["add", "Add/Union Selection"],
  ["remove", "Remove/Subtract Selection"],
  ["intersect", "Intersect Selection"],
  ["set", "Set Selection"]
] as const);

class StructureSelectionActionsControls extends PluginUIComponent<
  object,
  StructureSelectionActionsControlsState
> {
  override state = {
    action: void 0 as StructureSelectionActionsControlsState["action"],
    helper: void 0 as StructureSelectionActionsControlsState["helper"],

    isEmpty: true,
    isBusy: false,
    canUndo: false,

    structureSelectionParams: StructureSelectionParams,

    // Horus optimization state
    isOptimizing: false,
    constraintMode: "flexible" as "flexible" | "freeze",
    optimizationParams: {
      steps: 200,
      chunk: 10,
      forceField: "uff" as "uff" | "mmff94" | "ghemical",
      steepestDescent: true,
      conjugateGradients: true,
      steepestDescentThreshold: 1.0e-4,
      conjugateGradientsThreshold: 1.0e-6
    },
    optimizationProgress: {
      currentStep: 0,
      totalSteps: 0
    },

    // Measurement state
    measurementMode: "auto" as "auto" | "distance" | "angle" | "dihedral",
    currentAutoMeasurement: undefined
  };

  override componentDidMount() {
    this.subscribe(
      this.plugin.managers.structure.hierarchy.behaviors.selection,
      (c) => {
        const isEmpty = c.hierarchy.structures.length === 0;
        if (this.state.isEmpty !== isEmpty) {
          this.setState({ isEmpty });
        }
        // trigger elementQueries and nonStandardResidueQueries recalculation
        this.queriesVersion = -1;
        this.forceUpdate();
      }
    );

    this.subscribe(this.plugin.behaviors.state.isBusy, (v) => {
      this.setState({ isBusy: v, action: void 0 });
    });

    this.subscribe(
      this.plugin.managers.interactivity.events.propsUpdated,
      () => {
        this.forceUpdate();
      }
    );

    this.subscribe(
      this.plugin.state.data.events.historyUpdated,
      ({ state }) => {
        this.setState({ canUndo: state.canUndo });
      }
    );

    // Subscribe to selection changes for auto measurement mode
    this.subscribe(
      this.plugin.managers.structure.selection.events.changed,
      () => {
        this.handleSelectionChange();
      }
    );

    // Update structureSelectionParams state if there are custom-defined granularityOptions
    const granularityOptions =
      this.plugin.spec.components?.selectionTools?.granularityOptions;
    if (granularityOptions) {
      const granularitySet = new Set(granularityOptions);
      const structureSelectionParams = {
        ...StructureSelectionParams,
        granularity: {
          ...StructureSelectionParams.granularity,
          options: StructureSelectionParams.granularity.options.filter(
            ([firstItem]) => granularitySet.has(firstItem)
          )
        }
      };
      this.setState({ structureSelectionParams: structureSelectionParams });
    }
  }

  get isDisabled() {
    return this.state.isBusy || this.state.isEmpty;
  }

  set = (
    modifier: StructureSelectionModifier,
    selectionQuery: StructureSelectionQuery
  ) => {
    this.plugin.managers.structure.selection.fromSelectionQuery(
      modifier,
      selectionQuery,
      false
    );
  };

  selectQuery: ActionMenu.OnSelect = (item, e) => {
    if (!item || !this.state.action) {
      this.setState({ action: void 0 });
      return;
    }
    const q = this.state.action! as StructureSelectionModifier;
    if (e?.shiftKey) {
      this.set(q, item.value as StructureSelectionQuery);
    } else {
      this.setState({ action: void 0 }, () => {
        this.set(q, item.value as StructureSelectionQuery);
      });
    }
  };

  selectHelper: ActionMenu.OnSelect = (item) => {
    if (!item || !this.state.action) {
      this.setState({ action: void 0, helper: void 0 });
      return;
    }
    this.setState({
      helper: (item.value as { kind: SelectionHelperType }).kind
    });
  };

  get structures() {
    const structures: Structure[] = [];
    for (const s of this.plugin.managers.structure.hierarchy.selection
      .structures) {
      const structure = s.cell.obj?.data;
      if (structure) structures.push(structure);
    }
    return structures;
  }

  private queriesItems: ActionMenu.Items[] = [];
  private queriesVersion = -1;
  get queries() {
    const { registry } = this.plugin.query.structure;
    if (registry.version !== this.queriesVersion) {
      const structures = this.structures;
      const queries = [
        ...registry.list,
        ...getPolymerAndBranchedEntityQueries(structures),
        ...getNonStandardResidueQueries(structures),
        ...getElementQueries(structures)
      ].sort((a, b) => b.priority - a.priority);
      this.queriesItems = ActionMenu.createItems(queries, {
        filter: (q) => q !== StructureSelectionQueries.current && !q.isHidden,
        label: (q) => q.label,
        category: (q) => q.category,
        description: (q) => q.description
      });
      this.queriesVersion = registry.version;
    }
    return this.queriesItems;
  }

  private helpersItems?: ActionMenu.Items[] = void 0;
  get helpers() {
    if (this.helpersItems) return this.helpersItems;
    // TODO: this is an initial implementation of the helper UI
    //       the plan is to add support to input queries in different languages
    //       after this has been implemented in mol-script
    const helpers = [
      {
        kind: "residue-list" as SelectionHelperType,
        category: "Helpers",
        label: "Atom/Residue Identifier List",
        description: "Create a selection from a list of atom/residue ranges."
      }
    ];
    this.helpersItems = ActionMenu.createItems(helpers, {
      label: (q) => q.label,
      category: (q) => q.category,
      description: (q) => q.description
    });
    return this.helpersItems;
  }

  private showAction(q: StructureSelectionActionsControlsState["action"]) {
    return () =>
      this.setState({
        action: this.state.action === q ? void 0 : q,
        helper: void 0
      });
  }

  toggleAdd = this.showAction("add");
  toggleRemove = this.showAction("remove");
  toggleIntersect = this.showAction("intersect");
  toggleSet = this.showAction("set");
  toggleTheme = this.showAction("theme");
  toggleAddComponent = this.showAction("add-component");
  toggleHelp = this.showAction("help");
  toggleOptimize = this.showAction("optimize");

  toggleMeasure = () => {
    const newAction = this.state.action === "measure" ? void 0 : "measure";
    this.setState({
      action: newAction,
      helper: void 0
    });

    // If opening measurement panel in auto mode, create initial measurement
    if (newAction === "measure" && this.state.measurementMode === "auto") {
      const history = this.plugin.managers.structure.selection.additionsHistory;
      if (history.length >= 2) {
        this.createAutoMeasurement();
      }
    }

    // Clear auto measurement when closing panel
    if (newAction === void 0 && this.state.measurementMode === "auto") {
      this.setState({ currentAutoMeasurement: undefined });
    }
  };

  setGranuality: ParamOnChange = ({ value }) => {
    this.plugin.managers.interactivity.setProps({ granularity: value });
  };

  // Horus optimization methods
  get nothingSelected() {
    return this.plugin.managers.structure.selection.elementCount() === 0;
  }

  get isOptimizeDisabled() {
    return this.nothingSelected || this.state.isOptimizing;
  }

  setConstraintMode = (mode: "flexible" | "freeze") => {
    this.setState({ constraintMode: mode });
  };

  updateOptimizationParam = <K extends keyof OptimizationState>(
    key: K,
    value: OptimizationState[K]
  ) => {
    this.setState((prevState) => ({
      ...prevState,
      optimizationParams: { ...prevState.optimizationParams, [key]: value }
    }));
  };

  optimize = async () => {
    this.setState({
      isOptimizing: true,
      optimizationProgress: {
        currentStep: 0,
        totalSteps: 0
      }
    });

    try {
      const history = this.plugin.managers.structure.selection.additionsHistory;

      const structureEntries = new Map<
        Structure,
        StructureSelectionHistoryEntry[]
      >();
      for (let i = 0, il = history.length; i < il; ++i) {
        const e = history[i]!;
        const k = e.loci.structure;
        if (structureEntries.has(k)) structureEntries.get(k)!.push(e);
        else structureEntries.set(k, [e]);
      }

      if (structureEntries.size === 0) {
        alert(
          "The optimization protocol only supports residues. Please select residues to optimize."
        );
        return;
      }

      if (!isMolstarLoaded(window.molstar)) {
        console.error("HorusMolstar not loaded");
        return;
      }

      const molstar = window.molstar as HorusMolstar;

      for (const [structure, entries] of structureEntries) {
        const firstEntry = entries[0];
        if (!firstEntry) continue;

        const structureInfo = molstar.getStructureFromLoci(firstEntry.loci, {
          includeRef: true
        });

        if (!structureInfo) {
          console.error(
            `Could not find structure information for structure ${structure.model.id}`
          );
          continue;
        }

        const constraintsList: Array<{
          chain: string;
          residue: number;
          atom?: number;
        }> = [];

        entries.forEach((entry) => {
          const loci = entry.loci;
          const lociSize = StructureElement.Loci.size(loci);

          if (lociSize === 1) {
            const location = StructureElement.Loci.getFirstLocation(loci);
            if (location) {
              const chainId = StructureProperties.chain.auth_asym_id(location);
              const residueNumber =
                StructureProperties.residue.auth_seq_id(location);
              const atomId = StructureProperties.atom.sourceIndex(location);

              constraintsList.push({
                chain: chainId,
                residue: residueNumber,
                atom: atomId
              });
            }
          } else {
            const location = StructureElement.Loci.getFirstLocation(loci);
            if (location) {
              const chainId = StructureProperties.chain.auth_asym_id(location);
              const residueNumber =
                StructureProperties.residue.auth_seq_id(location);

              constraintsList.push({
                chain: chainId,
                residue: residueNumber
              });
            }
          }
        });

        try {
          await molstar.optimizeMolecule({
            structure: structureInfo,
            loadResult: true,
            options: {
              constraints: {
                mode: this.state.constraintMode,
                atoms: constraintsList
              },
              steps: this.state.optimizationParams.steps,
              chunk: this.state.optimizationParams.chunk,
              forceField: this.state.optimizationParams.forceField,
              steepestDescent: this.state.optimizationParams.steepestDescent,
              conjugateGradients:
                this.state.optimizationParams.conjugateGradients,
              steepestDescentThreshold:
                this.state.optimizationParams.steepestDescentThreshold,
              conjugateGradientsThreshold:
                this.state.optimizationParams.conjugateGradientsThreshold,
              onProgress: ({ newCoords, step, totalSteps }) => {
                if (!newCoords) return;
                molstar?.updateCoordinates(structureInfo, newCoords);
                this.setState({
                  optimizationProgress: {
                    currentStep: step,
                    totalSteps: totalSteps
                  }
                });
              }
            }
          });
        } catch (error) {
          alert(`Failed to optimize structure ${structure.label}: ${error}`);
        }
      }
    } catch (error) {
      console.error("Error during optimization:", error);
      alert(
        "An error occurred during optimization. Check the console for details."
      );
    } finally {
      this.setState({
        isOptimizing: false,
        optimizationProgress: {
          currentStep: 0,
          totalSteps: 0
        }
      });
    }
  };

  align = () => {
    if (!isMolstarLoaded(window.molstar)) return;

    window.molstar.alignAtoms();
  };

  // Measurement methods
  setMeasurementMode = (mode: "auto" | "distance" | "angle" | "dihedral") => {
    // Clear current auto measurement when changing modes
    if (this.state.measurementMode === "auto" && mode !== "auto") {
      this.setState({ currentAutoMeasurement: undefined });
    }

    this.setState({ measurementMode: mode });

    // If switching to auto mode and panel is active, create initial measurement
    if (mode === "auto" && this.state.action === "measure") {
      const history = this.plugin.managers.structure.selection.additionsHistory;
      if (history.length >= 2) {
        this.createAutoMeasurement();
      }
    }
  };

  handleSelectionChange = () => {
    // Only handle auto measurements when in auto mode and measurement panel is active
    if (
      this.state.measurementMode !== "auto" ||
      this.state.action !== "measure"
    ) {
      return;
    }

    const history = this.plugin.managers.structure.selection.additionsHistory;

    // Auto-create measurement based on selection count
    if (history.length >= 2) {
      this.createAutoMeasurement();
    }
  };

  createAutoMeasurement = async () => {
    const history = this.plugin.managers.structure.selection.additionsHistory;

    try {
      let measurementResult;

      if (history.length >= 4) {
        // Create dihedral for 4+ selections
        const selections = history.slice(-4);
        measurementResult =
          await this.plugin.managers.structure.measurement.addDihedral(
            selections[0]!.loci,
            selections[1]!.loci,
            selections[2]!.loci,
            selections[3]!.loci
          );
      } else if (history.length >= 3) {
        // Create angle for 3+ selections
        const selections = history.slice(-3);
        measurementResult =
          await this.plugin.managers.structure.measurement.addAngle(
            selections[0]!.loci,
            selections[1]!.loci,
            selections[2]!.loci
          );
      } else if (history.length >= 2) {
        // Create distance for 2+ selections
        const selections = history.slice(-2);
        measurementResult =
          await this.plugin.managers.structure.measurement.addDistance(
            selections[0]!.loci,
            selections[1]!.loci
          );
      }

      if (measurementResult) {
        // Store the selection object selector as reference
        this.setState({
          currentAutoMeasurement: measurementResult.selection.ref
        });
      }
    } catch (error) {
      console.error("Error creating auto measurement:", error);
    }
  };

  addMeasurement = async () => {
    const history = this.plugin.managers.structure.selection.additionsHistory;

    if (history.length < 2) {
      alert("Please select at least 2 atoms/residues for measurements.");
      return;
    }

    const mode = this.state.measurementMode;

    // Handle auto mode
    if (mode === "auto") {
      await this.createAutoMeasurement();
      return;
    }

    // Handle manual modes
    const requiredSelections =
      mode === "distance" ? 2 : mode === "angle" ? 3 : 4;

    if (history.length < requiredSelections) {
      alert(
        `Please select at least ${requiredSelections} atoms/residues for ${mode} measurement.`
      );
      return;
    }

    // Take the last selections based on measurement mode
    const selections = history.slice(-requiredSelections);

    try {
      if (mode === "distance" && selections.length >= 2) {
        await this.plugin.managers.structure.measurement.addDistance(
          selections[0]!.loci,
          selections[1]!.loci
        );
      } else if (mode === "angle" && selections.length >= 3) {
        await this.plugin.managers.structure.measurement.addAngle(
          selections[0]!.loci,
          selections[1]!.loci,
          selections[2]!.loci
        );
      } else if (mode === "dihedral" && selections.length >= 4) {
        await this.plugin.managers.structure.measurement.addDihedral(
          selections[0]!.loci,
          selections[1]!.loci,
          selections[2]!.loci,
          selections[3]!.loci
        );
      }
    } catch (error) {
      console.error(`Error adding ${mode} measurement:`, error);
      alert(`Failed to add ${mode} measurement. Please check your selection.`);
    }
  };

  turnOff = () => (this.plugin.selectionMode = false);

  undo = () => {
    const task = this.plugin.state.data.undo();
    if (task) this.plugin.runTask(task);
  };

  subtract = () => {
    const sel =
      this.plugin.managers.structure.hierarchy.getStructuresWithSelection();
    const components: StructureComponentRef[] = [];
    for (const s of sel) components.push(...s.components);
    if (components.length === 0) return;
    this.plugin.managers.structure.component.modifyByCurrentSelection(
      components,
      "subtract"
    );
  };

  override render() {
    const granularity = this.plugin.managers.interactivity.props.granularity;
    const hide = this.plugin.spec.components?.selectionTools?.hide;
    const undoTitle = this.state.canUndo
      ? `Undo ${this.plugin.state.data.latestUndoLabel}`
      : "Some mistakes of the past can be undone.";

    let children: React.ReactNode | undefined = void 0;

    if (this.state.action && !this.state.helper) {
      children = (
        <>
          {this.state.action &&
            this.state.action !== "theme" &&
            this.state.action !== "add-component" &&
            this.state.action !== "help" &&
            this.state.action !== "optimize" &&
            this.state.action !== "measure" && (
              <div className="msp-selection-viewport-controls-actions">
                <ActionMenu
                  header={ActionHeader.get(
                    this.state.action as StructureSelectionModifier
                  )}
                  title="Click to close."
                  items={this.queries}
                  onSelect={this.selectQuery}
                  noOffset
                />
                <ActionMenu
                  items={this.helpers}
                  onSelect={this.selectHelper}
                  noOffset
                />
              </div>
            )}
          {this.state.action === "theme" && (
            <div className="msp-selection-viewport-controls-actions">
              <ControlGroup
                header="Theme"
                title="Click to close."
                initialExpanded={true}
                hideExpander={true}
                hideOffset={true}
                onHeaderClick={this.toggleTheme}
                topRightIcon={CloseSvg}
              >
                <ApplyThemeControls onApply={this.toggleTheme} />
              </ControlGroup>
            </div>
          )}
          {this.state.action === "add-component" && (
            <div className="msp-selection-viewport-controls-actions">
              <ControlGroup
                header="Add Component"
                title="Click to close."
                initialExpanded={true}
                hideExpander={true}
                hideOffset={true}
                onHeaderClick={this.toggleAddComponent}
                topRightIcon={CloseSvg}
              >
                <AddComponentControls
                  onApply={this.toggleAddComponent}
                  forSelection
                />
              </ControlGroup>
            </div>
          )}
          {this.state.action === "help" && (
            <div className="msp-selection-viewport-controls-actions">
              <ControlGroup
                header="Help"
                title="Click to close."
                initialExpanded={true}
                hideExpander={true}
                hideOffset={true}
                onHeaderClick={this.toggleHelp}
                topRightIcon={CloseSvg}
                maxHeight="300px"
              >
                <HelpGroup header="Selection Operations">
                  <HelpText>
                    Use <Icon svg={UnionSvg} inline />{" "}
                    <Icon svg={SubtractSvg} inline />{" "}
                    <Icon svg={IntersectSvg} inline />{" "}
                    <Icon svg={SetSvg} inline /> to modify the selection.
                  </HelpText>
                </HelpGroup>
                <HelpGroup header="Representation Operations">
                  <HelpText>
                    Use <Icon svg={BrushSvg} inline />{" "}
                    <Icon svg={CubeOutlineSvg} inline />{" "}
                    <Icon svg={RemoveSvg} inline />{" "}
                    <Icon svg={RestoreSvg} inline /> to color, create
                    components, remove from components, or undo actions.
                  </HelpText>
                </HelpGroup>
                <ViewportHelpContent selectOnly={true} />
              </ControlGroup>
            </div>
          )}
          {this.state.action === "optimize" && (
            <div className="msp-selection-viewport-controls-actions">
              <ControlGroup
                header="Optimization"
                title="Click to close."
                initialExpanded={true}
                hideExpander={true}
                hideOffset={true}
                onHeaderClick={this.toggleOptimize}
                topRightIcon={CloseSvg}
              >
                <PureSelectControl
                  title={`Define how selected residues are treated during optimization. "Flexible" mode allows selected residues to move freely while others are constrained. "Freeze" mode keeps selected residues fixed while allowing others to move.`}
                  onChange={(v) => this.setConstraintMode(v.value)}
                  isDisabled={this.isOptimizeDisabled}
                  value={this.state.constraintMode}
                  name="Constraint Mode"
                  param={ParamDefinition.Select("flexible", [
                    ["flexible", "Flexible"],
                    ["freeze", "Freeze"]
                  ])}
                />

                <ParameterControls
                  params={{
                    steps: ParamDefinition.Numeric(
                      this.state.optimizationParams.steps,
                      { min: 1, max: 1000, step: 1 },
                      { label: "Steps" }
                    ),
                    chunk: ParamDefinition.Numeric(
                      this.state.optimizationParams.chunk,
                      { min: 1, max: 100, step: 1 },
                      { label: "Chunk Size" }
                    ),
                    forceField: ParamDefinition.Select(
                      this.state.optimizationParams.forceField,
                      [
                        ["uff", "UFF"],
                        ["mmff94", "MMFF94"],
                        ["ghemical", "Ghemical"]
                      ],
                      { label: "Force Field" }
                    ),
                    steepestDescent: ParamDefinition.Boolean(
                      this.state.optimizationParams.steepestDescent,
                      { label: "Steepest Descent" }
                    ),
                    conjugateGradients: ParamDefinition.Boolean(
                      this.state.optimizationParams.conjugateGradients,
                      { label: "Conjugate Gradients" }
                    ),
                    steepestDescentThreshold: ParamDefinition.Numeric(
                      this.state.optimizationParams.steepestDescentThreshold,
                      {
                        min: 1e-8,
                        max: 1e-1,
                        step: 1e-6
                      },
                      { label: "SD Threshold" }
                    ),
                    conjugateGradientsThreshold: ParamDefinition.Numeric(
                      this.state.optimizationParams.conjugateGradientsThreshold,
                      {
                        min: 1e-8,
                        max: 1e-1,
                        step: 1e-6
                      },
                      { label: "CG Threshold" }
                    )
                  }}
                  values={{
                    steps: this.state.optimizationParams.steps,
                    chunk: this.state.optimizationParams.chunk,
                    forceField: this.state.optimizationParams.forceField,
                    steepestDescent:
                      this.state.optimizationParams.steepestDescent,
                    conjugateGradients:
                      this.state.optimizationParams.conjugateGradients,
                    steepestDescentThreshold:
                      this.state.optimizationParams.steepestDescentThreshold,
                    conjugateGradientsThreshold:
                      this.state.optimizationParams.conjugateGradientsThreshold
                  }}
                  onChange={(values) => {
                    this.updateOptimizationParam(
                      values.name as keyof OptimizationState,
                      values.value
                    );
                  }}
                  isDisabled={this.isOptimizeDisabled}
                />
                <Button
                  title={`Optimize selected residues in ${this.state.constraintMode} mode. ${
                    this.state.constraintMode === "flexible"
                      ? "Selected residues will move freely while others are constrained."
                      : "Selected residues will be frozen while others move freely."
                  }`}
                  onClick={this.optimize}
                  icon={
                    this.state.isOptimizing ? undefined : IconArrowsMinimize
                  }
                  disabled={this.isOptimizeDisabled}
                >
                  {this.state.isOptimizing ? (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: "8px"
                      }}
                    >
                      <RotatingLines size="16px" />
                      {this.state.optimizationProgress.totalSteps > 0
                        ? `Optimizing... ${this.state.optimizationProgress.currentStep}/${this.state.optimizationProgress.totalSteps}`
                        : "Optimizing..."}
                    </div>
                  ) : (
                    "Optimize Selection"
                  )}
                </Button>
              </ControlGroup>
            </div>
          )}
          {this.state.action === "measure" && (
            <div className="msp-selection-viewport-controls-actions">
              <ControlGroup
                header="Measurements"
                title="Click to close."
                initialExpanded={true}
                hideExpander={true}
                hideOffset={true}
                onHeaderClick={this.toggleMeasure}
                topRightIcon={CloseSvg}
              >
                <PureSelectControl
                  title="Select the type of measurement to add based on your selections"
                  onChange={(v) => this.setMeasurementMode(v.value)}
                  isDisabled={this.isDisabled}
                  value={this.state.measurementMode}
                  name="Measurement Type"
                  param={ParamDefinition.Select("auto", [
                    ["auto", "Auto (2=Distance, 3=Angle, 4=Dihedral)"],
                    ["distance", "Distance (2 atoms)"],
                    ["angle", "Angle (3 atoms)"],
                    ["dihedral", "Dihedral (4 atoms)"]
                  ])}
                />
                {this.state.measurementMode === "auto" && (
                  <div
                    style={{
                      padding: "4px 8px",
                      fontSize: "12px",
                      color: "#666",
                      backgroundColor: "#f5f5f5",
                      borderRadius: "4px",
                      margin: "4px 0"
                    }}
                  >
                    Current selections:{" "}
                    {
                      this.plugin.managers.structure.selection.additionsHistory
                        .length
                    }
                    {" - "}
                    {this.plugin.managers.structure.selection.additionsHistory
                      .length >= 4
                      ? "Showing Dihedral"
                      : this.plugin.managers.structure.selection
                            .additionsHistory.length >= 3
                        ? "Showing Angle"
                        : this.plugin.managers.structure.selection
                              .additionsHistory.length >= 2
                          ? "Showing Distance"
                          : "Select atoms to measure"}
                  </div>
                )}
                <Button
                  title={
                    this.state.measurementMode === "auto"
                      ? "Auto measurement: Creates distance (2 atoms), angle (3 atoms), or dihedral (4 atoms) automatically based on your selections"
                      : `Add ${this.state.measurementMode} measurement using the last ${
                          this.state.measurementMode === "distance"
                            ? "2"
                            : this.state.measurementMode === "angle"
                              ? "3"
                              : "4"
                        } selections from your selection history`
                  }
                  onClick={this.addMeasurement}
                  icon={IconRulerMeasure}
                  disabled={this.isDisabled}
                >
                  {this.state.measurementMode === "auto"
                    ? "Auto Measurement"
                    : `Add ${
                        this.state.measurementMode.charAt(0).toUpperCase() +
                        this.state.measurementMode.slice(1)
                      } Measurement`}
                </Button>
              </ControlGroup>
            </div>
          )}
        </>
      );
    } else if (
      ActionHeader.has(this.state.action as any) &&
      this.state.helper === "residue-list"
    ) {
      const close = () => this.setState({ action: void 0, helper: void 0 });
      children = (
        <div className="msp-selection-viewport-controls-actions">
          <ControlGroup
            header="Atom/Residue Identifier List"
            title="Click to close."
            initialExpanded={true}
            hideExpander={true}
            hideOffset={true}
            onHeaderClick={close}
            topRightIcon={CloseSvg}
          >
            <ResidueListSelectionHelper
              modifier={this.state.action as any}
              plugin={this.plugin}
              close={close}
            />
          </ControlGroup>
        </div>
      );
    }

    // Show optimization progress if optimizing
    if (this.state.isOptimizing) {
      return <OptimizationProgress {...this.state.optimizationProgress} />;
    }

    return (
      <>
        <div className="msp-flex-row" style={{ background: "none" }}>
          {!hide?.granularity && (
            <PureSelectControl
              title={`Picking Level for selecting and highlighting`}
              param={this.state.structureSelectionParams.granularity}
              name="granularity"
              value={granularity}
              onChange={this.setGranuality}
              isDisabled={this.isDisabled}
            />
          )}
          <ToggleButton
            icon={IconArrowsMinimize}
            title="ForceField Optimization"
            toggle={this.toggleOptimize}
            isSelected={this.state.action === "optimize"}
            disabled={this.isDisabled}
            style={{ marginLeft: "10px" }}
          />
          <Button
            title="Align selected structures"
            onClick={this.align}
            icon={IconGradienter}
            disabled={this.nothingSelected || this.state.isOptimizing}
          />
          <ToggleButton
            icon={IconRulerMeasure}
            title="Structural Measurements"
            toggle={this.toggleMeasure}
            isSelected={this.state.action === "measure"}
            disabled={this.isDisabled}
          />

          {!hide?.theme && (
            <ToggleButton
              icon={BrushSvg}
              title="Apply Theme to Selection"
              toggle={this.toggleTheme}
              isSelected={this.state.action === "theme"}
              disabled={this.isDisabled}
              style={{ marginLeft: "10px" }}
            />
          )}
          {!hide?.componentAdd && (
            <ToggleButton
              icon={CubeOutlineSvg}
              title="Create Component of Selection with Representation"
              toggle={this.toggleAddComponent}
              isSelected={this.state.action === "add-component"}
              disabled={this.isDisabled}
            />
          )}
          {!hide?.componentRemove && (
            <IconButton
              svg={RemoveSvg}
              title="Remove/subtract Selection from all Components"
              onClick={this.subtract}
              disabled={this.isDisabled}
            />
          )}
          {!hide?.undo && (
            <IconButton
              svg={RestoreSvg}
              onClick={this.undo}
              disabled={!this.state.canUndo || this.isDisabled}
              title={undoTitle}
            />
          )}

          {!hide?.cancel &&
            this.plugin.config.get(PluginConfig.Viewport.ShowSelectionMode) && (
              <IconButton
                svg={CancelOutlinedSvg}
                title="Turn selection mode off"
                onClick={this.turnOff}
              />
            )}
        </div>
        {children}
      </>
    );
  }
}

interface ApplyThemeControlsState {
  values: StructureComponentManager.ThemeParams;
}

interface ApplyThemeControlsProps {
  onApply?: () => void;
}

class ApplyThemeControls extends PurePluginUIComponent<
  ApplyThemeControlsProps,
  ApplyThemeControlsState
> {
  _params = memoizeLatest((pivot: StructureRef | undefined) =>
    StructureComponentManager.getThemeParams(this.plugin, pivot)
  );
  get params() {
    return this._params(
      this.plugin.managers.structure.component.pivotStructure
    );
  }

  override state = { values: ParamDefinition.getDefaultValues(this.params) };

  apply = () => {
    this.plugin.managers.structure.component.applyTheme(
      this.state.values,
      this.plugin.managers.structure.hierarchy.current.structures
    );
    this.props.onApply?.();
  };

  paramsChanged = (values: any) => this.setState({ values });

  override render() {
    return (
      <>
        <ParameterControls
          params={this.params}
          values={this.state.values}
          onChangeValues={this.paramsChanged}
        />
        <Button
          icon={BrushSvg}
          className="msp-btn-commit msp-btn-commit-on"
          onClick={this.apply}
          style={{ marginTop: "1px" }}
        >
          Apply Theme
        </Button>
      </>
    );
  }
}

const ResidueListIdTypeParams = {
  idType: ParamDefinition.Select<
    "auth" | "label" | "atom-id" | "element-symbol"
  >(
    "auth",
    ParamDefinition.arrayToOptions([
      "auth",
      "label",
      "atom-id",
      "element-symbol"
    ])
  ),
  identifiers: ParamDefinition.Text("", {
    description:
      "A comma separated list of atom identifiers (e.g. 10, 15-25), element symbols (e.g. N, C or 20-200) or residue ranges in given chain (e.g. A 10-15, B 25, C 30:i)"
  })
};

const DefaultResidueListIdTypeParams = ParamDefinition.getDefaultValues(
  ResidueListIdTypeParams
);

function ResidueListSelectionHelper({
  modifier,
  plugin,
  close
}: {
  modifier: StructureSelectionModifier;
  plugin: PluginContext;
  close: () => void;
}) {
  const [state, setState] = React.useState(DefaultResidueListIdTypeParams);

  const apply = () => {
    if (state.identifiers.trim().length === 0) return;

    try {
      close();
      const query = compileIdListSelection(state.identifiers, state.idType);
      plugin.managers.structure.selection.fromCompiledQuery(
        modifier,
        query,
        false
      );
    } catch (e) {
      console.error(e);
      plugin.log.error("Failed to create selection");
    }
  };

  return (
    <>
      <ParameterControls
        params={ResidueListIdTypeParams}
        values={state}
        onChangeValues={setState}
        onEnter={apply}
      />
      <Button
        className="msp-btn-commit msp-btn-commit-on"
        disabled={state.identifiers.trim().length === 0}
        onClick={apply}
        style={{ marginTop: "1px" }}
      >
        {capitalize(modifier)} Selection
      </Button>
    </>
  );
}

export class HorusSelectionControls extends PluginUIComponent {
  override componentDidMount() {
    this.subscribe(this.plugin.behaviors.interaction.selectionMode, () =>
      this.forceUpdate()
    );
    this.subscribe(
      this.plugin.managers.structure.selection.events.changed,
      () => this.forceUpdate()
    );
  }

  override render() {
    if (!this.plugin.selectionMode) return null;

    return (
      <div className="msp-selection-viewport-controls justify-center bg-white">
        <StructureSelectionActionsControls />
      </div>
    );
  }
}
