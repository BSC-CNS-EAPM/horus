import { useEffect, createRef, useState } from "react";
import { createPluginUI } from "molstar/lib/mol-plugin-ui";
import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";

import { ColorNames } from 'molstar/lib/mol-util/color/names';
import { PluginCommands } from 'molstar/lib/mol-plugin/commands';

import { PluginUISpec, DefaultPluginUISpec } from "molstar/lib/mol-plugin-ui/spec";
import { PluginConfig } from "molstar/lib/mol-plugin/config";

// Load the molstar default style
import "molstar/lib/mol-plugin-ui/skin/light.scss";

// Import the loading indicator
import Loading from "./loading";


declare global {
  interface Window {
    molstar?: PluginUIContext;
  }
}

export default function Molstar() {

  const parent = createRef<HTMLDivElement>();

  const MySpec: PluginUISpec = {
    ...DefaultPluginUISpec(),
    config: [
      [PluginConfig.Viewport.ShowExpand, false],
      [PluginConfig.Viewport.ShowControls, false],
    ],
    layout: {
      initial: {
        isExpanded: true,
        showControls: true,
      },
    }
  }

  useEffect(() => {
    async function init() {
      const plugin = await createPluginUI(parent.current as HTMLDivElement, { ...MySpec });

      const renderer = plugin.canvas3d!.props.renderer;
      PluginCommands.Canvas3D.SetSettings(plugin, {
        settings: {
          renderer: {
            ...renderer,
            backgroundColor: ColorNames.white,
          }
        }
      });

      // Select the first residue
      plugin.behaviors.layout.leftPanelTabName.next('data')
      window.molstar = plugin;
    }
    init();
    return () => {
      window.molstar?.dispose();
      window.molstar = undefined;
    };
  }, []);

  return (
    <div id="home-molstar" className="home-molstar" ref={parent} style={{
      // Place a top margin of 2 rem to avoid the toolbar
      position: "relative",
      width: "100%",
      // Set the height to the height of the window minus the toolbar
      height: "100%",
      border: "none"
    }} />
  );
}