// React
import {
  useEffect,
  useState,
  useRef,
  useMemo,
  ChangeEvent,
  useCallback,
} from "react";

// SMILES variable
// @ts-ignore - JSME is not typed
import { Jsme } from "jsme-react";

// Horus TS types
import {
  CustomVariable,
  PluginVariable,
  PluginVariableTypes,
  VariableGroup,
} from "../flow.types";

// Components
import AppButton from "../../appbutton";
import Slider from "rc-slider";
import HorusSwitch from "../../Switch/switch";
import { SearchComponent } from "../../Toolbar/toolbar";
import { HorusFileExplorer } from "../../FileExplorer/file_explorer";
import { AtomInfo, SphereRef } from "../../Molstar/HorusWrapper/horusmolstar";
import { Color } from "molstar/lib/mol-util/color";
import LockIcon from "../../Toolbar/Icons/Lock";

// Utility function to open an extension
import { loadPage } from "../../Toolbar/extensions_list";

// Styles
import "rc-slider/assets/index.css";
import CrossIcon from "../../Toolbar/Icons/Cross";
import { createPortal } from "react-dom";
import { FlowBuilderIDs } from "../flow.view";
import { BlurredModal } from "../../reusable";

type PluginVariableViewProps = {
  variable: PluginVariable;
  onChange: (value: any, id: string, groupID?: string) => void;
  hideName?: boolean;
  hideDescription?: boolean;
  applyStyle?: boolean;
  customClass?: string;
  placeholder?: string;
};

export function PluginVariableView(props: PluginVariableViewProps) {
  const { variable, onChange, hideName } = props;

  const handleChange = (value: any) => {
    if (!variable.disabled) {
      onChange(value, variable.id);
    }
  };

  // If the variable is any of the list types or the group, always ocuppy the whole width using min-w-full
  const widthStyle = useMemo(() => {
    switch (variable.type) {
      case PluginVariableTypes._LIST:
      case PluginVariableTypes.LIST:
      case PluginVariableTypes.GROUP:
        return { minWidth: "100%" };
      default:
        return {};
    }
  }, [variable.type]);

  if (variable.type === PluginVariableTypes.GROUP) {
    return (
      <GroupVariableView
        onChange={handleChange}
        variable={variable}
        hideName={hideName ?? false}
        hideDescription={props.hideDescription ?? false}
      />
    );
  }

  return (
    <div
      className={`${variable.disabled && "cursor-not-allowed "} ${
        props.applyStyle === false
          ? props.customClass ?? "flex-auto"
          : "plugin-variable animated-gradient border-none"
      }`}
      style={{
        ...widthStyle,
      }}
    >
      <div>
        {!hideName && (
          <span
            style={{
              marginRight: "0.5rem",
            }}
            className={`${
              props.hideDescription
                ? "plugin-variable-description"
                : "plugin-variable-name"
            }`}
          >
            {variable.name}
          </span>
        )}
        {!props.hideDescription && (
          <span className="plugin-variable-description">
            {variable.description}
          </span>
        )}
        {variable.disabled && (
          <LockIcon
            style={{
              display: "inline",
              transform: "translateY(-3px)",
            }}
          />
        )}
      </div>
      <div
        className={`plugin-variable-value flex justify-start w-full`}
        style={{
          pointerEvents: variable.disabled ? "none" : "auto",
        }}
      >
        <VariableRenderer variable={variable} onChange={handleChange} />
      </div>
    </div>
  );
}

function VariableListView(props: VariableViewProps) {
  const { variable, currentValue, onChange } = props;
  const addRow = () => {
    const newValues = currentValue ? [...currentValue] : [];

    // Push a new value that contains an array of objects representing each variable and its default value
    newValues.push(
      variable.variables!.reduce((acc: any, variable) => {
        if (variable.type === PluginVariableTypes.GROUP) {
          acc[variable.id] = variable.variables!.reduce((acc, variable) => {
            acc[variable.id] = variable.defaultValue ?? null;
            return acc;
          }, {} as any);
        } else {
          acc[variable.id] = variable.defaultValue ?? null;
        }
        return acc;
      }, {})
    );

    onChange(newValues);
  };

  const removeRow = (index: number) => {
    if (!currentValue) return;
    const newValues = [...currentValue];
    newValues.splice(index, 1);
    onChange(newValues);
  };

  const internalOnChange = (
    index: number,
    value: any,
    id: string,
    groupID?: string
  ) => {
    // Update the corresponding index on the values array
    const newValues = [...currentValue];

    if (groupID) {
      newValues[index][groupID][id] = value;
    } else {
      newValues[index][id] = value;
    }

    onChange(newValues);
  };

  const variableViewsUpdated = (
    index: number,
    value: any,
    variable: PluginVariable
  ) => {
    const updatedVariable: PluginVariable = {
      ...variable,
      value: value[variable.id],
      disabled: props.variable.disabled,
    };

    return (
      <div className="h-full w-full flex flex-col gap-1 justify-between flex-grow">
        <div
          className="w-full whitespace-nowrap"
          style={{
            // minWidth: "fit-content",
            marginTop: "0.5rem",
            paddingBottom: "0.5rem",
            opacity: index === 0 ? 1 : 0,
            position: index === 0 ? "relative" : "absolute",
            display: index === 0 ? "block" : "none",
          }}
        >
          {variable.name}
        </div>

        <PluginVariableView
          variable={updatedVariable}
          onChange={(value: any, id: string, groupID?: string) => {
            internalOnChange(index, value, id, groupID);
          }}
          hideDescription={true}
          applyStyle={false}
          hideName={true}
          customClass="h-full justify-start min-w-[150px] flex items-center"
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-row gap-2 justify-center my-2 mb-2">
        <AppButton action={addRow}>Add row</AppButton>
        <AppButton
          action={() => {
            onChange([]);
          }}
        >
          Clear
        </AppButton>
      </div>
      {currentValue?.length > 0 && (
        <div className="flex flex-col pb-2 gap-1 justify-between items-center overflow-x-scroll w-full">
          {currentValue?.map((value: any, index: number) => (
            <div className="w-full zoom-out-animation flex flex-row gap-2 h-full items-end">
              <div className="flex flex-row gap-2 items-end px-2 h-full justify-between w-full flex-grow">
                {variable.variables!.map((variable) => {
                  return variableViewsUpdated(index, value, variable);
                })}
                <button
                  className="flex justify-center items-center w-6"
                  onClick={() => removeRow(index)}
                >
                  <CrossIcon stroke="red" className="p-0 m-0 w-6 h-6" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupVariableView(props: PluginVariableViewProps) {
  const variables = props.variable.variables;

  const onChange = (value: any, id: string) => {
    props.onChange(value, id, props.variable.id);
  };

  return (
    <div className="plugin-variable">
      <span className="plugin-variable-name">{props.variable.name}</span>
      <div className="flex flex-wrap flex-row gap-2 justify-center">
        {variables!.map((variable) => {
          variable.disabled = props.variable.disabled;
          return (
            <PluginVariableView
              variable={variable}
              onChange={onChange}
              hideName={props.hideName ?? false}
              hideDescription={props.hideDescription ?? false}
              applyStyle={false}
            />
          );
        })}
      </div>
    </div>
  );
}

function VariableRenderer(props: {
  variable: PluginVariable;
  onChange: (value: any) => void;
}) {
  // Extract the variable from the props
  const { variable: variableToRender, onChange } = props;

  // Assign a state to the current value to prevent re-renders when the actual variable object
  // changes
  const [currentValue, setCurrentValue] = useState(variableToRender.value);

  const handleVariableChangeInternal = (value: any) => {
    onChange(value);
    setCurrentValue(value);
  };

  useEffect(() => {
    // Assign the variable value that comes from the object to the
    // initial currentValue
    setCurrentValue(variableToRender.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Notice the empty dependency array so that the value is not updated with the variable

  if (variableToRender?.isCustom) {
    return (
      <CustomVariableRenderer
        variable={variableToRender as CustomVariable}
        onChange={onChange}
      />
    );
  }

  switch (variableToRender.type) {
    case PluginVariableTypes.STRING:
    case PluginVariableTypes.ANY:
      return (
        <StringVariableView
          currentValue={currentValue}
          variable={variableToRender}
          onChange={handleVariableChangeInternal}
        />
      );
    case PluginVariableTypes.TEXT_AREA:
      return (
        <TextAreaVariableView
          currentValue={currentValue}
          variable={variableToRender}
          onChange={handleVariableChangeInternal}
        />
      );
    case PluginVariableTypes.INTEGER:
    case PluginVariableTypes.FLOAT:
    case PluginVariableTypes.NUMBER:
      return (
        <IntegerFloatVariableView
          currentValue={currentValue}
          variable={variableToRender}
          onChange={handleVariableChangeInternal}
        />
      );
    case PluginVariableTypes.BOOLEAN:
      return (
        <div className="flex flex-row w-full justify-center items-center">
          <HorusSwitch
            setEnabled={handleVariableChangeInternal}
            enabled={currentValue as boolean}
          />
        </div>
      );
    case PluginVariableTypes.STRING_LIST:
    case PluginVariableTypes.NUMBER_LIST:
      // If the current value is not set, set i to the first allowed value
      if (!currentValue && variableToRender.allowedValues) {
        handleVariableChangeInternal(variableToRender.allowedValues[0]);
      }

      return (
        <select
          style={{ border: "none", outline: "none", WebkitAppearance: "none" }}
          value={currentValue}
          onChange={(e) => handleVariableChangeInternal(e.target.value as any)}
        >
          {props.variable.allowedValues?.map((value, index) => (
            <option key={index} value={value}>
              {value}
            </option>
          ))}
        </select>
      );
    case PluginVariableTypes.NUMBER_RANGE:
      return (
        <SliderVariableView
          variable={variableToRender}
          currentValue={currentValue}
          onChange={handleVariableChangeInternal}
        />
      );
    case PluginVariableTypes.CONSTRAINED_NUMBER_RANGE:
      return (
        <ConstrainedSliderVariableView
          variable={variableToRender}
          currentValue={currentValue}
          onChange={handleVariableChangeInternal}
        />
      );
    case PluginVariableTypes.LIST:
      return (
        <ListView
          currentValue={currentValue}
          variable={props.variable}
          onChange={handleVariableChangeInternal}
        />
      );
    case PluginVariableTypes._LIST:
      return (
        <VariableListView
          currentValue={currentValue}
          variable={props.variable}
          onChange={handleVariableChangeInternal}
        />
      );

    case PluginVariableTypes.FILE:
    case PluginVariableTypes.FOLDER:
      return (
        <FilePickerView
          currentValue={currentValue}
          openFolder={props.variable.type === PluginVariableTypes.FOLDER}
          variable={props.variable}
          onChange={handleVariableChangeInternal}
        />
      );

    case PluginVariableTypes.STRUCTURE:
      return (
        <StructureVariableView
          currentValue={currentValue}
          variable={props.variable}
          onChange={handleVariableChangeInternal}
        />
      );

    case PluginVariableTypes.HETERORES:
      return (
        <HeteroResView
          currentValue={currentValue}
          onChange={handleVariableChangeInternal}
          variable={props.variable}
        />
      );

    case PluginVariableTypes.STDRES:
      return (
        <StdResView
          currentValue={currentValue}
          onChange={handleVariableChangeInternal}
          variable={props.variable}
        />
      );

    case PluginVariableTypes.CHAIN:
      return (
        <ChainView
          currentValue={currentValue}
          onChange={handleVariableChangeInternal}
          variable={props.variable}
        />
      );

    case PluginVariableTypes.RESIDUE:
      return (
        <ResidueView
          currentValue={currentValue}
          onChange={handleVariableChangeInternal}
          variable={props.variable}
        />
      );

    case PluginVariableTypes.ATOM:
      return (
        <AtomView
          currentValue={currentValue}
          onChange={handleVariableChangeInternal}
          variable={props.variable}
        />
      );

    case PluginVariableTypes.SPHERE:
      return (
        <SphereVariableView
          currentValue={currentValue}
          onChange={handleVariableChangeInternal}
          variable={props.variable}
        />
      );

    case PluginVariableTypes.SMILES:
      return (
        <SmilesVariableView
          currentValue={currentValue}
          onChange={handleVariableChangeInternal}
          variable={props.variable}
        />
      );

    default:
      return (
        <div className="red-containerp-2 m-2">
          Variable type not supported: {variableToRender.type}
        </div>
      );
  }
}

type VariableViewProps = {
  variable: PluginVariable;
  currentValue: any;
  onChange: (value: any) => void;
};

function StructureVariableView(props: VariableViewProps) {
  const { currentValue, onChange } = props;

  const [structures, setStructures] = useState<any[]>([]);

  const loadMolstarStructures = useCallback(() => {
    const molstar = window.molstar;
    const structList = molstar?.listStructures();

    if (!structList) return;

    setStructures(structList);

    // Set the first structure as the default value if none was selected
    if (!currentValue) {
      onChange(structList[0]);
    }
  }, [currentValue, onChange]);

  useEffect(() => {
    // Load the structures on placing the block and select the first, or if the variable comes with a value, the value
    loadMolstarStructures();
  }, [loadMolstarStructures]);

  return (
    <div onMouseDown={loadMolstarStructures} className="plugin-variable-value">
      {structures.length === 0 ? (
        <div
          role="placeholder"
          className="text-center"
          style={{
            color: "darkgray",
          }}
        >
          No structures loaded
        </div>
      ) : (
        <select
          className="plugin-variable-value p-0"
          defaultValue=""
          value={currentValue?.name}
          defaultChecked={true}
          onChange={(e) => {
            // Get the selected structure
            const selectedStructure = structures.find(
              (structure) => structure.name === e.target.value
            );

            onChange(selectedStructure);
          }}
        >
          {structures.map((structure, index) => (
            <option key={index} value={structure.name} className="p-0 m-0">
              {structure.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function StringVariableView(props: VariableViewProps) {
  return (
    <input
      className="plugin-variable-value"
      id={props.variable.id}
      type="text"
      placeholder={props.variable.placeholder ?? ""}
      value={(props.currentValue as string) ?? ""}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

function TextAreaVariableView(props: VariableViewProps) {
  return (
    <textarea
      className="plugin-variable-value"
      id={props.variable.id}
      placeholder="Write text here..."
      value={(props.currentValue as string) ?? ""}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

function IntegerFloatVariableView(
  props: VariableViewProps & { preventMessage?: boolean }
) {
  const { currentValue, variable, onChange, preventMessage } = props;

  const [numberMessage, setNumberMessage] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseNum(e.target.value);
    parseInsideAllowedValues(value);

    onChange(value);
  };

  const parseNum = (value: string) => {
    if (value === "") {
      setNumberMessage(null);
      return null;
    }

    const parsedValue = Number(value);

    if (isNaN(parsedValue)) {
      setNumberMessage(`The value must be a number`);
      return value;
    } else {
      setNumberMessage(null);
    }

    if (variable.type === PluginVariableTypes.INTEGER) {
      const rounded = Math.round(parsedValue);
      if (isNaN(rounded)) {
        setNumberMessage(`The value must be an integer`);
        return parsedValue;
      } else {
        return rounded;
      }
    } else {
      return value.endsWith(".") ? value : parsedValue;
    }
  };

  const parseInsideAllowedValues = (value: any) => {
    // If no allowedValues are set, return the value
    if (!variable.allowedValues || variable.allowedValues.length === 0) {
      return;
    }
    // If the allowedValues contains the value, return it
    if (variable.allowedValues?.includes(value)) {
      setNumberMessage(null);
    } else {
      // If the value is not in the allowedValues, return the allowedValues
      if (variable.allowedValues) {
        setNumberMessage(
          `The value must be one of the following: ${variable.allowedValues.join(
            ", "
          )}`
        );
      }
    }
  };

  return (
    <div className="flex flex-col gap-2 justify-center text-center items-center w-full">
      {preventMessage && numberMessage && (
        <div className="text-red-500">{numberMessage}</div>
      )}
      <input
        className="plugin-variable-value"
        value={currentValue}
        onChange={handleChange}
      />
    </div>
  );
}

function SliderVariableView(props: VariableViewProps) {
  const { currentValue, variable, onChange } = props;

  const min = variable?.allowedValues?.[0] ?? 0;
  const max = variable?.allowedValues?.[1] ?? 10;
  const step = variable?.allowedValues?.[2] ?? 1;

  let value = variable.value;

  if (value === null || value === undefined) {
    value = min;
    onChange(value);
  }

  if (value < min) {
    value = min;
  } else if (value > max) {
    value = max;
  }

  return (
    <div
      className="flex flex-row p-2 w-full items-end gap-4"
      data-testid="slider-container"
    >
      <Slider
        min={min}
        max={max}
        step={step}
        value={currentValue}
        onChange={onChange}
        style={{
          width: "300%",
        }}
        styles={{
          track: { backgroundColor: "var(--pop-code)" },
          handle: {
            backgroundColor: "var(--vintage-code)",
            border: "none",
            outline: "none",
            opacity: 1,
            borderColor: "black",
          },
        }}
      />
      <IntegerFloatVariableView
        currentValue={currentValue}
        variable={variable}
        onChange={onChange}
      />
      {/* <input className="min-w-[50px]" value={variable.value} /> */}
    </div>
  );
}

function ConstrainedSliderVariableView(props: VariableViewProps) {
  const { currentValue, variable, onChange } = props;

  const min = variable?.allowedValues?.[0] ?? 0;
  const max = variable?.allowedValues?.[1] ?? 10;
  const step = variable?.allowedValues?.[2] ?? 1;

  let value = currentValue;

  if (value === null || value === undefined) {
    value = [min, max];
    onChange(value);
  }

  if (value[0] < min) {
    value[0] = min;
    onChange(value);
  } else if (value[0] > max) {
    value[0] = max;
  } else if (value[1] > max) {
    value[1] = max;
    onChange(value);
  } else if (value[1] < min) {
    value[1] = min;
    onChange(value);
  }

  return (
    <div
      className="flex flex-row p-2 w-full items-end gap-4"
      data-testid="slider-container"
    >
      <IntegerFloatVariableView
        currentValue={value?.[0] ?? min}
        variable={variable}
        onChange={(newValue) => {
          onChange([newValue, value[1] ?? min]);
        }}
      />
      <Slider
        range
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        count={1}
        style={{
          width: "300%",
        }}
        styles={{
          track: { backgroundColor: "var(--pop-code)" },
          handle: {
            backgroundColor: "var(--vintage-code)",
            border: "none",
            outline: "none",
            opacity: 1,
            borderColor: "black",
          },
        }}
      />
      <IntegerFloatVariableView
        currentValue={value?.[1] ?? max}
        variable={variable}
        onChange={(newValue) => {
          onChange([value[0] ?? max, newValue]);
        }}
      />
      {/* <input className="min-w-[50px]" value={variable.value} /> */}
    </div>
  );
}

type FilePickerViewProps = VariableViewProps & {
  openFolder?: boolean;
};

function FilePickerView(props: FilePickerViewProps) {
  const { currentValue, variable, onChange } = props;

  return (
    <div className="flex flex-row gap-2 w-full h-10 p-1 justify-center items-center">
      <input
        id={variable.id}
        placeholder="Write a path or browse..."
        className="overflow-x-auto break-keep-all h-6 plugin-variable-value"
        value={currentValue ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
      <HorusFileExplorer
        onFileConfirm={onChange}
        onFileSelect={onChange}
        openFolder={props.openFolder ?? false}
        allowedExtensions={variable?.allowedValues}
      >
        Browse...
      </HorusFileExplorer>
    </div>
  );
}

function ListView(props: VariableViewProps) {
  const { currentValue, variable, onChange } = props;

  const addRow = () => {
    let newValues = currentValue ? [...currentValue] : [];
    if (variable.allowedValues) {
      newValues.push({
        value: "",
        type: variable?.allowedValues?.[0] ?? PluginVariableTypes.STRING,
      });
    } else {
      newValues = currentValue ? [...currentValue] : [];
      newValues.push("");
    }
    onChange(newValues);
  };

  const removeRow = (index: number) => {
    if (!currentValue) return;
    const newValues = [...currentValue];
    newValues.splice(index, 1);
    onChange(newValues);
  };

  const handleRowValueChange = (index: number, value: string) => {
    const newValues = [...currentValue];
    if (props.variable.allowedValues) {
      newValues[index] = {
        value: value,
        type: variable?.allowedValues?.[0] ?? PluginVariableTypes.STRING,
      };
    } else {
      newValues[index] = value;
    }
    onChange(newValues);
  };

  const handleRowTypeChange = (index: number, type: string) => {
    const newValues = [...currentValue];
    newValues[index] = {
      value: newValues[index].value,
      type: type,
    };
    onChange(newValues);
  };

  return (
    <div className="flex flex-col w-full min-w-full flex-auto">
      <div className="flex flex-row gap-2 justify-center">
        <AppButton action={addRow}>Add row</AppButton>
        <AppButton
          action={() => {
            onChange([]);
          }}
        >
          Clear
        </AppButton>
      </div>
      {currentValue?.length > 0 && (
        <div className="flex flex-col gap-2 pb-2">
          {currentValue?.map((value: any, index: number) => (
            <div className="flex flex-row gap-2 items-center justify-between px-2 zoom-out-animation">
              <input
                id={`${props.variable.id}-${index}`}
                type="text"
                className="plugin-variable-value"
                value={props.variable.allowedValues ? value.value : value}
                onChange={(e) => handleRowValueChange(index, e.target.value)}
              />
              {
                // If the variable has a list of allowed values, set a dropdown
                props.variable.allowedValues && (
                  <select
                    // @ts-ignore
                    placeholder="Select an option"
                    onChange={(e) => handleRowTypeChange(index, e.target.value)}
                  >
                    {props.variable.allowedValues.map((value, index) => (
                      <option key={index} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                )
              }
              <button
                onClick={() => removeRow(index)}
                style={{
                  width: "unset",
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="red"
                  className="w-5 h-5"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SmilesVariableView(props: VariableViewProps) {
  const { currentValue, onChange }: { currentValue: string[]; onChange: any } =
    props;

  const [showJsme, setShowJsme] = useState(false);
  const [currentSmiles, setCurrentSmiles] = useState<string | null>(
    currentValue ? currentValue[0] ?? null : null
  );

  const handleChange = (value: string) => {
    // Split the value by newlines
    const splitValue = value.split("\n");

    setCurrentSmiles(splitValue[0] ?? null);
    onChange(splitValue);
  };

  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0] ?? null;

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const contents = (e.target?.result as string) ?? "";
      handleChange(contents);
    };
    reader.readAsText(file);
    handleDragEnd(e);
  };

  const defaultTextAreaClassName = "plugin-variable-value";

  const [textAreaClassName, setTextAreaClassName] = useState(
    defaultTextAreaClassName
  );

  const handleDragEnd = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setTextAreaClassName(defaultTextAreaClassName);
  };

  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setTextAreaClassName(`${defaultTextAreaClassName} bg-green-200`);
  };

  const jsmeRef = useRef(null);

  return (
    <div className="flex flex-col gap-2 p-2 max-h-60 w-full justify-center items-center">
      <textarea
        placeholder="Write a SMILES or drop a file"
        className={textAreaClassName}
        value={currentValue ? currentValue.join("\n") : ""}
        onChange={(e) => handleChange(e.target.value)}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragEnd}
        onDragEnd={handleDragEnd}
      >
        {currentValue}
      </textarea>
      {currentSmiles && currentSmiles !== "" && (
        <AppButton
          action={() => {
            setShowJsme(!showJsme);
          }}
        >
          Show 2D structure
        </AppButton>
      )}
      {showJsme &&
        createPortal(
          <BlurredModal
            show={true}
            onHide={() => {
              setShowJsme(false);
            }}
          >
            <div className="w-full h-full text-black flex flex-col justify-center items-center">
              <select
                onChange={(e) => {
                  setCurrentSmiles(e.target.value);
                }}
              >
                {currentValue.map((smi) => {
                  return <option value={smi}>{smi}</option>;
                })}
              </select>
              <Jsme
                ref={jsmeRef}
                key="jsme"
                width="50vw"
                height="50vh"
                smiles={currentSmiles}
                options="depict"
              />
              <AppButton action={() => setShowJsme(false)}>Close</AppButton>
            </div>
          </BlurredModal>,
          document.getElementById(FlowBuilderIDs.FLOW_BUILDER_DIV)!
        )}
    </div>
  );
}

function ResidueView(props: VariableViewProps) {
  const { currentValue, onChange } = props;

  const [atom, setAtom] = useState<any>(null);
  const [active, setActive] = useState(false);

  const handleResidueClick = (e: Event) => {
    const atomInfo = (e as CustomEvent)?.detail?.atom;

    if (!atomInfo) return;

    setAtom(atomInfo);
    onChange(atomInfo);

    window.molstar?.plugin.managers.interactivity.lociSelects.deselectAll();
  };

  useEffect(() => {
    if (window.molstar) {
      window.molstar.plugin.selectionMode = active;
      // Set the granularity to element
      window.molstar.plugin.managers.interactivity.setProps({
        granularity: "residue",
      });
      // Unselect selected residues
      window.molstar.plugin.managers.interactivity.lociSelects.deselectAll();
      if (active) {
        // Show structures in cartoon
        window.molstar.addStructureRepresentation(null, "cartoon");
      } else {
        // Show structures in default
        window.molstar.deleteStructureRepresentations();
      }
    }

    if (active) {
      window.addEventListener("molstar-coordinates", handleResidueClick);
    }

    return () => {
      window.removeEventListener("molstar-coordinates", handleResidueClick);
    };
  }, [active]);

  useEffect(() => {
    if (currentValue) {
      setAtom(currentValue);
    }
  }, [currentValue]);

  return (
    <div
      onClick={() => setActive(!active)}
      className={`w-full h-full max-h-28 overflow-auto border-2 rounded-xl ${
        active && "bg-green-200 border-green-200"
      }`}
    >
      {!atom ? (
        <div className="text-center cut-text">Click to select residue</div>
      ) : (
        <div className="text-center cut-text">{atom.name}</div>
      )}
    </div>
  );
}

function AtomView(props: VariableViewProps) {
  const { currentValue, onChange } = props;

  const [atom, setAtom] = useState<any>(null);
  const [active, setActive] = useState<boolean>(false);

  const handleAtomClick = (e: Event) => {
    const atomInfo = (e as CustomEvent)?.detail?.atom;

    if (!atomInfo) return;

    setAtom(atomInfo);
    onChange(atomInfo);

    // Deselect all atoms once one is selected, because we only want to select one at a time
    window.molstar?.plugin.managers.interactivity.lociSelects.deselectAll();
  };

  useEffect(() => {
    if (window.molstar) {
      window.molstar.plugin.selectionMode = active;
      // Set the granularity to element
      window.molstar.plugin.managers.interactivity.setProps({
        granularity: "element",
      });
      // Unselect selected residues
      window.molstar.plugin.managers.interactivity.lociSelects.deselectAll();
      if (active) {
        // Show structures in ball and stick
        window.molstar.addStructureRepresentation(null, "ball-and-stick");
      } else {
        // Show structures in default
        window.molstar.deleteStructureRepresentations();
      }
    }

    if (active) {
      window.addEventListener("molstar-coordinates", handleAtomClick);
    }

    return () => {
      window.removeEventListener("molstar-coordinates", handleAtomClick);
    };
  }, [active]);

  useEffect(() => {
    if (currentValue) {
      setAtom(currentValue);
    }
  }, [currentValue]);

  return (
    <div
      onClick={() => setActive(!active)}
      className={`w-full h-full max-h-28 overflow-auto border-2 rounded-xl ${
        active && "bg-green-200 border-green-200"
      }`}
    >
      {!atom ? (
        <div className="text-center px-1 cut-text">Click to select atom</div>
      ) : (
        <div className="text-center px-1 cut-text">
          {atom.auth_atom_id} - {atom.atom_index} - {atom.name}
        </div>
      )}
    </div>
  );
}

function ChainView(props: VariableViewProps) {
  const { currentValue, onChange } = props;

  const [chains, setChains] = useState<AtomInfo[]>([]);

  const loadMolstarChains = async () => {
    const molstar = window.molstar;
    const chains = await molstar?.listChains();
    setChains(chains ?? []);
  };

  useEffect(() => {
    loadMolstarChains();
  }, []);

  return (
    <div onMouseDown={loadMolstarChains} className="plugin-variable-value">
      {chains.length === 0 ? (
        <div
          role="placeholder"
          className="text-center"
          style={{
            color: "darkgray",
          }}
        >
          No chains found
        </div>
      ) : (
        <>
          {chains.map((chain, index) => (
            <div
              key={index}
              className="flex flex-row items-center justify-between"
              style={{
                paddingInline: "0.5rem",
              }}
            >
              <input
                id={`${props.variable.id}-${index}`}
                style={{ width: "1rem" }}
                type="checkbox"
                value={`${chain.chainID} - ${chain.structure_label}`}
                checked={
                  currentValue &&
                  currentValue.find((val: any) => {
                    return (
                      val.chainID === chain.chainID &&
                      val.structure_label === chain.structure_label
                    );
                  }) !== undefined
                }
                onChange={(e) => {
                  const newValue = chain;

                  if (!currentValue) {
                    onChange([newValue]);
                    return;
                  }

                  let updatedValues = [...currentValue];

                  if (e.target.checked) {
                    updatedValues.push(newValue);
                  } else {
                    updatedValues = updatedValues.filter(
                      (val) => val.name !== newValue.name
                    );
                  }

                  onChange(updatedValues);
                }}
              />
              <div className="ml-2">
                {chain.chainID} - {chain.structure_label}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function StdResView(props: VariableViewProps) {
  const { currentValue, variable, onChange } = props;

  const [stdRes, setStdRes] = useState<any[]>([]);
  const [filteredStdRes, setFilteredStdRes] = useState<any[]>([]);

  const filterResidues = (event: ChangeEvent<HTMLInputElement>) => {
    const filterValue = event.target.value;
    const filteredResidues = stdRes.filter((residue) =>
      residue.name.toLowerCase().includes(filterValue.toLowerCase())
    );

    setFilteredStdRes(filteredResidues);
  };

  const loadMolstarStdRes = async () => {
    const molstar = window.molstar;
    const residues = await molstar?.listStdRes();

    setStdRes(residues ?? []);
    setFilteredStdRes(residues ?? []);
  };

  useEffect(() => {
    loadMolstarStdRes();

    if (!currentValue) {
      onChange([]);
    }
  }, []);

  return (
    <div onMouseDown={loadMolstarStdRes} className="w-60 plugin-variable-value">
      {stdRes.length === 0 ? (
        <div
          role="placeholder"
          className="text-center"
          style={{
            color: "darkgray",
          }}
        >
          No residues found
        </div>
      ) : (
        <div className="w-full overflow-auto max-h-28 min-h-12">
          <SearchComponent
            placeholder="Search for a residue"
            onChange={filterResidues}
            showIcon={false}
          />
          {filteredStdRes.length > 0 ? (
            filteredStdRes.map((stdRes, index) => (
              <div
                key={
                  stdRes.name +
                  stdRes.residue +
                  stdRes.chainID +
                  stdRes.structure.id
                }
                className="flex flex-row items-center justify-between"
                style={{
                  gap: "1rem",
                  textAlign: "left",
                  paddingInline: "0.5rem",
                }}
              >
                <input
                  id={`${variable.id}-${index}`}
                  style={{ width: "1rem" }}
                  type="checkbox"
                  checked={
                    currentValue &&
                    currentValue.find(
                      (val: any) => val.name === stdRes.name
                    ) !== undefined
                  }
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...(currentValue || []), stdRes]
                        : (currentValue || []).filter(
                            (res: any) => res.name !== stdRes.name
                          )
                    )
                  }
                />
                <div className="w-full">{stdRes.name}</div>
              </div>
            ))
          ) : (
            <div className="text-center">No residues found</div>
          )}
        </div>
      )}
    </div>
  );
}

function HeteroResView(props: VariableViewProps) {
  const { currentValue, variable, onChange } = props;

  const [heteroRes, setHeteroRes] = useState<any[]>([]);

  const [filteredHeteroRes, setFilteredHeteroRes] = useState<any[]>([]);

  const filterHeteroRes = (event: ChangeEvent<HTMLInputElement>) => {
    const filterValue = event.target.value;
    const filteredResidues = heteroRes.filter((residue) =>
      residue.name.toLowerCase().includes(filterValue.toLowerCase())
    );

    setFilteredHeteroRes(filteredResidues);
  };

  const loadMolstarHeteroRes = async () => {
    const molstar = window.molstar;
    const residues = await molstar?.listHeteroRes();

    setHeteroRes(residues ?? []);
    setFilteredHeteroRes(residues ?? []);
  };

  useEffect(() => {
    loadMolstarHeteroRes();
  }, []);

  return (
    <div onMouseDown={loadMolstarHeteroRes} className="plugin-variable-value">
      {heteroRes.length === 0 ? (
        <div
          role="placeholder"
          className="text-center"
          style={{
            color: "darkgray",
          }}
        >
          No hetero atoms found
        </div>
      ) : (
        <div className="w-full overflow-auto max-h-28 min-h-12">
          <SearchComponent
            placeholder="Search for a residue"
            onChange={filterHeteroRes}
            showIcon={false}
          />
          {filteredHeteroRes.map((hRes, index) => (
            <div
              key={index}
              className="flex flex-row items-center justify-between"
              style={{
                paddingInline: "0.5rem",
              }}
            >
              <input
                id={`${variable.id}-${index}`}
                style={{ width: "1rem" }}
                type="checkbox"
                checked={
                  currentValue &&
                  currentValue.find((val: any) => val.name === hRes.name) !==
                    undefined
                }
                onChange={(e) => {
                  const newValue = hRes;
                  const structure = hRes.structure?.name;
                  if (structure) {
                    newValue.structure = structure;
                  }

                  if (!currentValue) {
                    onChange([newValue]);
                    return;
                  }

                  let updatedValues = [...currentValue];

                  if (e.target.checked) {
                    updatedValues.push(newValue);
                  } else {
                    updatedValues = updatedValues.filter(
                      (val) => val.name !== newValue.name
                    );
                  }
                  onChange(updatedValues);
                }}
              />
              <div className="ml-2">{hRes.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SphereVariableView(props: VariableViewProps) {
  const { currentValue, variable, onChange } = props;

  const sphereRef = useRef<SphereRef | null>(currentValue?.ref ?? null);

  const [active, setActive] = useState(false);
  const [activeColor, setActiveColor] = useState(
    sphereRef.current ? Color.toHexStyle(sphereRef.current.color) : "#a5d6a7"
  );
  const mounted = useRef(false);

  const parseNumberOrNegative = (value: string) => {
    // If the field is empty, return "",
    // if the value is "-", return "-",
    // if the value is a number, return the number
    // If the value does not qualify for a number (contains characters), return ""
    // Allow also for decimals

    if (value === "") {
      return "";
    }

    if (value === "-") {
      return "-";
    }

    // If the last character is a dot, return the value
    if (value[value.length - 1] === ".") {
      return value;
    }

    const parsedValue = Number(value);

    if (isNaN(parsedValue)) {
      return "";
    } else {
      return value;
    }
  };

  const handleChange = useCallback(
    async (
      position: {
        x: number | string;
        y: number | string;
        z: number | string;
      },
      radius: number | string
    ) => {
      const molstar = window.molstar;

      if (!molstar) return;

      if (!mounted.current) {
        return;
      }

      const parsedSphereNumbers = {
        x: Number(position.x),
        y: Number(position.y),
        z: Number(position.z),
      };

      const ref = await molstar.addSphere(
        parsedSphereNumbers,
        Number(radius),
        0.3,
        undefined,
        sphereRef.current ?? undefined
      );

      sphereRef.current = ref;

      setActiveColor(Color.toHexStyle(ref.color));

      const sphereData = {
        center: {
          x: position.x,
          y: position.y,
          z: position.z,
        },
        radius: radius,
        ref: ref,
      };

      onChange(sphereData);

      window.molstar?.plugin.managers.interactivity.lociSelects.deselectAll();
    },
    [onChange]
  );

  // When unmounting, remove the sphere
  useEffect(() => {
    return () => {
      if (window.molstar && sphereRef?.current?.ref) {
        window.molstar.removeSphere(sphereRef.current.ref);
      }
    };
  }, []);

  const handleCoordinates = useCallback(
    (e: Event) => {
      if (active) {
        const data = (e as CustomEvent).detail;

        handleChange(
          {
            x: data.x,
            y: data.y,
            z: data.z,
          },
          currentValue?.radius ?? 10
        );
      }
    },
    [active, currentValue, handleChange]
  );

  // Place the sphere in the center of the screen
  useEffect(() => {
    if (window.molstar) {
      window.molstar.plugin.selectionMode = active;
      // Unselect selected residues
      window.molstar.plugin.managers.interactivity.lociSelects.deselectAll();
    }

    // Listen for the "molstar-coordinates" event
    window.addEventListener("molstar-coordinates", handleCoordinates);
    return () => {
      window.removeEventListener("molstar-coordinates", handleCoordinates);
    };
  }, [active, handleCoordinates]);

  const handleNewlyPlaced = useCallback(async () => {
    const sphereData: any = {
      center: {
        x: 0,
        y: 0,
        z: 0,
      },
      radius: 10,
      ref: null,
    };

    if (window.molstar) {
      const ref = await window.molstar.addSphere(
        sphereData.center,
        sphereData.radius,
        0.3,
        undefined,
        undefined
      );
      sphereRef.current = ref;
      setActiveColor(Color.toHexStyle(ref.color));

      sphereData.ref = ref;
    }

    onChange(sphereData);
  }, [onChange]);

  useEffect(() => {
    // Set the initial value in case it's not set
    if (!currentValue && !mounted.current) {
      handleNewlyPlaced();
    }
    mounted.current = true;
  });

  return (
    <div
      className="flex flex-col p-2 gap-2"
      style={{
        padding: "0 !important",
      }}
    >
      <div className="flex flex-row gap-2">
        <div className="flex flex-row gap-2">
          <span
            className="font-semibold"
            style={{
              color: "darkgray",
            }}
          >
            X:
          </span>
          <input
            id={`${variable.id}-x`}
            className="plugin-variable-value text-black"
            value={currentValue?.center?.x ?? ""}
            onChange={(e) => {
              handleChange(
                {
                  x: parseNumberOrNegative(e.target.value),
                  y: currentValue.center.y,
                  z: currentValue.center.z,
                },
                currentValue.radius
              );
            }}
          />
        </div>
        <div className="flex flex-row gap-2">
          <span
            className="font-semibold"
            style={{
              color: "darkgray",
            }}
          >
            Y:
          </span>
          <input
            id={`${variable.id}-y`}
            className="plugin-variable-value text-black"
            value={currentValue?.center?.y ?? 0}
            onChange={(e) => {
              handleChange(
                {
                  x: currentValue.center.x,
                  y: parseNumberOrNegative(e.target.value),
                  z: currentValue.center.z,
                },
                currentValue.radius
              );
            }}
          />
        </div>
        <div className="flex flex-row gap-2">
          <span
            className="font-semibold"
            style={{
              color: "darkgray",
            }}
          >
            Z:
          </span>
          <input
            id={`${variable.id}-z`}
            className="plugin-variable-value text-black"
            value={currentValue?.center?.z ?? 0}
            onChange={(e) => {
              handleChange(
                {
                  x: currentValue.center.x,
                  y: currentValue.center.y,
                  z: parseNumberOrNegative(e.target.value),
                },
                currentValue.radius
              );
            }}
          />
        </div>
        <div className="flex flex-row gap-2">
          <span
            className="font-semibold"
            style={{
              color: "darkgray",
            }}
          >
            R:
          </span>
          <input
            id={`${variable.id}-radius`}
            className="plugin-variable-value text-black"
            value={currentValue?.radius ?? ""}
            onChange={(e) => {
              const newRadius = parseNumberOrNegative(e.target.value);
              handleChange(
                {
                  x: currentValue.center.x,
                  y: currentValue.center.y,
                  z: currentValue.center.z,
                },
                newRadius
              );
            }}
          />
        </div>
      </div>
      <div
        onClick={() => setActive(!active)}
        className={`w-full h-full max-h-28 overflow-auto border-2 rounded-xl cursor-default ${
          active && "bg-green-200 border-green-200"
        }`}
      >
        {active ? (
          <div className="text-center px-1 cut-text">Click on Mol*</div>
        ) : (
          <div className="text-center px-1 cut-text">
            {sphereRef.current ? (
              <div className="flex flex-row items-center justify-center gap-2">
                Placed sphere
                <div
                  className="w-4 h-4 rounded-full"
                  style={{
                    backgroundColor: activeColor,
                  }}
                ></div>
              </div>
            ) : (
              "Enable Mol* selection"
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CustomVariableRenderer(props: {
  variable: CustomVariable;
  onChange: (value: any) => void;
}) {
  const setupWindowVariables = () => {
    // Load into the window the getVariable and setVariable functions
    window.horus.getVariable = () => {
      return props.variable;
    };

    window.horus.setVariable = (value: any) => {
      props.onChange(value);
    };
  };

  const openCustomPage = () => {
    setupWindowVariables();
    loadPage(
      props.variable.customPage.url,
      props.variable.customPage.name,
      props.variable.placedID
    );
  };

  useEffect(() => {
    return () => {
      loadPage(undefined, undefined, props.variable.placedID);
    };
  }, []);

  return (
    <div className="w-full flex flex-col gap-2 items-center justify-center p-2">
      <AppButton action={openCustomPage}>Configure</AppButton>
    </div>
  );
}

export function InputView(props: { groups: VariableGroup[] }) {
  if (props.groups.length === 1) {
    return (
      <>
        {props.groups[0]!.variables.map((variable) => {
          return <SimpleVariableView variable={variable} border={false} />;
        })}
      </>
    );
  }

  return (
    <div className="flex flex-col flex-wrap gap-2">
      {props.groups.map((group) => {
        return (
          <div
            className="flex flex-col gap-2 rounded-xl p-2 shadow-md w-full flex-1"
            style={{
              border: "1px solid var(--pop-code)",
            }}
            key={group.id}
          >
            <div className="text-xl font-semibold">{group.name}</div>
            <div>{group.description}</div>
            <div className="flex flex-col gap-2 overflow-x-scroll h-full flex-wrap">
              {group.variables.map((variable) => {
                return <SimpleVariableView variable={variable} />;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SimpleVariableView(props: {
  variable: PluginVariable;
  border?: boolean;
}) {
  return (
    <div
      className="plugin-variable animated-gradient"
      style={{
        border: props.border ? "1px solid var(--pop-code)" : "none",
      }}
    >
      <div className="plugin-variable-name">{props.variable.name}</div>
      <div className="plugin-variable-description">
        {props.variable.description}
      </div>
    </div>
  );
}
