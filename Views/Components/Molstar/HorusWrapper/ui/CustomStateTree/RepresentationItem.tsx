import TrashIcon from "@/Components/Toolbar/Icons/Trash";
import { RepresentationDropdown } from "./RepresentationDropdown";
import {
  COLOR_TYPES,
  OnChangeRepresentationParams,
  RepresentationInfo,
  SIZE_THEME_OPTIONS
} from "./types";
import HorusMolstar from "../../horusmolstar";
import EyeIcon from "@/Components/Toolbar/Icons/Eye";
import { useEffect, useMemo, useState } from "react";
import { StructureRepresentationRegistry } from "molstar/lib/mol-repr/structure/registry";
import { Color } from "molstar/lib/mol-util/color";
import { MovingChevron } from "@/Components/reusable";
import { StructureRepresentationRef } from "molstar/lib/mol-plugin-state/manager/structure/hierarchy-state";
import { PluginContext } from "molstar/lib/mol-plugin/context";
import { StateSelection } from "molstar/lib/mol-state";
import { StateTransforms } from "molstar/lib/mol-plugin-state/transforms";

interface RepresentationItemProps {
  representation: RepresentationInfo;
  onChangeRepresentation: (options: OnChangeRepresentationParams) => void;
  onRemove: () => void;
}

export function RepresentationItem({
  representation,
  onChangeRepresentation,
  onRemove
}: RepresentationItemProps) {
  const plugin = (window.molstar as HorusMolstar).plugin!;

  const [showColorOptions, setShowColorOptions] = useState(false);
  const [showSizeOptions, setShowSizeOptions] = useState(false);
  const [selectedRepresentation, setSelectedRepresentation] =
    useState<StructureRepresentationRegistry.BuiltIn>(
      representation.type as StructureRepresentationRegistry.BuiltIn
    );
  const [selectedColorTheme, setSelectedColorTheme] = useState(
    getCurrentColorTheme(representation.ref)
  );
  const [selectedSizeTheme, setSelectedSizeTheme] = useState(
    getCurrentSizeTheme(representation.ref)
  );
  const [customColor, setCustomColor] = useState<string>(
    getUniformColor(representation.ref)
  );
  const [uniformSize, setUniformSize] = useState(
    getCurrentSize(representation.ref)
  );
  const [opacity, setOpacity] = useState(
    getCurrentTransparency(representation.ref, plugin)
  );

  const [domain, setDomain] = useState<[number, number]>(
    getDomain(representation.ref)
  );

  const lociList = useMemo(
    () => representation.ref.cell.obj?.data.repr.getAllLoci(),
    []
  );

  const focusRepresentation = () => {
    if (lociList && lociList.length > 0) {
      plugin!.managers.camera.focusLoci(lociList, {
        extraRadius: 4,
        minRadius: 8,
        durationMs: 250
      });
    }
  };

  const highlighRepresentation = () => {
    lociList?.forEach((l) => {
      plugin!.managers.interactivity.lociHighlights.highlight({
        loci: l
      });
    });
  };

  const clearHighlight = () => {
    plugin.managers.interactivity.lociHighlights.clearHighlights();
  };

  useEffect(() => {
    onChangeRepresentation({
      repRef: representation.ref,
      repId: selectedRepresentation,
      opacity,
      colorTheme: {
        name: selectedColorTheme,
        params: {
          domain: domain,
          value:
            typeof customColor === "string"
              ? Color.fromHexStyle(customColor)
              : undefined
        }
      },
      sizeTheme: {
        name: selectedSizeTheme,
        params: {
          value: uniformSize
        }
      }
    });
  }, [
    domain,
    opacity,
    selectedRepresentation,
    selectedColorTheme,
    customColor,
    selectedSizeTheme,
    uniformSize
  ]);

  return (
    <div
      className="flex flex-col py-2 px-3 bg-gray-50 rounded border hover:bg-gray-100"
      onMouseOver={highlighRepresentation}
      onMouseLeave={clearHighlight}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex flex-col space-y-1 flex-grow">
          <div className="font-medium text-gray-700">
            {representation.componentLabel}
          </div>

          <RepresentationDropdown
            representation={representation}
            onChangeRepresentation={(r) => setSelectedRepresentation(r)}
          />
        </div>
        <div className="flex items-center space-x-1">
          <button
            className="p-1 text-gray-400 hover:text-blue-600"
            onClick={focusRepresentation}
            title="Focus on structure"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={onRemove}
            className="p-1 text-gray-400 hover:text-red-500"
            title="Remove representation"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
      <hr />

      <div
        className="w-full flex flex-row gap-2 justify-between my-2"
        onClick={() => setShowColorOptions(!showColorOptions)}
      >
        <button className="text-gray-600 font-bold">Color</button>
        <MovingChevron down={showColorOptions} />
      </div>

      {showColorOptions && (
        <div className="flex flex-col gap-2">
          {/* Color theme selector */}
          <div className="flex flex-row gap-2 items-center">
            <span>Theme:</span>
            <select
              value={selectedColorTheme}
              onChange={(e) => setSelectedColorTheme(e.target.value)}
              className="w-full border rounded px-2 py-1"
            >
              {COLOR_TYPES.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* B-factor color options */}
          {selectedColorTheme === "uncertainty" && (
            <div className="flex flex-row gap-2 items-center">
              <label className="text-gray-600">Domain</label>
              <input
                type="number"
                value={domain[0] || ""}
                onChange={(e) =>
                  setDomain([parseFloat(e.target.value), domain[1] ?? 0])
                }
                className="w-16 border rounded px-2 py-1"
                placeholder="Minimum B-Factor"
              />
              <input
                type="number"
                value={domain[1] || ""}
                onChange={(e) =>
                  setDomain([domain[0] ?? 0, parseFloat(e.target.value)])
                }
                className="w-16 border rounded px-2 py-1"
                placeholder="Maximum B-Factor"
              />
            </div>
          )}

          {/* Uniform color options */}
          {selectedColorTheme === "uniform" && (
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="w-8 h-6 border rounded"
              />
              <input
                type="text"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="flex-1 border rounded px-2 py-1"
                placeholder="#FF0000"
              />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-gray-600 flex justify-between">
              <span>Opacity</span>
              <span className="text-gray-500">{(1 - opacity).toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={1 - opacity}
              onChange={(e) => {
                const transparency = parseFloat(e.target.value);
                setOpacity(1 - transparency); // Convert transparency back to opacity
              }}
              className="w-full"
            />
          </div>
        </div>
      )}

      <hr />

      <div
        className="w-full flex flex-row gap-2 justify-between my-2"
        onClick={() => setShowSizeOptions(!showSizeOptions)}
      >
        <button className="text-gray-600 font-bold mb-1">Size</button>
        <MovingChevron down={showSizeOptions} />
      </div>

      {showSizeOptions && (
        <>
          {/* Size theme selector */}
          <div className="flex flex-row gap-2 items-center">
            <span>Theme:</span>
            <select
              value={selectedSizeTheme}
              onChange={(e) => setSelectedSizeTheme(e.target.value)}
              className="w-full border rounded px-2 py-1"
            >
              {SIZE_THEME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Size parameter input */}
          {selectedSizeTheme === "uniform" && (
            <div className="flex items-center space-x-2">
              <label>Factor:</label>
              <input
                type="number"
                value={uniformSize}
                onChange={(e) =>
                  setUniformSize(parseFloat(e.target.value) || 1.0)
                }
                min="0.1"
                max="5.0"
                step="0.1"
                className="flex-1 border rounded px-2 py-1"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

const getCurrentColorTheme = (representation: StructureRepresentationRef) => {
  const colorTheme = representation.cell.transform.params?.colorTheme;
  return colorTheme?.name?.toLowerCase() || "uniform";
};

const getCurrentSizeTheme = (representation: StructureRepresentationRef) => {
  const sizeTheme = representation.cell.transform.params?.sizeTheme;
  return sizeTheme?.name || "uniform";
};

const getCurrentSize = (representation: StructureRepresentationRef) => {
  const sizeTheme = representation.cell.transform.params?.sizeTheme;
  return sizeTheme?.params.value ?? 1;
};

const getCurrentTransparency = (
  representation: StructureRepresentationRef,
  plugin: PluginContext
): number => {
  // Look for transparency transforms applied to this representation
  const transparencyStates = plugin.state.data.select(
    StateSelection.Generators.ofTransformer(
      StateTransforms.Representation
        .TransparencyStructureRepresentation3DFromBundle,
      representation.cell.transform.ref
    )
  );

  if (transparencyStates.length > 0) {
    const transparencyCell = transparencyStates[0];
    const layers = transparencyCell?.params?.values?.layers || [];
    // Return the first layer's transparency value, or 0 if no layers
    return layers.length > 0 ? layers[0].value : 0;
  }

  return 0; // No transparency applied
};

const getUniformColor = (
  representation: StructureRepresentationRef
): string => {
  const colorTheme = representation.cell.transform.params?.colorTheme;
  const isUniform = colorTheme?.name === "uniform";
  if (!isUniform) return "#0000FF";
  return Color.toHexStyle(colorTheme?.params?.value) ?? "#0000FF";
};

const getDomain = (
  representation: StructureRepresentationRef
): [number, number] => {
  const colorTheme = representation.cell.transform.params?.colorTheme;
  if (colorTheme?.name === "uncertainty") {
    return colorTheme.params?.domain || [0, 100];
  }
  return [0, 0];
};
