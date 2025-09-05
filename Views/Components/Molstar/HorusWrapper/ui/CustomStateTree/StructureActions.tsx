import { StructureElement } from "molstar/lib/mol-model/structure";
import { OrderedSet } from "molstar/lib/mol-data/int";
import { UnitIndex } from "molstar/lib/mol-model/structure/structure/element/util";
import { PluginCommands } from "molstar/lib/mol-plugin/commands";
import HorusMolstar, { MolInfoWithRef } from "../../horusmolstar";
import CloudDownload from "@/Components/Toolbar/Icons/CloudDownload";
import TrashIcon from "@/Components/Toolbar/Icons/Trash";
import EyeIcon from "@/Components/Toolbar/Icons/Eye";

interface StructureActionsProps {
  structure: MolInfoWithRef;
}

export function StructureActions({ structure }: StructureActionsProps) {
  const plugin = (window.molstar as HorusMolstar).plugin!;

  const focusStructure = () => {
    const s = structure.structureRef.cell.obj?.data;
    const u = s?.units[0];
    if (!s || !u) return;

    const loci = StructureElement.Loci(s, [
      { unit: u, indices: u.elements as unknown as OrderedSet<UnitIndex> }
    ]);

    plugin.managers.camera.focusLoci(loci);
  };

  const downloadStructure = () => {
    window.horus.saveFile(
      new File([structure.fileContents ?? "No content"], structure.label)
    );
  };

  const removeStructure = (e: React.MouseEvent) => {
    e.preventDefault();
    PluginCommands.State.RemoveObject(plugin, {
      state: structure.structureRef.cell.parent!,
      ref: structure.rootRef,
      removeParentGhosts: true
    });
  };

  return (
    <div className="flex items-center space-x-1">
      <button
        className="p-1 text-gray-400 hover:text-gray-600"
        onClick={focusStructure}
        title="Focus on structure"
      >
        <EyeIcon className="w-4 h-4" />
      </button>
      {structure.kind === "structure" && (
        <button
          className="p-1 text-gray-400 hover:text-gray-600"
          onClick={downloadStructure}
          title="Download structure"
        >
          <CloudDownload className="w-4 h-4" />
        </button>
      )}
      <button
        className="p-1 text-gray-400 hover:text-gray-600"
        onClick={removeStructure}
        title="Remove structure"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
