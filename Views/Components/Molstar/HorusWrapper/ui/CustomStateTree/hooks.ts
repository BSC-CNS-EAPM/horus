import { useState, useEffect } from "react";
import { PluginCommands } from "molstar/lib/mol-plugin/commands";
import HorusMolstar, { MolInfoWithRef } from "../../horusmolstar";
import { StateObjectCell } from "molstar/lib/mol-state";

export function useCellVisibility(cell: StateObjectCell) {
  const plugin = (window.molstar as HorusMolstar).plugin!;
  const [isVisible, setIsVisible] = useState(!cell.state.isHidden);

  useEffect(() => {
    const subscription = plugin.state.events.cell.stateUpdated.subscribe(
      (e) => {
        if (e.ref === cell.transform.ref && e.state === cell.parent) {
          setIsVisible(!e.cell.state.isHidden);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [plugin, cell]);

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
    PluginCommands.State.ToggleVisibility(plugin, {
      state: cell.parent!,
      ref: cell.transform.ref
    });
  };

  return { isVisible, toggleVisibility };
}

export function useStructureVisibility(structure: MolInfoWithRef) {
  return useCellVisibility(structure.structureRef.cell);
}

export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  callback: () => void
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
