import { useState, useRef, useEffect } from "react";
import { StructureRepresentationRegistry } from "molstar/lib/mol-repr/structure/registry";
import { ColorTheme } from "molstar/lib/mol-theme/color";
import { SelectionLanguage } from "../../horusmolstar";
import AppButton from "@/Components/appbutton";
import { MovingChevron } from "@/Components/reusable";
import {
  AddComponentParams,
  REPRESENTATIONS,
  SELECTION_LANGUAGES,
  COLOR_TYPES,
  SIZE_THEME_OPTIONS
} from "./types";
import { SizeTheme } from "molstar/lib/mol-theme/size";

interface RepresentationFormProps {
  onAddComponent: (params: AddComponentParams) => void;
  onCancel: () => void;
  initialSelection?: string;
  initialLoci?: any;
}

export function RepresentationForm({
  onAddComponent,
  onCancel,
  initialSelection = "",
  initialLoci
}: RepresentationFormProps) {
  const [selection, setSelection] = useState(initialSelection);
  const [label, setLabel] = useState("Custom selection");
  const [language, setLanguage] = useState<SelectionLanguage>("vmd");
  const [representation, setRepresentation] =
    useState<StructureRepresentationRegistry.BuiltIn>("ball-and-stick");
  const [color, setColor] = useState<ColorTheme.BuiltIn>("uniform");
  const [customColor, setCustomColor] = useState("#FF0000");
  const [opacity, setOpacity] = useState(0);
  const [sizeTheme, setSizeTheme] = useState<SizeTheme.BuiltIn>("uniform");
  const [uniformSize, setUniformSize] = useState(1);
  const [showColorOptions, setShowColorOptions] = useState(false);
  const [showSizeOptions, setShowSizeOptions] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const hasLoci = !!initialLoci;

  useEffect(() => {
    if (!hasLoci) {
      inputRef.current?.focus();
    }

    // If we have a loci, set a default label based on the selection
    if (hasLoci && initialSelection) {
      setLabel(initialSelection);
    }
  }, [hasLoci, initialSelection]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const params: AddComponentParams = {
      label,
      representation: representation,
      representationParams: {
        name: label,
        params: {}
      },
      color: color,
      colorParams: {
        value: customColor
      },
      opacity,

      size: sizeTheme,
      sizeParams: {
        value: uniformSize
      }
    };

    if (hasLoci) {
      params.loci = initialLoci;
    } else {
      if (!selection.trim()) return;
      params.script = selection.trim();
      params.language = language;
    }

    onAddComponent(params);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-3 bg-gray-50 rounded border space-y-3"
    >
      {!hasLoci && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Selection Script
          </label>
          <input
            ref={inputRef}
            type="text"
            value={selection}
            onChange={(e) => setSelection(e.target.value)}
            placeholder="e.g., resid 1 to 100"
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
          />
        </div>
      )}

      {hasLoci && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Selected Component
          </label>
          <div className="px-2 py-1 text-xs bg-gray-100 border border-gray-300 rounded text-gray-700">
            {initialSelection}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {!hasLoci && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as SelectionLanguage)}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
            >
              {SELECTION_LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={hasLoci ? "col-span-2" : ""}>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Representation
          </label>
          <select
            value={representation}
            onChange={(e) =>
              setRepresentation(
                e.target.value as StructureRepresentationRegistry.BuiltIn
              )
            }
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
          >
            {REPRESENTATIONS.map((rep) => (
              <option key={rep.id} value={rep.id}>
                {rep.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Color Section */}
      <div className="border rounded p-2">
        <div
          className="w-full flex flex-row gap-2 justify-between cursor-pointer"
          onClick={() => setShowColorOptions(!showColorOptions)}
        >
          <span className="text-xs font-medium text-gray-700">Color</span>
          <MovingChevron down={showColorOptions} />
        </div>

        {showColorOptions && (
          <div className="mt-2 space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Color Theme
              </label>
              <select
                value={color}
                onChange={(e) => setColor(e.target.value as ColorTheme.BuiltIn)}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
              >
                {COLOR_TYPES.map((colorType) => (
                  <option key={colorType.id} value={colorType.id}>
                    {colorType.label}
                  </option>
                ))}
              </select>
            </div>

            {color === "uniform" && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Color
                </label>
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
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                    placeholder="#FF0000"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 flex justify-between">
                <span>Opacity</span>
                <span className="text-gray-500">
                  {(1 - opacity).toFixed(2)}
                </span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={1 - opacity}
                onChange={(e) => {
                  const transparency = parseFloat(e.target.value);
                  setOpacity(1 - transparency);
                }}
                className="w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* Size Section */}
      <div className="border rounded p-2">
        <div
          className="w-full flex flex-row gap-2 justify-between cursor-pointer"
          onClick={() => setShowSizeOptions(!showSizeOptions)}
        >
          <span className="text-xs font-medium text-gray-700">Size</span>
          <MovingChevron down={showSizeOptions} />
        </div>

        {showSizeOptions && (
          <div className="mt-2 space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Size Theme
              </label>
              <select
                value={sizeTheme}
                onChange={(e) =>
                  setSizeTheme(e.target.value as SizeTheme.BuiltIn)
                }
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
              >
                {SIZE_THEME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {sizeTheme === "uniform" && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Size Factor
                </label>
                <input
                  type="number"
                  value={uniformSize}
                  onChange={(e) =>
                    setUniformSize(parseFloat(e.target.value) || 1.0)
                  }
                  min="0.1"
                  max="5.0"
                  step="0.1"
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex space-x-2 pt-2">
        <AppButton type="submit">Add Component</AppButton>
        <AppButton action={onCancel}>Cancel</AppButton>
      </div>
    </form>
  );
}
