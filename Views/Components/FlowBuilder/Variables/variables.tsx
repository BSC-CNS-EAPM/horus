// React
import { useEffect, useState, useMemo, useContext, useCallback } from "react";

// Horus TS types
import {
  CustomVariable,
  PluginPage,
  PluginVariable,
  PluginVariableTypes,
  VariableGroup
} from "../flow.types";

// Components
import AppButton from "../../appbutton";
import Slider from "rc-slider";
import HorusSwitch from "../../Switch/switch";
import { HorusFileExplorer } from "../../FileExplorer/file_explorer";
import LockIcon from "../../Toolbar/Icons/Lock";

// Styles
import "rc-slider/assets/index.css";

// Mol* variables components
import {
  AtomView,
  BoxVariableView,
  ChainView,
  HeteroResView,
  InteractiveChainView,
  MultipleStructureVariableView,
  ResidueRangeView,
  ResidueView,
  SphereVariableView,
  StandardResView,
  StructureVariableView
} from "./molstar_variables";

// Code editor variables
import {
  CodeVariableView,
  HorusSmallVariableCodeEditor,
  ObjectVariableView
} from "./editor_variables";

// Smiles
import { SmilesVariableView } from "./smiles_variables";
import ErrorIcon from "../../Toolbar/Icons/Error";
import TrashIcon from "../../Toolbar/Icons/Trash";
import { BreakLongUnderscoreNames } from "../Blocks/block.view";
import {
  addPanel,
  DockContext,
  FlowBuilderContext,
  PANEL_REGISTRY
} from "@/Components/MainApp/PanelView";
import { getIframeExtensionID } from "@/Components/IframeLoader/iframeloader";
import RotatingLines from "@/Components/RotatingLines/rotatinglines";
import { useDebouncedCallback } from "@mantine/hooks";

type PluginVariableViewProps = {
  variable: PluginVariable;
  onChange: (value: any, variable: PluginVariable, groupID?: string) => void;
  hideName?: boolean;
  hideDescription?: boolean;
  applyStyle?: boolean;
  customClass?: string;
  placeholder?: string;
  isFlowActive?: boolean;
};

export function PluginVariableView(props: PluginVariableViewProps) {
  const { variable, onChange, hideName } = props;
  const flowContext = useContext(FlowBuilderContext);
  const isFlowActive = !!flowContext?.flow.isFlowActive;

  const handleChange = useCallback(
    (value: any, varToChange?: PluginVariable, groupID?: string) => {
      if (!variable.disabled && !isFlowActive) {
        if (variable.type === PluginVariableTypes.GROUP) {
          varToChange && onChange(value, varToChange, groupID);
        } else {
          onChange(value, variable);
        }
      }
    },
    [variable, onChange, isFlowActive]
  );

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
        isFlowActive={isFlowActive}
      />
    );
  }

  return (
    <div
      className={`${
        props.applyStyle === false
          ? (props.customClass ?? "flex-auto w-full")
          : "plugin-variable animated-gradient border-none"
      }`}
      style={{
        ...widthStyle,
        opacity: isFlowActive ? 0.5 : 1,
        // pointerEvents: variable.disabled ? "none" : "auto",
        cursor: isFlowActive
          ? "wait"
          : variable.disabled
            ? "not-allowed"
            : "auto"
      }}
    >
      <div className="flex flex-row w-full justify-between">
        <div>
          {!hideName && (
            <span
              style={{
                marginRight: "0.5rem"
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
            <span>
              <LockIcon
                style={{
                  display: "inline",
                  transform: "translateY(-3px)"
                }}
              />
            </span>
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
        // style={{
        //   pointerEvents: variable.disabled || isFlowActive ? "none" : "auto",
        // }}
      >
        <VariableRenderer
          variable={variable}
          onChange={handleChange}
          isFlowActive={isFlowActive}
        />
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

  // If the currentValue is not an array and not null, set it to an empty array
  if (!Array.isArray(currentValue) && currentValue !== null) {
    onChange([]);

    return null;
  }

  const names = variable.variables!.reduce((acc: any, variable) => {
    acc[variable.id] = variable.name;
    return acc;
  }, {});

  const cols = variable.variables!.map((variable) => {
    return (
      <div
        key={variable.id}
        style={{
          minWidth: "200px",
          textAlign: "center"
        }}
        // className="break-all"
      >
        {names[variable.id]}
        <hr></hr>
      </div>
    );
  });

  cols.push(
    <div key="delete" className="w-[100px] text-center">
      Delete
      <hr></hr>
    </div>
  );

  const colsNum = cols.length;

  const gridColsStyle = {
    gridTemplateColumns: `repeat(${colsNum}, auto)`
  };

  return (
    <div className="flex flex-col w-full break-all">
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
        <div
          className={`zoom-out-animation grid gap-2 place-items-center overflow-x-auto bg-white rounded-md p-2 border`}
          style={{ ...gridColsStyle }}
        >
          {cols}
          {currentValue?.map((value: any, index: number) => (
            <>
              {variable.variables!.map((variable, i) => {
                return (
                  <PluginVariableView
                    key={i}
                    variable={{
                      ...variable,
                      value: value[variable.id]
                    }}
                    onChange={(
                      value: any,
                      variableToChange: PluginVariable,
                      groupID?: string
                    ) => {
                      internalOnChange(
                        index,
                        value,
                        variableToChange.id,
                        groupID
                      );
                    }}
                    hideDescription={true}
                    applyStyle={false}
                    hideName={true}
                    isFlowActive={props.isFlowActive}
                  />
                );
              })}
              <button
                key={index}
                className="flex justify-center items-center w-6"
                onClick={() => removeRow(index)}
              >
                <TrashIcon stroke="none" color="red" />
              </button>
            </>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupVariableView(props: PluginVariableViewProps) {
  const variables = props.variable.variables;

  const onChange = (value: any, id: PluginVariable) => {
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
              isFlowActive={props.isFlowActive}
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
  isFlowActive?: boolean;
}) {
  // Extract the variable from the props
  const { variable: variableToRender, onChange } = props;

  // Assign a state to the current value to prevent re-renders when the actual variable object
  // changes
  const [currentValue, setCurrentValue] = useState(variableToRender.value);

  const handleVariableChangeInternal = (value: any) => {
    if (props.isFlowActive || props.variable.disabled) {
      return;
    }
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
    case PluginVariableTypes.PASSWORD:
      return (
        <PasswordVariableView
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
      return (
        <DropdownVariableView
          variable={variableToRender}
          currentValue={currentValue}
          onChange={handleVariableChangeInternal}
        />
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
          isFlowActive={props.isFlowActive}
        />
      );
    case PluginVariableTypes._LIST:
      return (
        <VariableListView
          currentValue={currentValue}
          variable={props.variable}
          onChange={handleVariableChangeInternal}
          isFlowActive={props.isFlowActive}
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
        <CodeVariableView
          currentValue={currentValue}
          onChange={handleVariableChangeInternal}
          variable={props.variable}
        />
      );
    case PluginVariableTypes.CHECKBOX:
      return (
        <CheckboxVariableView
          currentValue={currentValue}
          onChange={handleVariableChangeInternal}
          variable={props.variable}
        />
      );
    case PluginVariableTypes.RADIO:
      return (
        <CheckboxVariableView
          currentValue={currentValue}
          onChange={handleVariableChangeInternal}
          variable={props.variable}
          radio
        />
      );
    case PluginVariableTypes.CHAIN_INTERACTIVE:
      return (
        <InteractiveChainView
          currentValue={currentValue}
          onChange={handleVariableChangeInternal}
          variable={props.variable}
        />
      );
    case PluginVariableTypes.RESIDUE_RANGE:
      return (
        <ResidueRangeView
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

function DropdownVariableView({
  currentValue,
  variable: variableToRender,
  onChange
}: VariableViewProps) {
  useEffect(() => {
    // If the current value is not set, set i to the first allowed value
    // CAUTION WITH VALUES LIKE "0" or 0, they will cause infinite re-renders
    // This is why we check for null and undefined explicitly
    if (
      (currentValue === null || currentValue === undefined) &&
      variableToRender.allowedValues
    ) {
      onChange(
        variableToRender.defaultValue ?? variableToRender?.allowedValues[0]
      );
    }
  }, [
    currentValue,
    variableToRender.allowedValues,
    variableToRender.defaultValue,
    onChange
  ]);

  return (
    <select
      value={
        currentValue ??
        variableToRender.defaultValue ??
        variableToRender.allowedValues?.[0]
      }
      onChange={(e) => onChange(e.target.value as any)}
    >
      {variableToRender.allowedValues?.map((value, index) => (
        <option key={index} value={value}>
          {value}
        </option>
      ))}
    </select>
  );
}

function CheckboxVariableView(props: VariableViewProps & { radio?: boolean }) {
  const allowedValues: string[] = props.variable.allowedValues ?? [];

  let currentValue: string[] | string | null = props.currentValue;
  if (props.radio) {
    currentValue = props.currentValue as string | null;
  } else {
    currentValue = props.currentValue as string[];
  }

  if (!currentValue && !props.radio) {
    props.onChange([]);
  }

  if (!allowedValues) {
    return (
      <div className="text-red-500">
        Missing allowed values for {props.radio ? "radio" : "checkbox"} variable
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 whitespace-normal">
      {allowedValues.map((value, index) => (
        <div key={index} className="flex flex-row items-center gap-2">
          <input
            style={{ width: "1rem" }}
            key={index}
            type={props.radio ? "radio" : "checkbox"}
            checked={
              props.radio
                ? currentValue === value
                : currentValue?.includes(value)
            }
            onChange={(e) => {
              if (props.radio) {
                props.onChange(e.target.checked ? value : null);
              } else {
                const castValue = currentValue as string[] | null;
                const newValue = e.target.checked
                  ? [...(castValue ?? []), value]
                  : castValue?.filter((v) => v !== value);
                props.onChange(newValue);
              }
            }}
          />
          <span>{value}</span>
        </div>
      ))}
    </div>
  );
}

export type VariableViewProps = {
  variable: PluginVariable;
  currentValue: any;
  onChange: (value: any) => void;
  isFlowActive?: boolean;
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

function PasswordVariableView(props: VariableViewProps) {
  return (
    <input
      className="plugin-variable-value mask-password"
      id={props.variable.id}
      autoComplete="off"
      aria-autocomplete="none"
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

function IntegerFloatVariableView(
  props: VariableViewProps & { skipCheck?: boolean }
) {
  const { currentValue, variable, onChange } = props;

  const [internalValue, setInternalValue] = useState<string | number | null>(
    currentValue
  );
  const [numberMessage, setNumberMessage] = useState<string | null>(null);

  useEffect(() => {
    setInternalValue(currentValue);
  }, [currentValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseNum(e.target.value);
    parseInsideAllowedValues(value);
    onChange(value);
    setInternalValue(value);
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
    if (
      !variable.allowedValues ||
      variable.allowedValues.length === 0 ||
      props.skipCheck
    ) {
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
        value={internalValue ?? ""}
        onBlur={handleChange}
        onChange={(e) => setInternalValue(e.target.value)}
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

  console.log("slider value:", currentValue);

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
          width: "300%"
        }}
        styles={{
          track: { backgroundColor: "var(--pop-code)" },
          handle: {
            backgroundColor: "var(--vintage-code)",
            border: "none",
            outline: "none",
            opacity: 1,
            borderColor: "black"
          }
        }}
      />
      <IntegerFloatVariableView
        skipCheck={true}
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
          width: "300%"
        }}
        styles={{
          track: { backgroundColor: "var(--pop-code)" },
          handle: {
            backgroundColor: "var(--vintage-code)",
            border: "none",
            outline: "none",
            opacity: 1,
            borderColor: "black"
          }
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
  const [fileContents, setFileContents] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState<boolean>(false);

  const loadFileContents = useDebouncedCallback(async () => {
    if (!currentValue) {
      setFileContents(null);
      setFileError(null);
      setFileLoading(false);
      return;
    }
    setFileLoading(true);
    try {
      const contents = await window.horus.getFile(currentValue, {
        onlyFiles: true,
        onlyText: true
      });
      const text = await contents.text();
      setFileContents(text);
      setFileError(null);
    } catch (err) {
      setFileContents(null);
      setFileError(typeof err === "string" ? err : "Error loading file");
    } finally {
      setFileLoading(false);
    }
  }, 500);

  useEffect(() => {
    loadFileContents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentValue]); // Load whenever currentValue changes

  return (
    <div className="flex flex-col w-full gap-2">
      <div className="flex flex-row gap-2 w-full h-10 p-1 justify-center items-center">
        <input
          id={variable.id}
          placeholder={
            props.variable.placeholder ?? "Write a path or browse..."
          }
          className="overflow-x-auto break-keep-all h-6 plugin-variable-value"
          value={currentValue ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
        <HorusFileExplorer
          openOutsideFlowContext={
            (variable as PluginVariable & { openOutsideFlowContext?: boolean })
              ?.openOutsideFlowContext
          }
          openAtPath={currentValue}
          onFileConfirm={onChange}
          onFileSelect={onChange}
          openFolder={props.openFolder ?? false}
          allowedExtensions={variable?.allowedValues}
        >
          Browse...
        </HorusFileExplorer>
      </div>
      {fileLoading ? (
        <div className="flex flex-col justify-center items-center p-4 w-full">
          <RotatingLines size="2rem" />
        </div>
      ) : (
        currentValue &&
        (() => {
          const parts = currentValue.split("/");
          const fileName = parts.pop();
          const extension = fileName?.split(".").pop();

          if (fileError) {
            return (
              <div className="text-red-500 text-center p-2">{fileError}</div>
            );
          }

          return (
            <HorusSmallVariableCodeEditor
              variable={props.variable}
              value={fileContents ?? ""}
              onChange={() => {}}
              language={extension ?? "txt"}
              height="300px"
              options={{ minimap: { enabled: false }, readOnly: true }}
              overrideFullScreenToggle={(panelID) => {
                window.horus.openFileInEditor?.({
                  path: currentValue,
                  panelID
                });
              }}
              label="Edit file"
              onClose={() => {
                // Update the contents when the editor is closed
                loadFileContents();
              }}
            />
          );
        })()
      )}
    </div>
  );
}

function ListView(props: VariableViewProps) {
  const { currentValue, variable, onChange } = props;

  const addRow = () => {
    const newValues = currentValue ? [...currentValue] : [];
    newValues.push(null);
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
    newValues[index] = value;
    onChange(newValues);
  };

  // If the currentValue is not an array and not null, set it to an empty array
  if (!Array.isArray(currentValue) && currentValue !== null) {
    onChange([]);

    return null;
  }

  const rowsTypes = variable.allowedValues?.[0] ?? PluginVariableTypes.STRING;

  return (
    <div className="flex flex-col w-full min-w-full flex-auto">
      <div className="flex flex-row gap-2 justify-center mb-2">
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
            <div
              className="flex flex-row gap-2 items-center justify-between px-2 zoom-out-animation "
              style={{
                pointerEvents: props.isFlowActive ? "none" : "auto",
                cursor: props.isFlowActive ? "wait" : "auto"
              }}
            >
              <VariableRenderer
                variable={{
                  ...variable,
                  value: value,
                  type: rowsTypes,
                  allowedValues: []
                }}
                onChange={(newValue: any) => {
                  handleRowValueChange(index, newValue);
                }}
                isFlowActive={props.isFlowActive}
              />
              {/* <input
                id={`${props.variable.id}-${index}`}
                type="text"
                className="plugin-variable-value"
                value={props.variable.allowedValues ? value.value : value}
                onChange={(e) => handleRowValueChange(index, e.target.value)}
              /> */}
              <button
                onClick={() => removeRow(index)}
                style={{
                  width: "unset"
                }}
              >
                <TrashIcon stroke="none" color="red" />
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
  const { dockApi } = useContext(DockContext);
  const flowBuilderContext = useContext(FlowBuilderContext);

  const panelID = `variable-${props.variable.id}-${props.variable.placedID}`;

  const updatedPluginPage: PluginPage = useMemo(() => {
    return {
      ...props.variable.customPage,
      variable_id: props.variable.id,
      placedID: props.variable.placedID
    };
  }, [props.variable.customPage, props.variable.id, props.variable.placedID]);

  const injectVariables = useCallback(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    // Inject variables on NON-development iframes
    const prodIframe = getIframeExtensionID(updatedPluginPage);

    const iframe = document.getElementById(
      prodIframe
    ) as HTMLIFrameElement | null;

    const injectToProd = () => {
      if (signal.aborted) {
        return;
      }

      if (iframe?.contentWindow) {
        iframe.contentWindow.horusVariable = {
          getVariable: () => props.variable,
          setVariable: (value: any) => {
            props.onChange(value);
          }
        };
      }
    };

    injectToProd();
    iframe?.addEventListener("load", injectToProd, { signal });
    const devIframes = (flowBuilderContext?.misc?.developmentIframes ?? [])
      .filter(
        (entry) =>
          entry.variable_id === props.variable.id &&
          entry.variable_placedID === props.variable.placedID
      )
      .map((entry) => {
        const devIframe = document.getElementById(
          entry.iframe_id
        ) as HTMLIFrameElement | null;

        return devIframe;
      });

    const injectToDev = (devIframe: HTMLIFrameElement | null) => {
      if (signal.aborted) {
        return;
      }

      if (devIframe?.contentWindow) {
        if (!devIframe.contentWindow.horus) {
          devIframe.contentWindow.horus = window.horus;
        }

        devIframe.contentWindow.horusVariable = {
          getVariable: () => props.variable,
          setVariable: (value: any) => props.onChange(value)
        };
      }
    };

    devIframes.forEach((devIframe) => {
      injectToDev(devIframe);
      devIframe?.addEventListener("load", () => injectToDev(devIframe), {
        signal
      });
    });

    return () => {
      abortController.abort();
    };
  }, [props, flowBuilderContext?.misc.developmentIframes, updatedPluginPage]);

  useEffect(() => {
    return injectVariables();
  }, [injectVariables]);

  return (
    <div className="w-full flex flex-col gap-2 items-center justify-center p-2">
      <AppButton
        action={() => {
          addPanel({
            dockApi,
            component: PANEL_REGISTRY.blockVariablesExtension.component,
            panelID: panelID,
            params: {
              ...updatedPluginPage,
              onLoad: () => {
                // Inject the variable into the iframe
                injectVariables();
              }
            } as PluginPage & { onLoad?: () => void }
          });
        }}
      >
        {props.variable.name}
      </AppButton>
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
      className="flex flex-col gap-2 rounded-xl p-2 shadow-md w-full flex-1 whitespace-normal"
      style={{
        border: "1px solid var(--pop-code)"
      }}
      key={group.id}
    >
      <div className="text-xl font-semibold">
        <BreakLongUnderscoreNames name={group.name} />
      </div>
      <BreakLongUnderscoreNames name={group.description} />
      <div className="flex flex-col gap-2 overflow-x-auto h-full">
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
        border: props.border ? "1px solid var(--pop-code)" : "none"
      }}
    >
      <div className="flex flex-row justify-between w-full">
        <div className="plugin-variable-name">
          {props.variable.name}
          {props.variable.disabled && (
            <LockIcon
              style={{
                display: "inline",
                transform: "translateY(-3px)"
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
        color: "var(--waring-orange)"
      }}
    >
      <ErrorIcon
        name="required"
        color="var(--waring-orange)"
        style={{
          display: "inline",
          marginRight: "5px",
          transform: "translateY(-3px)"
        }}
      />
      Required
    </span>
  );
}
