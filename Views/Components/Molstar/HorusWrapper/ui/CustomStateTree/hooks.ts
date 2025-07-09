import { useState, useEffect } from "react";
import { PluginCommands } from "molstar/lib/mol-plugin/commands";
import HorusMolstar, { MolInfoWithRef } from "../../horusmolstar";

export function useStructureVisibility(structure: MolInfoWithRef) {
  const plugin = (window.molstar as HorusMolstar).plugin!;
  const [isVisible, setIsVisible] = useState(
    !structure.structureRef.cell.state.isHidden,
  );

  useEffect(() => {
    const subscription = plugin.state.events.cell.stateUpdated.subscribe(
      (e) => {
        if (
          e.ref === structure.structureRef.cell.transform.ref &&
          e.state === structure.structureRef.cell.parent
        ) {
          setIsVisible(!e.cell.state.isHidden);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [plugin, structure.structureRef.cell.transform.ref]);

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
    PluginCommands.State.ToggleVisibility(plugin, {
      state: structure.structureRef.cell.parent!,
      ref: structure.structureRef.cell.transform.ref,
    });
  };

  return { isVisible, toggleVisibility };
}

export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  callback: () => void,
) {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ref, callback]);
}
