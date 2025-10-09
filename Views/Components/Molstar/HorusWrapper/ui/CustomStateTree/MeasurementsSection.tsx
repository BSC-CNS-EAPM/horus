import { useState, useEffect } from "react";
import { MovingChevron } from "../../../../../Components/reusable";
import { PluginCommands } from "molstar/lib/mol-plugin/commands";
import { StructureMeasurementCell } from "molstar/lib/mol-plugin-state/manager/structure/measurement";
import { Loci } from "molstar/lib/mol-model/loci";
import { DistanceData } from "molstar/lib/mol-repr/shape/loci/distance";
import { AngleData } from "molstar/lib/mol-repr/shape/loci/angle";
import { DihedralData } from "molstar/lib/mol-repr/shape/loci/dihedral";
import { LabelData } from "molstar/lib/mol-repr/shape/loci/label";
import { OrientationData } from "molstar/lib/mol-repr/shape/loci/orientation";
import {
  angleLabel,
  dihedralLabel,
  distanceLabel,
  lociLabel,
  structureElementLociLabelMany
} from "molstar/lib/mol-theme/label";
import { FiniteArray } from "molstar/lib/mol-util/type-helpers";
import HorusMolstar from "../../horusmolstar";
import { IconTrash, IconRulerMeasure, IconPointer } from "@tabler/icons-react";
import { useCellVisibility } from "./hooks";

interface MeasurementItemProps {
  cell: StructureMeasurementCell;
  type: "distance" | "angle" | "dihedral" | "label" | "orientation" | "plane";
}

function MeasurementItem({ cell, type }: MeasurementItemProps) {
  const plugin = (window.molstar as HorusMolstar).plugin!;

  const getSelections = () => {
    return cell.obj?.data.sourceData as
      | Partial<
          DistanceData & AngleData & DihedralData & LabelData & OrientationData
        >
      | undefined;
  };

  const deleteMeasurement = () => {
    PluginCommands.State.RemoveObject(plugin, {
      state: cell.parent!,
      ref: cell.transform.parent,
      removeParentGhosts: true
    });
  };

  const { isVisible, toggleVisibility } = useCellVisibility(cell);

  const highlight = () => {
    const selections = getSelections();
    if (!selections) return;

    plugin.managers.interactivity.lociHighlights.clearHighlights();
    for (const loci of getLociArray()) {
      plugin.managers.interactivity.lociHighlights.highlight({ loci }, false);
    }
    const reprLocis = cell.obj?.data.repr.getAllLoci();
    if (reprLocis) {
      for (const loci of reprLocis) {
        plugin.managers.interactivity.lociHighlights.highlight({ loci }, false);
      }
    }
  };

  const clearHighlight = () => {
    plugin.managers.interactivity.lociHighlights.clearHighlights();
  };

  const focus = () => {
    const selections = getSelections();
    if (!selections) return;

    const sphere = Loci.getBundleBoundingSphere({ loci: getLociArray() });
    if (sphere) {
      plugin.managers.camera.focusSphere(sphere);
    }
  };

  const getLociArray = (): FiniteArray<Loci> => {
    const selections = getSelections();
    if (!selections) return [];
    if (selections.infos && selections.infos[0])
      return [selections.infos[0].loci];
    if (selections.pairs && selections.pairs[0])
      return selections.pairs[0].loci;
    if (selections.triples && selections.triples[0])
      return selections.triples[0].loci;
    if (selections.quads && selections.quads[0])
      return selections.quads[0].loci;
    if (selections.locis) return selections.locis;
    return [];
  };

  const getLabel = () => {
    const selections = getSelections();

    if (!selections) return "<empty>";
    if (selections.infos && selections.infos[0])
      return lociLabel(selections.infos[0].loci, { condensed: true });
    if (selections.pairs && selections.pairs[0])
      return distanceLabel(selections.pairs[0], {
        condensed: true,
        unitLabel:
          plugin.managers.structure.measurement.state.options.distanceUnitLabel
      });
    if (selections.triples && selections.triples[0])
      return angleLabel(selections.triples[0], { condensed: true });
    if (selections.quads && selections.quads[0])
      return dihedralLabel(selections.quads[0], { condensed: true });
    if (selections.locis)
      return structureElementLociLabelMany(selections.locis, {
        countsOnly: true
      });
    return "<empty>";
  };

  const { obj } = cell;
  if (!obj) return null;

  return (
    <div
      className="flex items-center p-2 justify-between bg-gray-50 border border-gray-200 rounded text-sm hover:bg-gray-100 transition-colors"
      onMouseEnter={highlight}
      onMouseLeave={clearHighlight}
    >
      <button
        className="flex-1 text-left text-gray-700 text-xs truncate overflow-hidden"
        title="Click to focus. Hover to highlight."
        onClick={focus}
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }}
        dangerouslySetInnerHTML={{ __html: getLabel() }}
      />
      <div className="flex items-center space-x-1">
        <input
          type="checkbox"
          checked={isVisible}
          onChange={toggleVisibility}
          className="h-4 w-4 rounded border-gray-300"
        />
        <button
          onClick={deleteMeasurement}
          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
          title={`Delete ${type} measurement`}
        >
          <IconTrash size={14} />
        </button>
      </div>
    </div>
  );
}

// Create a standalone measurements card (not tied to structures)
export function MeasurementsCard() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [measurementsByType, setMeasurementsByType] = useState<{
    labels: StructureMeasurementCell[];
    distances: StructureMeasurementCell[];
    angles: StructureMeasurementCell[];
    dihedrals: StructureMeasurementCell[];
    orientations: StructureMeasurementCell[];
    planes: StructureMeasurementCell[];
  }>({
    labels: [],
    distances: [],
    angles: [],
    dihedrals: [],
    orientations: [],
    planes: []
  });

  const plugin = (window.molstar as HorusMolstar).plugin!;

  useEffect(() => {
    if (!plugin) return;

    const updateMeasurements = () => {
      try {
        const measurementState = plugin.managers.structure.measurement.state;
        setMeasurementsByType({
          labels: measurementState.labels
            ? Array.from(measurementState.labels.values())
            : [],
          distances: measurementState.distances
            ? Array.from(measurementState.distances.values())
            : [],
          angles: measurementState.angles
            ? Array.from(measurementState.angles.values())
            : [],
          dihedrals: measurementState.dihedrals
            ? Array.from(measurementState.dihedrals.values())
            : [],
          orientations: measurementState.orientations
            ? Array.from(measurementState.orientations.values())
            : [],
          planes: measurementState.planes
            ? Array.from(measurementState.planes.values())
            : []
        });
      } catch (error) {
        console.warn("Failed to update measurements:", error);
        setMeasurementsByType({
          labels: [],
          distances: [],
          angles: [],
          dihedrals: [],
          orientations: [],
          planes: []
        });
      }
    };

    // Initial load
    updateMeasurements();

    // Subscribe to state changes - use a more general subscription
    const subscription = plugin.state.data.events.changed.subscribe(() => {
      updateMeasurements();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [plugin]);

  const getAllMeasurements = () => {
    return [
      ...measurementsByType.labels.map((cell) => ({
        cell,
        type: "label" as const
      })),
      ...measurementsByType.distances.map((cell) => ({
        cell,
        type: "distance" as const
      })),
      ...measurementsByType.angles.map((cell) => ({
        cell,
        type: "angle" as const
      })),
      ...measurementsByType.dihedrals.map((cell) => ({
        cell,
        type: "dihedral" as const
      })),
      ...measurementsByType.orientations.map((cell) => ({
        cell,
        type: "orientation" as const
      })),
      ...measurementsByType.planes.map((cell) => ({
        cell,
        type: "plane" as const
      }))
    ];
  };

  const allMeasurements = getAllMeasurements();
  const totalCount = allMeasurements.length;

  const clearAllMeasurements = async () => {
    if (
      await confirm(
        `Are you sure you want to delete all ${totalCount} measurements?`
      )
    ) {
      try {
        const promises = allMeasurements.map(({ cell }) =>
          PluginCommands.State.RemoveObject(plugin, {
            state: cell.parent!,
            ref: cell.transform.parent,
            removeParentGhosts: true
          })
        );
        await Promise.all(promises);
      } catch (error) {
        console.error("Failed to clear all measurements:", error);
      }
    }
  };

  const renderMeasurementGroup = (
    cells: StructureMeasurementCell[],
    type: keyof typeof measurementsByType,
    title: string
  ) => {
    if (cells.length === 0) return null;

    return (
      <div className="space-y-1">
        <div className="text-xs font-medium text-gray-600 uppercase tracking-wide px-1">
          {title} ({cells.length})
        </div>
        {cells.map((cell) => (
          <MeasurementItem
            key={cell.obj?.id || `${type}-${cells.indexOf(cell)}`}
            cell={cell}
            type={type as any}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm m-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors rounded-t-lg"
      >
        <div className="flex items-center space-x-2">
          <IconRulerMeasure size={16} className="text-blue-600" />
          <span className="font-medium text-gray-700">
            Measurements {totalCount > 0 && `(${totalCount})`}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {totalCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearAllMeasurements();
              }}
              className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
              title="Delete all measurements"
            >
              Clear All
            </button>
          )}
          <MovingChevron down={isExpanded} />
        </div>
      </button>

      {isExpanded && (
        <div className="p-3 space-y-3">
          {totalCount === 0 ? (
            <div className="text-center py-4 text-gray-500 text-sm">
              No measurements found. Use the measurement tool{" "}
              <IconPointer size={12} className="inline" /> to create some.
            </div>
          ) : (
            <div className="space-y-3">
              {renderMeasurementGroup(
                measurementsByType.labels,
                "labels",
                "Labels"
              )}
              {renderMeasurementGroup(
                measurementsByType.distances,
                "distances",
                "Distances"
              )}
              {renderMeasurementGroup(
                measurementsByType.angles,
                "angles",
                "Angles"
              )}
              {renderMeasurementGroup(
                measurementsByType.dihedrals,
                "dihedrals",
                "Dihedrals"
              )}
              {renderMeasurementGroup(
                measurementsByType.orientations,
                "orientations",
                "Orientations"
              )}
              {renderMeasurementGroup(
                measurementsByType.planes,
                "planes",
                "Planes"
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
