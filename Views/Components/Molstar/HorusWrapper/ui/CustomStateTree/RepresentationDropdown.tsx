import { useState, useRef } from "react";
import { MovingChevron } from "@/Components/reusable";
import { useClickOutside } from "./hooks";
import { RepresentationInfo, REPRESENTATIONS } from "./types";
import { StructureRepresentationRegistry } from "molstar/lib/mol-repr/structure/registry";

interface RepresentationDropdownProps {
  representation?: RepresentationInfo;
  onChangeRepresentation: (
    repId: StructureRepresentationRegistry.BuiltIn
  ) => void;
}

export function RepresentationDropdown({
  representation,
  onChangeRepresentation
}: RepresentationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setIsOpen(false));

  if (!representation) {
    return <span className="text-xs text-gray-500">Unknown</span>;
  }

  const currentRep = REPRESENTATIONS.find(
    (rep) => rep.id === representation.type
  );
  const currentLabel = currentRep?.label || representation.type;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center justify-between px-2 py-1 text-xs text-gray-600 bg-white border border-gray-200 rounded hover:border-gray-300"
      >
        <span className="truncate">{currentLabel}</span>
        <MovingChevron down={isOpen} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-auto">
          {REPRESENTATIONS.map((rep) => (
            <button
              key={rep.id}
              onClick={(e) => {
                e.stopPropagation();
                onChangeRepresentation(rep.id);
                setIsOpen(false);
              }}
              className={`w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 ${
                representation.type === rep.id
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700"
              }`}
            >
              <div className="font-medium">{rep.label}</div>
              <div className="text-xs text-gray-500">{rep.description}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
