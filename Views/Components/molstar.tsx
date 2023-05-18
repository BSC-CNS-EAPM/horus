import { useEffect, createRef } from "react";
import { createPluginUI } from "molstar/lib/mol-plugin-ui";
import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";

import { ColorNames } from 'molstar/lib/mol-util/color/names';
import { PluginCommands } from 'molstar/lib/mol-plugin/commands';

import { PluginUISpec, DefaultPluginUISpec } from "molstar/lib/mol-plugin-ui/spec";
import { PluginConfig } from "molstar/lib/mol-plugin/config";

// Load the molstar default style
import "molstar/lib/mol-plugin-ui/skin/light.scss";


declare global {
  interface Window {
    molstar?: PluginUIContext;
  }
}

export function Molstar() {
  const parent = createRef<HTMLDivElement>();

  const MySpec: PluginUISpec = {
    ...DefaultPluginUISpec(),
    config: [
      [PluginConfig.Viewport.ShowExpand, true],
      [PluginConfig.Viewport.ShowControls, false],
    ],
    layout: {
      initial: {
        isExpanded: false,
        showControls: false,
      },
    }
  }

  useEffect(() => {
    async function init() {
      const plugin = await createPluginUI(parent.current as HTMLDivElement, { ...MySpec });

      const renderer = plugin.canvas3d!.props.renderer;
      PluginCommands.Canvas3D.SetSettings(plugin, { settings: { renderer: { ...renderer, backgroundColor: ColorNames.whitesmoke /* or: 0xff0000 as Color */ } } });

      window.molstar = plugin;

      const data = await window.molstar.builders.data.download(
        { url: "https://files.rcsb.org/download/3PTB.pdb" }, /* replace with your URL */
        { state: { isGhost: true } }
      );
      const trajectory =
        await window.molstar.builders.structure.parseTrajectory(data, "pdb");
      await window.molstar.builders.structure.hierarchy.applyPreset(
        trajectory,
        "default"
      );
    }
    init();
    return () => {
      window.molstar?.dispose();
      window.molstar = undefined;
    };
  }, []);

  return <div ref={parent} style={{ position: "relative", width: "800px", height: "600px" }} />;
}