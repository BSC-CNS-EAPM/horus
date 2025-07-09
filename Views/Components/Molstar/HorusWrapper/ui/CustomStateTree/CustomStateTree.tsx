import HorusMolstar from "../../horusmolstar";
import { StructureHeader } from "./StructureHeader";
import { ComponentsSection } from "./ComponentSection";
import { RepresentationsSection } from "./RepresentationsSection";
import { useStructureVisibility } from "./hooks";
import { StructureViewerProps, AddComponentParams } from "./types";
import { StructureSelectionQueries } from "molstar/lib/mol-plugin-state/helpers/structure-selection-query";

function StructureContainer({
  children,
  onMouseEnter,
  onMouseLeave,
}: {
  children: React.ReactNode;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  return (
    <div
      className="space-y-3 p-4 bg-white border border-gray-200 rounded-lg shadow-sm"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
}

export function SingleStructureView({ structure }: StructureViewerProps) {
  const plugin = (window.molstar as HorusMolstar).plugin!;
  const { isVisible, toggleVisibility } = useStructureVisibility(structure);

  if (!plugin) {
    return <span>The Plugin is not initialized</span>;
  }

  const handleAddComponent = async (params: AddComponentParams) => {
    try {
      const horusMolstar = window.molstar as HorusMolstar;
      if (params.loci) {
        // Use loci-based selection
        await horusMolstar.createComponent({
          structure: horusMolstar.plugin!.helpers.substructureParent.get(
            params.loci.structure,
          ),
          newSelectionLabel: params.label,
          selectionOptions: { loci: params.loci },
          representationParams: {
            representation: params.representation,
            representationParams: {
              ...params.representationParams,
            },
            color: params.color,
            colorParams: params.colorParams,
            size: params.size,
            sizeParams: params.sizeParams,
          },
        });
      } else if (params.script) {
        // Use script-based selection
        await horusMolstar.createComponent({
          newSelectionLabel: params.label,
          selectionOptions: {
            script: params.script,
            language: params.language!,
          },
          representationParams: {
            representation: params.representation,
            representationParams: {
              ...params.representationParams,
            },
            color: params.color,
            colorParams: params.colorParams,
            size: params.size,
            sizeParams: params.sizeParams,
          },
        });
      }

      if (params.opacity !== undefined) {
        await plugin.managers.structure.component.applyTheme(
          {
            selection: StructureSelectionQueries.all, // Apply to entire component
            action: {
              name: "transparency",
              params: { value: params.opacity }, // 0.0 = fully opaque, 1.0 = fully transparent
            },
            representations: [params.representation], // Target specific representation type
          },
          [structure.structureRef],
        );
      }
    } catch (error) {
      console.error("Failed to add component:", error);
    }
  };

  return (
    // <StructureContainer onMouseEnter={highlight} onMouseLeave={clearHighlight}>
    <StructureContainer>
      <StructureHeader
        structure={structure}
        isVisible={isVisible}
        onToggleVisibility={toggleVisibility}
      />

      <RepresentationsSection
        structure={structure}
        onAddComponent={handleAddComponent}
      />

      <ComponentsSection
        structure={structure}
        onAddComponent={handleAddComponent}
      />
    </StructureContainer>
  );
}
