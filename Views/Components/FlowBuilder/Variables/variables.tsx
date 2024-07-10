// React
import { useEffect, useState, useMemo } from "react";

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
import { HorusFileExplorer } from "../../FileExplorer/file_explorer";
import LockIcon from "../../Toolbar/Icons/Lock";

// Utility function to open an extension
import { loadPage } from "../../Toolbar/extensions_list";

// Styles
import "rc-slider/assets/index.css";
import CrossIcon from "../../Toolbar/Icons/Cross";

// Mol* variables components
import {
  AtomView,
  BoxVariableView,
  ChainView,
  HeteroResView,
  MultipleStructureVariableView,
  ResidueView,
  SphereVariableView,
  StandardResView,
  StructureVariableView,
} from "./molstar_variables";

// Code editor variables
import { ObjectVariableView, PythonVariableView } from "./editor_variables";

// Smiles
import { SmilesVariableView } from "./smiles_variables";
import ErrorIcon from "../../Toolbar/Icons/Error";

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
      <div className="flex flex-row w-full justify-between">
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
        {!variable.value && variable.required && (
          <div>
            <RequiredVariable />
          </div>
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

  // If the currentValue is not an array and not null, set it to an empty array
  if (!Array.isArray(currentValue) && currentValue !== null) {
    onChange([]);

    return null;
  }

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
      // CAUTION WITH VALUES LIKE "0" or 0, they will cause infinite re-renders
      if (!currentValue === null && variableToRender.allowedValues) {
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

    case PluginVariableTypes.MULTIPLE_STRUCTURE:
      return (
        <MultipleStructureVariableView
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
        <StandardResView
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
    case PluginVariableTypes.BOX:
      return (
        <BoxVariableView
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
    case PluginVariableTypes.OBJECT:
      return (
        <ObjectVariableView
          currentValue={currentValue}
          onChange={handleVariableChangeInternal}
          variable={props.variable}
        />
      );
    case PluginVariableTypes.CODE:
      return (
        <PythonVariableView
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

export type VariableViewProps = {
  variable: PluginVariable;
  currentValue: any;
  onChange: (value: any) => void;
};

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
      placeholder={props.variable.placeholder ?? "Write text here..."}
      value={(props.currentValue as string) ?? ""}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

function IntegerFloatVariableView(props: VariableViewProps) {
  const { currentValue, variable, onChange } = props;

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
      {numberMessage && <div className="text-red-500">{numberMessage}</div>}
      <input
        placeholder={props.variable.placeholder}
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
        placeholder={props.variable.placeholder ?? "Write a path or browse..."}
        className="overflow-x-auto break-keep-all h-6 plugin-variable-value"
        value={currentValue ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
      <HorusFileExplorer
        openAtPath={currentValue}
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

  // If the currentValue is not an array and not null, set it to an empty array
  if (!Array.isArray(currentValue) && currentValue !== null) {
    onChange([]);

    return null;
  }

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
    loadPage(props.variable.customPage, props.variable.placedID);
  };

  useEffect(() => {
    return () => {
      loadPage(undefined, props.variable.placedID);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        return <VariableGroupInfoView group={group} />;
      })}
    </div>
  );
}

export function VariableGroupInfoView({ group }: { group: VariableGroup }) {
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
}

export function SimpleVariableView(props: {
  variable: PluginVariable;
  border?: boolean;
}) {
  const capitalizedType =
    props.variable.type[0]?.toUpperCase() + props.variable.type.slice(1);

  const getAllowedValues = () => {
    if (props.variable.allowedValues) {
      return ` - (${props.variable.allowedValues.join(", ")})`;
    }

    return "";
  };

  return (
    <div
      className="plugin-variable animated-gradient"
      style={{
        border: props.border ? "1px solid var(--pop-code)" : "none",
      }}
    >
      <div className="flex flex-row justify-between w-full">
        <div className="plugin-variable-name">
          {props.variable.name}
          {props.variable.disabled && (
            <LockIcon
              style={{
                display: "inline",
                transform: "translateY(-3px)",
              }}
            />
          )}
        </div>

        <div className="no-wrap whitespace-nowrap">
          {props.variable.required && <RequiredVariable />}
        </div>
      </div>
      <div className="plugin-variable-description">
        {props.variable.description}
      </div>
      <div className="text-muted text-xs">
        Type: {capitalizedType} {getAllowedValues()}
      </div>
    </div>
  );
}

function RequiredVariable() {
  return (
    <span
      className="plugin-variable-description"
      style={{
        marginLeft: "5px",
        display: "inline",
        color: "var(--waring-orange)",
      }}
    >
      <ErrorIcon
        name="required"
        color="var(--waring-orange)"
        style={{
          display: "inline",
          marginRight: "5px",
          transform: "translateY(-3px)",
        }}
      />
      Required
    </span>
  );
}
