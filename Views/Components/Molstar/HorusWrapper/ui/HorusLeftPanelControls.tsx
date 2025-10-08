/**
 * Copyright (c) 2019-2023 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import * as React from "react";
import { throttleTime } from "rxjs";
import {
  Canvas3DContext,
  Canvas3DParams
} from "molstar/lib/mol-canvas3d/canvas3d";
import { PluginCommands } from "molstar/lib/mol-plugin/commands";
import { State, StateTransform } from "molstar/lib/mol-state";
import { ParamDefinition as PD } from "molstar/lib/mol-util/param-definition";
import { PluginUIComponent } from "molstar/lib/mol-plugin-ui/base";
import {
  IconButton,
  SectionHeader
} from "molstar/lib/mol-plugin-ui/controls/common";
import {
  AccountTreeOutlinedSvg,
  BuildSvg,
  DeleteOutlinedSvg,
  HelpOutlineSvg,
  HomeOutlinedSvg,
  SaveOutlinedSvg,
  TuneSvg
} from "molstar/lib/mol-plugin-ui/controls/icons";
import { ParameterControls } from "molstar/lib/mol-plugin-ui/controls/parameters";
import { StateObjectActions } from "molstar/lib/mol-plugin-ui/state/actions";
import {
  RemoteStateSnapshots,
  StateSnapshots
} from "molstar/lib/mol-plugin-ui/state/snapshots";
import { StateTree } from "molstar/lib/mol-plugin-ui/state/tree";
import { HelpContent } from "molstar/lib/mol-plugin-ui/viewport/help";
import { DefaultStructureTools } from "molstar/lib/mol-plugin-ui/controls";
import { LeftPanelTabName } from "molstar/lib/mol-plugin/layout";
import AppButton from "@/Components/appbutton";
import HorusSwitch from "@/Components/Switch/switch";
import HorusMolstar, { MolInfoWithRef, MolstarEvents } from "../horusmolstar";
import { SingleStructureView } from "./CustomStateTree/CustomStateTree";
import { MeasurementsCard } from "./CustomStateTree/MeasurementsSection";
import RotatingLines from "@/Components/RotatingLines/rotatinglines";

export class CustomImportControls extends PluginUIComponent<{
  initiallyCollapsed?: boolean;
}> {
  override componentDidMount() {
    this.subscribe(this.plugin.state.behaviors.events.changed, () =>
      this.forceUpdate()
    );
  }

  override render() {
    const controls: JSX.Element[] = [];
    this.plugin.customImportControls.forEach((Controls, key) => {
      controls.push(
        <Controls
          initiallyCollapsed={this.props.initiallyCollapsed}
          key={key}
        />
      );
    });
    return controls.length > 0 ? <>{controls}</> : null;
  }
}

type HorusLeftPanelTypes = LeftPanelTabName | "structure-tools";

export class HorusLeftPanelControls extends PluginUIComponent<
  object,
  { tab: HorusLeftPanelTypes }
> {
  override state = {
    tab: this.plugin.behaviors.layout.leftPanelTabName
      .value as HorusLeftPanelTypes
  };

  override componentDidMount() {
    this.subscribe(this.plugin.behaviors.layout.leftPanelTabName, (tab) => {
      if (this.state.tab !== tab) this.setState({ tab });
      if (
        tab === "none" &&
        this.plugin.layout.state.regionState.left !== "collapsed"
      ) {
        PluginCommands.Layout.Update(this.plugin, {
          state: {
            regionState: {
              ...this.plugin.layout.state.regionState,
              left: "collapsed"
            }
          }
        });
      }
    });
  }

  set = (tab: HorusLeftPanelTypes) => {
    if (this.state.tab === tab) {
      this.setState({ tab: "none" }, () =>
        this.plugin.behaviors.layout.leftPanelTabName.next("none")
      );
      PluginCommands.Layout.Update(this.plugin, {
        state: {
          regionState: {
            ...this.plugin.layout.state.regionState,
            left: "collapsed"
          }
        }
      });
      return;
    }

    this.setState({ tab }, () =>
      this.plugin.behaviors.layout.leftPanelTabName.next(
        tab as LeftPanelTabName
      )
    );
    if (this.plugin.layout.state.regionState.left !== "full") {
      PluginCommands.Layout.Update(this.plugin, {
        state: {
          regionState: {
            ...this.plugin.layout.state.regionState,
            left: "full"
          }
        }
      });
    }
  };

  tabs: { [K in HorusLeftPanelTypes]: JSX.Element } = {
    none: <></>,
    root: (
      <>
        <SectionHeader icon={HomeOutlinedSvg} title="Home" />
        <StateObjectActions
          state={this.plugin.state.data}
          nodeRef={StateTransform.RootRef}
          hideHeader={true}
          initiallyCollapsed={true}
          alwaysExpandFirst={true}
        />
        <CustomImportControls />
        {this.plugin.spec.components?.remoteState !== "none" && (
          <RemoteStateSnapshots listOnly />
        )}
      </>
    ),
    data: <StateTreeTab state={this.plugin.state.data} />,
    "structure-tools": <DefaultStructureTools />,
    states: <StateSnapshots />,
    settings: (
      <>
        <SectionHeader icon={TuneSvg} title="Plugin Settings" />
        <FullSettings />
      </>
    ),
    help: (
      <>
        <SectionHeader icon={HelpOutlineSvg} title="Help" />
        <HelpContent />
      </>
    )
  };

  override render() {
    const tab = this.state.tab;

    return (
      <div className="msp-left-panel-controls">
        <div className="msp-left-panel-controls-buttons">
          <IconButton
            svg={HomeOutlinedSvg}
            toggleState={tab === "root"}
            transparent
            onClick={() => this.set("root")}
            title="Home"
          />
          <DataIcon set={this.set} />
          <IconButton
            svg={SaveOutlinedSvg}
            toggleState={tab === "states"}
            transparent
            onClick={() => this.set("states")}
            title="Plugin State"
          />
          <IconButton
            svg={BuildSvg}
            toggleState={tab === "structure-tools"}
            transparent
            onClick={() => this.set("structure-tools")}
            title="Structure Tools"
          />
          <IconButton
            svg={HelpOutlineSvg}
            toggleState={tab === "help"}
            transparent
            onClick={() => this.set("help")}
            title="Help"
          />
          <div className="msp-left-panel-controls-buttons-bottom">
            <IconButton
              svg={TuneSvg}
              toggleState={tab === "settings"}
              transparent
              onClick={() => this.set("settings")}
              title="Settings"
            />
          </div>
        </div>
        <div className="msp-scrollable-container">{this.tabs[tab]}</div>
      </div>
    );
  }
}

class DataIcon extends PluginUIComponent<
  { set: (tab: HorusLeftPanelTypes) => void },
  { changed: boolean }
> {
  override state = { changed: false };

  get tab() {
    return this.plugin.behaviors.layout.leftPanelTabName.value;
  }

  override componentDidMount() {
    this.subscribe(this.plugin.behaviors.layout.leftPanelTabName, () => {
      if (this.tab === "data") this.setState({ changed: false });
      else this.forceUpdate();
    });

    this.subscribe(this.plugin.state.data.events.changed, () => {
      if (this.tab !== "data") this.setState({ changed: true });
    });
  }

  override render() {
    return (
      <IconButton
        svg={AccountTreeOutlinedSvg}
        toggleState={this.tab === "data"}
        transparent
        onClick={() => this.props.set("data")}
        title="State Tree"
        style={{ position: "relative" }}
        extraContent={
          this.state.changed ? (
            <div className="msp-left-panel-controls-button-data-dirty" />
          ) : (
            void 0
          )
        }
      />
    );
  }
}

class FullSettings extends PluginUIComponent {
  private setSettings = (p: {
    param: PD.Base<any>;
    name: string;
    value: any;
  }) => {
    PluginCommands.Canvas3D.SetSettings(this.plugin, {
      settings: { [p.name]: p.value }
    });
  };

  private setCanvas3DContextProps = (p: {
    param: PD.Base<any>;
    name: string;
    value: any;
  }) => {
    this.plugin.canvas3dContext?.setProps({ [p.name]: p.value });
    this.plugin.events.canvas3d.settingsUpdated.next(void 0);
  };

  override componentDidMount() {
    this.subscribe(this.plugin.events.canvas3d.settingsUpdated, () =>
      this.forceUpdate()
    );
    this.subscribe(this.plugin.layout.events.updated, () => this.forceUpdate());

    if (this.plugin.canvas3d) {
      this.subscribe(
        this.plugin.canvas3d.camera.stateChanged.pipe(
          throttleTime(500, undefined, { leading: true, trailing: true })
        ),
        (state) => {
          if (state.radiusMax !== undefined || state.radius !== undefined) {
            this.forceUpdate();
          }
        }
      );
    }
  }

  override render() {
    return (
      <>
        {this.plugin.canvas3d && this.plugin.canvas3dContext && (
          <>
            <SectionHeader title="Viewport" />
            <ParameterControls
              params={Canvas3DParams}
              values={this.plugin.canvas3d.props}
              onChange={this.setSettings}
            />
            <ParameterControls
              params={Canvas3DContext.Params}
              values={this.plugin.canvas3dContext.props}
              onChange={this.setCanvas3DContextProps}
            />
          </>
        )}
        <SectionHeader title="Behavior" />
        <StateTree state={this.plugin.state.behaviors} />
      </>
    );
  }
}

class RemoveAllButton extends PluginUIComponent<object> {
  override componentDidMount() {
    this.subscribe(this.plugin.state.events.cell.created, (e) => {
      if (e.cell.transform.parent === StateTransform.RootRef)
        this.forceUpdate();
    });

    this.subscribe(this.plugin.state.events.cell.removed, (e) => {
      if (e.parent === StateTransform.RootRef) this.forceUpdate();
    });
  }

  remove = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    PluginCommands.State.RemoveObject(this.plugin, {
      state: this.plugin.state.data,
      ref: StateTransform.RootRef
    });
  };

  override render() {
    const count = this.plugin.state.data.tree.children.get(
      StateTransform.RootRef
    ).size;
    if (count === 0) return null;
    return (
      <IconButton
        svg={DeleteOutlinedSvg}
        onClick={this.remove}
        title={"Remove All"}
        style={{ display: "inline-block" }}
        small
        className="msp-no-hover-outline"
        transparent
      />
    );
  }
}

function StateTreeTab({ state }: { state: State }) {
  const [advancedTree, setAdvancedTree] = React.useState(false);

  return (
    <>
      <SectionHeader
        icon={AccountTreeOutlinedSvg}
        title={
          <div className="flex flex-row gap-2 justify-end items-center">
            <RemoveAllButton />
            {advancedTree ? "Advanced" : "Simple"} State Tree
            <HorusSwitch enabled={advancedTree} setEnabled={setAdvancedTree}>
              {advancedTree ? "Advanced" : "Simple"}
            </HorusSwitch>
          </div>
        }
      />

      {advancedTree ? <StateTree state={state} /> : <SimpleStateTree />}
    </>
  );
}

function useLoadedStructures() {
  const [structures, setStructures] = React.useState<MolInfoWithRef[]>([]);

  React.useEffect(() => {
    const updateStructures = () => {
      // Mol* always loaded if this interface is visible
      const molstar = window.molstar as HorusMolstar;

      if (!molstar?.plugin) {
        return;
      }

      const structures = molstar.listStructures({ includeRef: true });
      setStructures(structures);
    };
    updateStructures();

    window.addEventListener(MolstarEvents.STATE, updateStructures);

    return () => {
      window.removeEventListener(MolstarEvents.STATE, updateStructures);
    };
  }, []);

  return { structures };
}

function SimpleStateTree() {
  const { structures: loadedStructures } = useLoadedStructures();

  const [allHidden, setAllHidden] = React.useState(false);

  const toggleAllStructuresVisibility = (visible: boolean) => {
    const plugin = (window.molstar as HorusMolstar).plugin!;

    // Get the current visibility state of the first structure to determine toggle direction
    const structures = plugin.managers.structure.hierarchy.current.structures;
    if (structures.length === 0) return;
    const structuresToTogle = structures.filter(
      (s) => !!s.cell.state.isHidden === visible
    );

    // Apply to all structures
    for (const structure of structuresToTogle) {
      PluginCommands.State.ToggleVisibility(plugin, {
        state: structure.cell.parent!,
        ref: structure.cell.transform.ref
      });
    }

    setAllHidden(!visible);
  };

  if (loadedStructures.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center gap-2">
        <span className="text-center">No loaded structures</span>
        <OpenFileStructure />
        <OpenTrajectoryStructure />
      </div>
    );
  }

  return (
    <>
      <MeasurementsCard />
      <div className="flex flex-col gap-1 p-2">
        <div className="flex flex-row items-center space-x-2">
          <input
            type="checkbox"
            checked={!allHidden}
            onChange={(e) => {
              toggleAllStructuresVisibility(e.target.checked);
            }}
            className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 focus:ring-2 mt-0.5 flex-shrink-0"
          />
          <span>Show / hide all</span>
        </div>
        {loadedStructures.map((s) => (
          <SingleStructureView structure={s} />
        ))}
      </div>
      <div className="flex flex-col justify-center items-center gap-2">
        <OpenFileStructure />
        <OpenTrajectoryStructure />
      </div>
    </>
  );
}

function OpenFileStructure() {
  const [pdbID, setPDBID] = React.useState("");
  const [loading, setIsLoading] = React.useState(false);

  const fetchPDB = async () => {
    const trimmedID = pdbID.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(trimmedID)) {
      alert("Please enter a valid 4-letter PDB ID.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://files.rcsb.org/download/${trimmedID}.pdb`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch PDB file.");
      }
      const blob = await response.blob();
      const file = new File([blob], `${trimmedID}.pdb`, {
        type: "chemical/x-pdb"
      });
      window.molstar?.loadMoleculeFile(file, { label: trimmedID });
      setPDBID("");
    } catch (err) {
      console.error(err);
      alert("Failed to fetch or load the PDB file.");
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return <RotatingLines />;
  }

  return (
    <div className="space-y-2 w-[250px] mb-2">
      {/* Fetch from PDB */}
      <div className="flex space-x-2 w-full">
        <input
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              fetchPDB();
            }
          }}
          type="text"
          placeholder="PDB ID"
          value={pdbID}
          onChange={(e) => setPDBID(e.target.value)}
          className="flex-1 min-w-0 border border-slate-300 rounded-md px-2 py-1 text-sm"
          maxLength={4}
        />
        <AppButton className="w-[100px]" action={fetchPDB}>
          Fetch
        </AppButton>
      </div>
      {/* Open local file */}
      <AppButton
        className="w-full"
        action={() => {
          window.horus.openExtensionFilePicker?.({
            onFileConfirm(file) {
              window.horus.getFile(file).then((b) => {
                const filename = file.split("/").pop() || "molecule";
                const f = new File([b], filename);
                window.molstar?.loadMoleculeFile(f, { label: filename });
              });
            }
          });
        }}
      >
        Open file
      </AppButton>
    </div>
  );
}

function OpenTrajectoryStructure() {
  return (
    <div className="space-y-2 w-[250px] mb-2">
      <AppButton
        className="w-full"
        action={async () => {
          const molstar = window.molstar as HorusMolstar;

          let top: File | undefined;
          let trajectory: File | undefined;

          const topPath = await window.horus.openExtensionFilePicker?.({
            label: "Select topology"
          });

          if (!topPath) {
            return;
          }

          await window.horus.getFile(topPath).then((b) => {
            const filename = topPath.split("/").pop() || "topology";
            const f = new File([b], filename);
            top = f;
          });

          const trajPath = await window.horus.openExtensionFilePicker?.({
            label: "Select trajectory"
          });

          if (!trajPath) {
            return;
          }

          await window.horus.getFile(trajPath).then((b) => {
            const filename = trajPath.split("/").pop() || "trajectory";
            const f = new File([b], filename);
            trajectory = f;
          });

          if (top && trajectory) {
            molstar.loadTrajectory({
              topology: top,
              trajectory: trajectory,
              label: top.name
            });
          }
        }}
      >
        Open trajectory
      </AppButton>
    </div>
  );
}
