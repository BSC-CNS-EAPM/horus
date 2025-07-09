import { useState } from "react";
import { MovingChevron } from "@/Components/reusable";
import { StructureRepresentationRef } from "molstar/lib/mol-plugin-state/manager/structure/hierarchy-state";
import HorusMolstar, { MolInfoWithRef } from "../../horusmolstar";
import { RepresentationForm } from "./RepresentationForm";
import { RepresentationItem } from "./RepresentationItem";
import {
  RepresentationInfo,
  AddComponentParams,
  OnChangeRepresentationParams,
} from "./types";
import { setStructureTransparency } from "molstar/lib/mol-plugin-state/helpers/structure-transparency";
import { StructureElement } from "molstar/lib/mol-model/structure";

interface RepresentationsSectionProps {
  structure: MolInfoWithRef;
  onAddComponent: (params: AddComponentParams) => void;
}

export function RepresentationsSection({
  structure,
  onAddComponent,
}: RepresentationsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const getComponentRepresentations = (): RepresentationInfo[] => {
    const allRepresentations: RepresentationInfo[] = [];

    structure.structureRef.components.forEach((component) => {
      component.representations.forEach((rep: StructureRepresentationRef) => {
        // Get the component label - this is where the semantic labels are stored
        const componentLabel = component.cell.obj?.label || "Unknown";

        allRepresentations.push({
          ref: rep,
          type: rep.cell.transform.params?.type?.name || "unknown",
          label: componentLabel, // Use the component label, not the representation label
          componentLabel: componentLabel,
        });
      });
    });

    return allRepresentations;
  };

  const changeRepresentation = async ({
    repRef,
    repId: representationId,
    colorTheme,
    sizeTheme,
    opacity,
  }: OnChangeRepresentationParams) => {
    try {
      const plugin = (window.molstar as HorusMolstar).plugin!;

      await plugin.managers.structure.component.updateRepresentations(
        [repRef.component],
        repRef,
        {
          type: {
            name: representationId,
            params: { value: representationId },
          },
          colorTheme: colorTheme,
          sizeTheme: sizeTheme,
        },
      );
      if (opacity !== undefined) {
        // Apply transparency only to this specific component
        await setStructureTransparency(
          plugin,
          [repRef.component], // Only this component
          opacity,
          async (structure) => {
            // Return all loci for the structure - this will be filtered by representation type
            return StructureElement.Loci.all(structure);
          },
          [representationId], // This filters to only the specific representation type
        );
      }
    } catch (error) {
      console.error("Failed to change representation:", error);
    }
  };

  const handleAddComponent = async (params: AddComponentParams) => {
    try {
      onAddComponent(params);
      setShowForm(false);
    } catch (error) {
      console.error("Failed to add representation:", error);
    }
  };

  const representations = getComponentRepresentations();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-1 text-sm font-medium text-gray-600 hover:text-gray-800"
        >
          <MovingChevron down={isExpanded} />
          <span>Representations ({representations.length})</span>
        </button>

        <button
          onClick={() => setShowForm(true)}
          className="p-1 text-gray-400 hover:text-gray-600"
          title="Add new representation"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
        </button>
      </div>

      {showForm && (
        <RepresentationForm
          onAddComponent={handleAddComponent}
          onCancel={() => setShowForm(false)}
        />
      )}

      {isExpanded && !showForm && (
        <div className="pl-4 space-y-2">
          {representations.length > 0 ? (
            representations.map((rep, index) => (
              <RepresentationItem
                key={index}
                representation={rep}
                onChangeRepresentation={changeRepresentation}
                onRemove={() => {
                  const plugin = (window.molstar as HorusMolstar).plugin!;
                  const component = structure.structureRef.components.find(
                    (comp) => comp.representations.includes(rep.ref),
                  );
                  if (component) {
                    plugin.managers.structure.hierarchy.remove(
                      [component],
                      true,
                    );
                  }
                }}
              />
            ))
          ) : (
            <div className="text-xs text-gray-500 italic">
              No representations available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
