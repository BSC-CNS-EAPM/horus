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
  Canvas3DParams,
} from "molstar/lib/mol-canvas3d/canvas3d";
import { PluginCommands } from "molstar/lib/mol-plugin/commands";
import { StateTransform } from "molstar/lib/mol-state";
import { ParamDefinition as PD } from "molstar/lib/mol-util/param-definition";
import { PluginUIComponent } from "molstar/lib/mol-plugin-ui/base";
import {
  IconButton,
  SectionHeader,
} from "molstar/lib/mol-plugin-ui/controls/common";
import {
  AccountTreeOutlinedSvg,
  BuildSvg,
  DeleteOutlinedSvg,
  HelpOutlineSvg,
  HomeOutlinedSvg,
  SaveOutlinedSvg,
  TuneSvg,
} from "molstar/lib/mol-plugin-ui/controls/icons";
import { ParameterControls } from "molstar/lib/mol-plugin-ui/controls/parameters";
import { StateObjectActions } from "molstar/lib/mol-plugin-ui/state/actions";
import {
  RemoteStateSnapshots,
  StateSnapshots,
} from "molstar/lib/mol-plugin-ui/state/snapshots";
import { StateTree } from "molstar/lib/mol-plugin-ui/state/tree";
import { HelpContent } from "molstar/lib/mol-plugin-ui/viewport/help";
import { DefaultStructureTools } from "molstar/lib/mol-plugin-ui/controls";
import { LeftPanelTabName } from "molstar/lib/mol-plugin/layout";

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
      .value as HorusLeftPanelTypes,
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
              left: "collapsed",
            },
          },
        });
      }
    });

    this.subscribe(this.plugin.state.data.events.changed, ({ state }) => {
      if (this.state.tab !== "data") return;
      if (state.cells.size === 1) this.set("root");
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
            left: "collapsed",
          },
        },
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
            left: "full",
          },
        },
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
    data: (
      <>
        <SectionHeader
          icon={AccountTreeOutlinedSvg}
          title={
            <>
              <RemoveAllButton /> State Tree
            </>
          }
        />
        <StateTree state={this.plugin.state.data} />
      </>
    ),
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
    ),
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
      settings: { [p.name]: p.value },
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
      ref: StateTransform.RootRef,
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
