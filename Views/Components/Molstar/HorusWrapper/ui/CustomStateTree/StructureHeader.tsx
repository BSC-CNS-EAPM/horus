import { MolInfoWithRef } from "../../horusmolstar";
import { StructureActions } from "./StructureActions";

interface StructureHeaderProps {
  structure: MolInfoWithRef;
  isVisible: boolean;
  onToggleVisibility: () => void;
}

export function StructureHeader({
  structure,
  isVisible,
  onToggleVisibility,
}: StructureHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={isVisible}
          onChange={onToggleVisibility}
          className="h-4 w-4 rounded border-gray-300"
        />
        <h3 className="text-sm font-medium text-gray-800">
          {structure.label || "Structure"}
        </h3>
      </div>
      <StructureActions structure={structure} />
    </div>
  );
}
