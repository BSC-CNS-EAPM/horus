import React, { useEffect, useState, useRef } from "react";
import { Jsme } from "jsme-react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  Block,
  BlockVarPair,
  PluginVariable,
  PluginVariableTypes,
} from "./flow_builder_types";
import NBDButton from "../nbdbutton";
import { SearchComponent } from "../Toolbar/toolbar";
import { HorusFileExplorer } from "../FileExplorer/file_explorer";
import Xarrow from "react-xarrows";
import { SphereRef } from "../Molstar/HorusWrapper/horusmolstar";
import { Color } from "molstar/lib/mol-util/color";

// Components
import Slider from "rc-slider";
import "rc-slider/assets/index.css";

type PluginVariableViewProps = {
  variable: PluginVariable;
  onChange: (value: any, id: string, groupID?: string) => void;
  hideName?: boolean;
  applyStyle?: boolean;
};

function VariableListView(props: ListViewProps) {
  const [values, setValues] = useState(props.variable.value);

  const handleChange = (value: any) => {
    setValues(value);
    props.onChange(value);
  };

  useEffect(() => {
    handleChange(props.variable.value);
  }, [props.variable.value]);

  const addRow = () => {
    let newValues = values ? [...values] : [];

    // Push a new value that contains an array of objects representing each variable and its default value
    newValues.push(
      props.variable.variables.reduce((acc, variable) => {
        if (variable.type === PluginVariableTypes.GROUP) {
          acc[variable.id] = variable.variables.reduce((acc, variable) => {
            acc[variable.id] = variable.defaultValue || null;
            return acc;
          }, {} as any);
        } else {
          acc[variable.id] = variable.defaultValue || null;
        }
        return acc;
      }, {})
    );

    handleChange(newValues);
  };

  const removeRow = (index: number) => {
    if (!values) return;
    const newValues = [...values];
    newValues.splice(index, 1);
    handleChange(newValues);
  };

  const internalOnChange = (
    index: number,
    value: any,
    id: string,
    groupID?: string
  ) => {
    // Update the corresponding index on the values array
    const newValues = [...values];

    if (groupID) {
      newValues[index][groupID][id] = value;
    } else {
      newValues[index][id] = value;
    }

    handleChange(newValues);
  };

  const variableViewsUpdated = (index, value, variable) => {
    const updatedVariable = {
      ...variable,
      value: value[variable.id],
    };

    return (
      <PluginVariableView
        variable={updatedVariable}
        onChange={(value: any, id: string, groupID?: string) => {
          internalOnChange(index, value, id, groupID);
        }}
        hideName={true}
        applyStyle={false}
      />
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row gap-2 justify-center my-2">
        <NBDButton action={addRow}>Add row</NBDButton>
        <NBDButton
          action={() => {
            handleChange([]);
          }}
        >
          Clear
        </NBDButton>
      </div>
      {values?.length > 0 && (
        <div
          className="flex flex-col gap-2 pb-2 overflow-x-auto justify-center items-center"
          style={{
            marginTop: "-1rem",
          }}
        >
          {values?.map((value, index) => (
            <div>
              <hr
                style={{
                  margin: "0.5rem",
                }}
              ></hr>
              <div className="flex flex-row gap-2 items-end px-2 w-full flex-wrap justify-center b-black-500">
                {props.variable.variables.map((variable) => {
                  return variableViewsUpdated(index, value, variable);
                })}
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
      <div className="plugin-variable-name">{props.variable.name}</div>
      <div className="flex flex-wrap flex-row gap-2 justify-center">
        {variables.map((variable) => {
          return (
            <PluginVariableView
              variable={variable}
              onChange={onChange}
              hideName={props.hideName}
              applyStyle={false}
            />
          );
        })}
      </div>
    </div>
  );
}

const PluginVariableView = (props: PluginVariableViewProps) => {
  const { variable, onChange, hideName } = props;

  const [value, setValue] = useState(variable.value);

  const handleChange = (value: any) => {
    setValue(value);
    onChange(value, variable.id);
  };

  useEffect(() => {
    handleChange(variable.value);
  }, [variable.value]);

  const [structures, setStructures] = useState<any[]>([]);

  const loadMolstarStructures = () => {
    const molstar = window.molstar;
    const structList = molstar?.listStructures();

    if (!structList) return [];

    setStructures(structList);

    // Set the first structure as the default value
    handleChange(structList[0]);
  };

  useEffect(() => {
    if (props.variable.type === PluginVariableTypes.STRUCTURE) {
      // Load the structures
      props.variable.type === PluginVariableTypes.STRUCTURE &&
        loadMolstarStructures();

      // Listen for new structures
      window.addEventListener("molstar-structure-added", loadMolstarStructures);

      return () => {
        window.removeEventListener(
          "molstar-structure-added",
          loadMolstarStructures
        );
      };
    }
  }, []);

  if (variable.type === PluginVariableTypes.GROUP) {
    return (
      <GroupVariableView
        onChange={props.onChange}
        variable={variable}
        hideName={hideName}
      />
    );
  }

  const isSafari = /^((?!chrome|android).)*applewebkit/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent);

  return (
    <div className={props.applyStyle === false ? null : "plugin-variable"}>
      {!hideName && (
        <div className="plugin-variable-name">{props.variable.name}</div>
      )}
      <div className="plugin-variable-description">
        {props.variable.description}
      </div>
      <div className="plugin-variable-value">
        {/* Define an input based on the type */}

        {/* If its a string, int or float, set a basic input */}
        {(props.variable.type === PluginVariableTypes.STRING ||
          props.variable.type === PluginVariableTypes.ANY) && (
          <input
            type="text"
            value={value as string}
            onChange={(e) => handleChange(e.target.value as any)}
          />
        )}

        {/* {props.variable.type === PluginVariableTypes.NUMBER && (
          <input
            type="number"
            value={value as number}
            onChange={(e) => handleChange(e.target.value as any)}
          />
        )} */}

        {(props.variable.type === PluginVariableTypes.INTEGER ||
          props.variable.type === PluginVariableTypes.FLOAT ||
          props.variable.type === PluginVariableTypes.NUMBER) && (
          <IntegerFloatVariableView
            variable={props.variable}
            onChange={handleChange}
          />
        )}

        {/* If its a boolean, set a checkbox */}
        {props.variable.type === PluginVariableTypes.BOOLEAN && (
          <input
            // If its safari, set a margin for the checkbox of 50%
            className={isSafari ? "plugin-variable-safari" : ""}
            type="checkbox"
            checked={value as boolean}
            onChange={(e) => handleChange(e.target.checked as any)}
          />
        )}

        {/* If its a list of strings, set a dropdown */}
        {props.variable.type === PluginVariableTypes.STRING_LIST && (
          <select
            value={value as string}
            onChange={(e) => handleChange(e.target.value as any)}
          >
            {(props.variable.allowedValues as string[])?.map((value, index) => (
              <option key={index} value={value}>
                {value}
              </option>
            ))}
          </select>
        )}

        {/* If its a list of integers, set a dropdown */}
        {props.variable.type === PluginVariableTypes.NUMBER_LIST && (
          <select
            value={value as number}
            onChange={(e) => handleChange(e.target.value as any)}
          >
            {(props.variable.allowedValues as number[])?.map((value, index) => (
              <option key={index} value={value}>
                {value}
              </option>
            ))}
          </select>
        )}

        {/* If its a NUMBER_RANGE, set a slider */}
        {props.variable.type === PluginVariableTypes.NUMBER_RANGE && (
          <SliderVariableView
            variable={props.variable}
            onChange={handleChange}
          />
        )}

        {/* If its a editable string list, set a table with editable rows */}
        {props.variable.type === PluginVariableTypes.LIST && (
          <ListView variable={props.variable} onChange={handleChange} />
        )}

        {/* If its the special VariableList, use the specific view */}
        {props.variable.type === PluginVariableTypes._LIST && (
          <VariableListView variable={props.variable} onChange={handleChange} />
        )}

        {/* If the type is a FILE, set a button which, on the server, 
        will open the server file explorer. On the client, will open the file pickers */}
        {props.variable.type === PluginVariableTypes.FILE && (
          <FilePickerView
            openFolder={false}
            variable={props.variable}
            onChange={handleChange}
          />
        )}

        {props.variable.type === PluginVariableTypes.FOLDER && (
          <FilePickerView
            openFolder={true}
            variable={props.variable}
            onChange={handleChange}
          />
        )}

        {/* If the type is a STRUCTURE, set a dropdown with the Mols* structures */}
        {props.variable.type === PluginVariableTypes.STRUCTURE && (
          <select
            defaultValue=""
            defaultChecked={true}
            onChange={(e) => {
              // Get the selected structure
              const selectedStructure = structures.find(
                (structure) => structure.name === e.target.value
              );

              handleChange(selectedStructure);
            }}
            onMouseDown={() => {
              loadMolstarStructures();
            }}
          >
            {structures.length === 0 ? (
              <option value="" disabled>
                No loaded structures
              </option>
            ) : (
              <>
                {structures.map((structure, index) => (
                  <option key={index} value={structure.name}>
                    {structure.name}
                  </option>
                ))}
              </>
            )}
          </select>
        )}

        {/* If the type is a HETERORES, set a dropdown with the Mol* hetero residues */}
        {props.variable.type === PluginVariableTypes.HETERORES && (
          <HeteroResView
            handleChange={handleChange}
            variable={props.variable}
          />
        )}

        {/* If the type is a STDRES, set a dropdown with the Mol* std residues */}
        {props.variable.type === PluginVariableTypes.STDRES && (
          <StdResView handleChange={handleChange} variable={props.variable} />
        )}

        {/* If the type is a CHAIN, set a dropdown with the Mol* chains */}
        {props.variable.type === PluginVariableTypes.CHAIN && (
          <ChainView handleChange={handleChange} variable={props.variable} />
        )}

        {/* If the type is a ATOM, set a dropdown with the Mol* atoms */}
        {props.variable.type === PluginVariableTypes.ATOM && (
          <AtomView handleChange={handleChange} variable={props.variable} />
        )}

        {/* If the type is a SPHERE, set a X, Y, Z 
        input values with the Mol* sphere coodrinates*/}
        {props.variable.type === PluginVariableTypes.SPHERE && (
          <SphereVariableView
            handleChange={props.onChange}
            variable={props.variable}
          />
        )}

        {/* If the type is a SMILES, set a JSME component */}
        {props.variable.type === PluginVariableTypes.SMILES && (
          <SmilesVariableView
            handleChange={props.onChange}
            variable={props.variable}
          />
        )}
      </div>
    </div>
  );
};

type VariableViewProps = {
  variable: PluginVariable;
  onChange: (value: any) => void;
};

function IntegerFloatVariableView(props: VariableViewProps) {
  const { variable, onChange } = props;

  const [numberMessage, setNumberMessage] = useState<string | null>(null);

  const parseNum = (value: string) => {
    if (value === "") {
      setNumberMessage(null);
      return value;
    }

    const parsedValue = Number(value);

    if (isNaN(parsedValue)) {
      setNumberMessage(`The value must be a number`);
    } else {
      setNumberMessage(null);
    }

    if (variable.type === PluginVariableTypes.INTEGER) {
      const rounded = Math.round(parsedValue);
      if (isNaN(rounded)) {
        setNumberMessage(`The value must be an integer`);
        return value;
      } else {
        return rounded;
      }
    } else {
      return value;
    }
  };

  const parseInsideAllowedValues = (value: any) => {
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
    <div className="flex flex-col gap-2 p-2 justify-center text-center items-center">
      {numberMessage && <div className="text-red-500">{numberMessage}</div>}
      <input
        className="plugin-variable-value"
        value={variable.value}
        onChange={(e) => {
          const value = parseNum(e.target.value);
          parseInsideAllowedValues(value);
          onChange(value);
        }}
      />
    </div>
  );
}

function SliderVariableView(props: VariableViewProps) {
  const { variable, onChange } = props;

  const min = variable.allowedValues[0] ?? 0;
  const max = variable.allowedValues[1] ?? 10;
  const step = variable.allowedValues[2] ?? 1;

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
    <div className="flex flex-row gap-2 p-2" data-testid="slider-container">
      <Slider
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        dots
      />
      {variable.value}
    </div>
  );
}

type FilePickerViewProps = {
  variable?: PluginVariable;
  onChange: (value: any) => void;
  openFolder?: boolean;
};

function FilePickerView(props: FilePickerViewProps) {
  const { variable, onChange } = props;

  return (
    <HorusFileExplorer
      onFileConfirm={onChange}
      onFileSelect={onChange}
      openFolder={props.openFolder}
      allowedExtensions={variable?.allowedValues}
    >
      {variable.value || "Open file explorer..."}
    </HorusFileExplorer>
  );
}

type ListViewProps = {
  variable: PluginVariable;
  onChange: (value: any) => void;
};

function ListView(props: ListViewProps) {
  const [values, setValues] = useState(props.variable.value);

  const handleChange = (value: any) => {
    setValues(value);
    props.onChange(value);
  };

  useEffect(() => {
    handleChange(props.variable.value);
  }, [props.variable.value]);

  const addRow = () => {
    let newValues = values ? [...values] : [];
    if (props.variable.allowedValues) {
      newValues.push({
        value: "",
        type: props.variable.allowedValues[0],
      });
    } else {
      newValues = values ? [...values] : [];
      newValues.push("");
    }
    handleChange(newValues);
  };

  const removeRow = (index: number) => {
    if (!values) return;
    const newValues = [...values];
    newValues.splice(index, 1);
    handleChange(newValues);
  };

  const handleRowValueChange = (index: number, value: string) => {
    const newValues = [...values];
    if (props.variable.allowedValues) {
      newValues[index] = {
        value: value,
        type: props.variable.allowedValues[0],
      };
    } else {
      newValues[index] = value;
    }
    handleChange(newValues);
  };

  const handleRowTypeChange = (index: number, type: string) => {
    const newValues = [...values];
    newValues[index] = {
      value: newValues[index].value,
      type: type,
    };
    handleChange(newValues);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row gap-2 justify-center my-2">
        <NBDButton action={addRow}>Add row</NBDButton>
        <NBDButton
          action={() => {
            handleChange([]);
          }}
        >
          Clear
        </NBDButton>
      </div>
      {/* <hr
        style={{
          margin: "0",
          padding: "0",
        }}
      ></hr> */}
      {values?.length > 0 && (
        <div className="flex flex-col gap-2 pb-2">
          {values?.map((value, index) => (
            <div className="flex flex-row gap-2 items-center px-2">
              <input
                type="text"
                className="plugin-variable-value"
                value={props.variable.allowedValues ? value.value : value}
                onChange={(e) => handleRowValueChange(index, e.target.value)}
              />
              {
                // If the variable has a list of allowed values, set a dropdown
                props.variable.allowedValues && (
                  <select
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

type VariableSubviewProps = {
  handleChange: (value: any, id: string) => void;
  variable: PluginVariable;
};

function SmilesVariableView(props: VariableSubviewProps) {
  const [smiles, setSmiles] = useState(props.variable.value);
  const [showJsme, setShowJsme] = useState(false);

  const handleChange = (value) => {
    setSmiles(value);
    props.handleChange(value, props.variable.id);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const contents = e.target.result as string;
      const firstLine = contents.split("\n")[0];
      handleChange(firstLine);
    };
    reader.readAsText(file);
    handleDragEnd(e);
  };

  const handleDragEnd = (e) => {
    e.preventDefault();
    setTextAreaClassName("w-full text-black");
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setTextAreaClassName("w-full text-black bg-green-200");
  };

  const jsmeRef = useRef(null);

  const [textAreaClassName, setTextAreaClassName] =
    useState("w-full text-black");

  return (
    <div
      className="flex flex-col gap-2 p-2 max-h-60 overflow-auto"
      style={{
        width: "17rem",
      }}
    >
      <textarea
        className={textAreaClassName}
        style={{
          border: "1px solid #ccc",
          borderRadius: "0.25rem",
          // margin: "0.5rem",
          width: "100%",
          minHeight: "100px",
        }}
        value={smiles}
        onChange={(e) => handleChange(e.target.value)}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragEnd}
        onDragEnd={handleDragEnd}
      >
        {smiles}
      </textarea>
      <NBDButton
        style={{
          backgroundColor: showJsme ? "#a5d6a7" : "",
          justifyContent: "center",
        }}
        action={() => {
          setShowJsme(!showJsme);
        }}
      >
        {showJsme ? "Hide 2D structure" : "Show 2D structure"}
      </NBDButton>
      <div
        className="w-full text-black"
        style={{
          display: showJsme ? "block" : "none",
          border: "1px solid #ccc",
          borderRadius: "0.25rem",
        }}
      >
        <Jsme
          ref={jsmeRef}
          key="jsme"
          width="100%"
          height="200px"
          smiles={smiles}
          options="oldlook,star,depict"
          onChange={handleChange}
        />
      </div>
    </div>
  );
}

function AtomView(props: VariableSubviewProps) {
  const value = props.variable.value;

  const [atom, setAtom] = useState<any>(null);
  const [active, setActive] = useState(false);

  const handleAtomClick = (e: CustomEvent) => {
    const atomInfo = e?.detail?.atom;

    if (!atomInfo) return;

    setAtom(atomInfo);
    props.handleChange(atomInfo, props.variable.id);
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
    if (value) {
      setAtom(value);
    }
  }, [value]);

  return (
    <div
      onClick={() => setActive(!active)}
      className={`w-full max-h-28 overflow-auto ${
        active ? "bg-green-200" : ""
      }`}
    >
      {!atom ? (
        <div className="text-center">Click to select atom</div>
      ) : (
        <div className="text-center">
          {atom.atom_label} - {atom.sequence_position}
        </div>
      )}
    </div>
  );
}

function ChainView(props: VariableSubviewProps) {
  const value = props.variable.value;

  const [chains, setChains] = useState<any[]>([]);

  const loadMolstarChains = async () => {
    const molstar = window.molstar;
    const chains = await molstar?.listChains();

    if (!chains) setChains([]);

    setChains(chains);
  };

  useEffect(() => {
    loadMolstarChains();
  }, []);

  return (
    <div onMouseDown={loadMolstarChains}>
      {chains.length === 0 ? (
        <div className="text-center">No hetero atoms found</div>
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
                style={{ width: "1rem" }}
                type="checkbox"
                checked={
                  value &&
                  value.find((val) => val.name === chain.name) !== undefined
                }
                onChange={(e) => {
                  const newValue = chain;
                  const structure = chain.structure?.name;
                  if (structure) {
                    newValue.structure = structure;
                  }

                  if (!value) {
                    props.handleChange([newValue], props.variable.id);
                    return;
                  }

                  let updatedValues = [...value];

                  if (e.target.checked) {
                    updatedValues.push(newValue);
                  } else {
                    updatedValues = updatedValues.filter(
                      (val) => val.name !== newValue.name
                    );
                  }

                  props.handleChange(updatedValues, props.variable.id);
                }}
              />
              <div className="ml-2">{chain.chainID}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function StdResView(props: VariableSubviewProps) {
  const value = props.variable.value;

  const [stdRes, setStdRes] = useState<any[]>([]);
  const [filteredStdRes, setFilteredStdRes] = useState<any[]>([]);

  const filterResidues = (event) => {
    const filterValue = event.target.value;
    const filteredResidues = stdRes.filter((residue) =>
      residue.name.toLowerCase().includes(filterValue.toLowerCase())
    );

    setFilteredStdRes(filteredResidues);
  };

  const loadMolstarStdRes = async () => {
    const molstar = window.molstar;
    const residues = await molstar?.listStdRes();

    if (!residues) setStdRes([]);

    setStdRes(residues);
    setFilteredStdRes(residues);
  };

  useEffect(() => {
    loadMolstarStdRes();

    if (!value) {
      props.handleChange([], props.variable.id);
    }
  }, []);

  return (
    <div onMouseDown={loadMolstarStdRes} className="w-60">
      {stdRes.length === 0 ? (
        <div className="text-center">No residues found</div>
      ) : (
        <div className="w-full overflow-auto max-h-28 min-h-12">
          <SearchComponent
            placeholder="Search for a residue"
            onChange={filterResidues}
            showIcon={false}
          />
          {filteredStdRes.length > 0 ? (
            filteredStdRes.map((stdRes) => (
              <div
                key={stdRes.name}
                className="flex flex-row items-center justify-between"
                style={{
                  gap: "1rem",
                  textAlign: "left",
                  paddingInline: "0.5rem",
                }}
              >
                <input
                  style={{ width: "1rem" }}
                  type="checkbox"
                  checked={
                    value &&
                    value.find((val) => val.name === stdRes.name) !== undefined
                  }
                  onChange={(e) =>
                    props.handleChange(
                      e.target.checked
                        ? [...(value || []), stdRes]
                        : (value || []).filter(
                            (res) => res.name !== stdRes.name
                          ),
                      props.variable.id
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

function HeteroResView(props: VariableSubviewProps) {
  const value = props.variable.value;

  const [heteroRes, setHeteroRes] = useState<any[]>([]);

  const loadMolstarHeteroRes = async () => {
    const molstar = window.molstar;
    const residues = await molstar?.listHeteroRes();

    if (!residues) setHeteroRes([]);

    setHeteroRes(residues);
  };

  useEffect(() => {
    loadMolstarHeteroRes();
  }, []);

  return (
    <div onMouseDown={loadMolstarHeteroRes}>
      {heteroRes.length === 0 ? (
        <div className="text-center">No hetero atoms found</div>
      ) : (
        <>
          {heteroRes.map((hRes, index) => (
            <div
              key={index}
              className="flex flex-row items-center justify-between"
              style={{
                paddingInline: "0.5rem",
              }}
            >
              <input
                style={{ width: "1rem" }}
                type="checkbox"
                checked={
                  value &&
                  value.find((val) => val.name === hRes.name) !== undefined
                }
                onChange={(e) => {
                  const newValue = hRes;
                  const structure = hRes.structure?.name;
                  if (structure) {
                    newValue.structure = structure;
                  }

                  if (!value) {
                    props.handleChange([newValue], props.variable.id);
                    return;
                  }

                  let updatedValues = [...value];

                  if (e.target.checked) {
                    updatedValues.push(newValue);
                  } else {
                    updatedValues = updatedValues.filter(
                      (val) => val.name !== newValue.name
                    );
                  }
                  props.handleChange(updatedValues, props.variable.id);
                }}
              />
              <div className="ml-2">{hRes.name}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function SphereVariableView(props: VariableSubviewProps) {
  const [position, setPosition] = useState<{
    x: number;
    y: number;
    z: number;
  }>({ x: 0, y: 0, z: 0 });
  const [radius, setRadius] = useState(10);
  const sphereRef = useRef<SphereRef | null>(null);

  const [hasStructure, setHasStructure] = useState(false);
  const [active, setActive] = useState(false);
  const [activeColor, setActiveColor] = useState("#a5d6a7");
  const mounted = useRef(false);

  const handleChange = async (position, radius) => {
    const molstar = window.molstar;

    if (!molstar) return;

    const structures = molstar.listStructures();

    if (structures.length === 0) {
      setHasStructure(false);
      return;
    } else {
      setHasStructure(true);
    }

    if (!mounted.current) {
      return;
    }

    const ref = await molstar.addSphere(position, radius, 0.3, null, sphereRef.current);

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

    props.handleChange(sphereData, props.variable.id);
  };

  useEffect(() => {
    handleChange(position, radius);
  }, [position, radius]);

  // When unmounting, remove the sphere
  useEffect(() => {
    return () => {
      if (window.molstar) {
        window.molstar.removeSphere(sphereRef?.current?.ref);
      }
    };
  }, []);

  const handleCoordinates = (e: CustomEvent) => {
    if (active) {
      const data = e.detail;

      setPosition({
        x: data.x,
        y: data.y,
        z: data.z,
      });
    }
  };

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
  }, [active]);

  useEffect(() => {
    // Set the initial position to the variable value
    if (props.variable.value) {
      const sphereData = props.variable.value;

      setPosition({
        x: sphereData.center.x,
        y: sphereData.center.y,
        z: sphereData.center.z,
      });

      setRadius(sphereData.radius);

      sphereRef.current = sphereData.ref;
    }
    mounted.current = true;
  }, []);

  return hasStructure ? (
    <div className="flex flex-col p-2 gap-2">
      <div className="flex flex-row gap-2">
        Radius:
        <input
          className="plugin-variable-value"
          type="number"
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
        />
      </div>
      <div className="flex flex-row gap-2">
        X:
        <input
          className="plugin-variable-value"
          type="number"
          value={position.x}
          onChange={(e) =>
            setPosition({ ...position, x: Number(e.target.value) })
          }
        />
        Y:
        <input
          type="number"
          className="plugin-variable-value"
          value={position.y}
          onChange={(e) =>
            setPosition({ ...position, y: Number(e.target.value) })
          }
        />
        Z:
        <input
          type="number"
          className="plugin-variable-value"
          value={position.z}
          onChange={(e) =>
            setPosition({ ...position, z: Number(e.target.value) })
          }
        />
      </div>
      <NBDButton
        style={{
          backgroundColor: active ? activeColor : "",
          justifyContent: "center",
          marginTop: "0.5rem",
        }}
        action={() => {
          setActive(!active);
        }}
      >
        {active ? "Active" : "Inactive"}
      </NBDButton>
    </div>
  ) : (
    <div
      onClick={() => {
        handleChange({ x: 0, y: 0, z: 0 }, 10);
      }}
      className="text-center cursror-pointer"
    >
      No structure loaded
    </div>
  );
}

const InputOutputView = (props: { variable: PluginVariable }) => {
  return (
    <div className="plugin-variable">
      <div className="plugin-variable-name">{props.variable.name}</div>
      <div className="plugin-variable-description">
        {props.variable.description}
      </div>
      <div className="plugin-variable-id">Type: {props.variable.type}</div>
      <div className="plugin-variable-id">ID: {props.variable.id}</div>
    </div>
  );
};

type VariableBallViewProps = {
  variables: PluginVariable[];
  isConnecting: boolean;
  tryingToConnect: {
    variableID: string;
    variableType: PluginVariableTypes;
    variableAllowedValues: Array<string>;
  } | null;
  placedID: number;
  block: Block;

  handleSelectedInputGroupChange: (direction: "up" | "down") => void;
};

function VariableBallView(props: VariableBallViewProps) {
  const [forceShowVariables, setForceShowVariables] = useState(false);

  // const handleMouseClick = () => {
  //   setForceShowVariables(!forceShowVariables);
  // };

  const showVariables = props.isConnecting || forceShowVariables;

  const ballGroupClass = `variable-ball-group${
    showVariables ? " variable-ball-group-shown" : ""
  }`;

  useEffect(() => {
    setForceShowVariables(true);

    // setTimeout(() => {
    //   setForceShowVariables(false);
    // }, 1000);
  }, []);

  // Calcultate the height of the ball group
  const ballGroupHeight = props.variables.length * 2;

  const selectedPage = props.block.inputs.findIndex(
    (input) => input.id === props.block.selectedInputGroup
  );

  const changeInputGroupView = props.block.inputs.length > 1 &&
    props.block.variableConnections.length === 0 && (
      <div
        className="flex flex-row gap-1 items-center justify-between text-center p-0 m-0"
        style={{
          width: "10rem",
        }}
      >
        <NBDButton
          action={() => {
            props.handleSelectedInputGroupChange("down");
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-4 h-4 -rotate-90"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 15.75l7.5-7.5 7.5 7.5"
            />
          </svg>
        </NBDButton>
        <div>
          {selectedPage + 1} / {props.block.inputs.length}
        </div>
        <NBDButton
          action={() => {
            props.handleSelectedInputGroupChange("up");
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-4 h-4 -rotate-90"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
            />
          </svg>
        </NBDButton>
      </div>
    );

  return (
    <div key={props.variables.map((variable) => variable.id).join("-")}>
      <div
        className={ballGroupClass}
        style={{
          height: `${ballGroupHeight}rem`,
          width: "100%",
        }}
      >
        {props.variables.map((variable, index) => (
          <VariableConnectView
            key={index}
            variable={variable}
            tryingToConnect={props.tryingToConnect}
            setForceShowVariables={setForceShowVariables}
            placedID={props.placedID}
            block={props.block}
            // Calculate a delay for each item to create the "dropdown" effect
            style={{
              animationDelay: `${index * 0.1}s`,
              transition: "transform 0.2s ease-in-out",
              // transform: `translateY(${!showVariables ? -index * 2 : 0}rem)`,
            }}
          />
        ))}
        {changeInputGroupView}
      </div>
    </div>
  );
}

type VariableConnectViewProps = {
  variable: PluginVariable;
  tryingToConnect: {
    variableID: string;
    variableType: PluginVariableTypes;
    variableAllowedValues: Array<string>;
  } | null;
  style: React.CSSProperties;
  setForceShowVariables: React.Dispatch<React.SetStateAction<boolean>>;
  placedID: number;
  block: Block;
};

function VariableConnectView(props: VariableConnectViewProps) {
  const compareAllowedValues = (
    variableType: PluginVariableTypes,
    otherVariableType: PluginVariableTypes,
    allowedValues: Array<string>,
    tryingToConnect: Array<string>
  ) => {
    if (
      variableType === PluginVariableTypes.ANY ||
      otherVariableType === PluginVariableTypes.ANY
    ) {
      return true;
    }

    // If the input and output are different than FILE
    // check the type instead of the allowed values
    if (
      variableType !== PluginVariableTypes.FILE &&
      variableType !== PluginVariableTypes.GROUP &&
      variableType !== PluginVariableTypes._LIST &&
      variableType === otherVariableType
    ) {
      return true;
    }

    // For file type and group, check that the allowedValues of variable and other variable match
    if (
      variableType === PluginVariableTypes.FILE &&
      otherVariableType === PluginVariableTypes.FILE
    ) {
      if (allowedValues.includes("*") || tryingToConnect.includes("*")) {
        return true;
      }
    }

    for (let i = 0; i < allowedValues.length; i++) {
      if (tryingToConnect.includes(allowedValues[i])) {
        return true;
      }
    }
    return false;
  };

  const blockVarPair: BlockVarPair = {
    placedID: props.block.placedID,
    blockID: props.block.id,
    blockType: props.block.type,
    variableID: props.variable.id,
    variableType: props.variable.type,
    variableAllowedValues: props.variable.allowedValues,
  };

  const id = `connect-${props.variable.id}-${props.placedID}`;

  const { setNodeRef, isOver, active } = useDroppable({
    id: id,
    data: {
      blockVarPair: blockVarPair,
    },
  });

  let allowedValues: Array<string> = [];

  if (props.variable?.allowedValues) {
    allowedValues = props.variable.allowedValues as Array<string>;
  }

  let classNameVariableBall: string = "variable-ball";
  if (props.tryingToConnect) {
    const acceptConnection = compareAllowedValues(
      props.variable.type,
      props.tryingToConnect.variableType,
      allowedValues as Array<string>,
      (props.tryingToConnect.variableAllowedValues as Array<string>) ||
        ([] as Array<string>)
    );
    if (acceptConnection) {
      classNameVariableBall = "variable-ball variable-ball-accept";
    } else if (!acceptConnection) {
      classNameVariableBall = "variable-ball variable-ball-reject";
    }
  }

  const activePair = active?.data?.current?.blockVarPair as BlockVarPair;

  if (isOver && activePair) {
    const acceptConnection = compareAllowedValues(
      props.variable.type,
      activePair.variableType,
      allowedValues as Array<string>,
      (activePair.variableAllowedValues as Array<string>) ||
        ([] as Array<string>)
    );

    if (acceptConnection) {
      classNameVariableBall =
        "variable-ball variable-ball-accept variable-ball-flashing";
    } else if (!acceptConnection) {
      classNameVariableBall =
        "variable-ball variable-ball-reject variable-ball-flashing";
    }
  }

  // If the active block is not a "connect", don't show the animation
  if (active?.data?.current?.type !== "connector") {
    classNameVariableBall = "variable-ball";
  }

  return (
    <div style={props.style}>
      <div
        ref={setNodeRef}
        id={id}
        className="flex flex-row gap-1 align-center items-center variable-squared"
      >
        <div className={classNameVariableBall} />
        {props.variable.name}
      </div>
    </div>
  );
}

type OutputConnectViewProps = {
  block: Block;
};

function OutputConnectView(props: OutputConnectViewProps) {
  return (
    <div className="variable-ball-group variable-ball-group-shown">
      {props.block.outputs.map((output, index) => (
        <OutputVariableBallConnector
          key={index}
          blockVarPair={{
            placedID: props.block.placedID,
            blockID: props.block.id,
            blockType: props.block.type,
            variableID: output.id,
            variableType: output.type,
            variableAllowedValues: output.allowedValues,
          }}
          name={output.name}
        />
      ))}
    </div>
  );
}

type OutputVariableBallConnectorProps = {
  blockVarPair: BlockVarPair;
  name: string;
};

const outputSVG = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-6 h-6"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5"
    />
  </svg>
);

function OutputVariableBallConnector(props: OutputVariableBallConnectorProps) {
  const id = `output-drag-${props.blockVarPair.variableID}-${props.blockVarPair.placedID}-connector`;

  const { setNodeRef, transform, listeners, attributes } = useDraggable({
    id: id,
    data: {
      blockVarPair: props.blockVarPair,
      type: "connector",
    },
  });

  let style = {};
  if (transform) {
    style = {
      transform: `translate(${transform.x}px, ${transform.y}px)`,
    };
  }

  const ref = useRef(null);

  useEffect(() => {
    setNodeRef(ref.current);
  }, [ref]);

  return (
    <div
      id={id}
      className="flex flex-row gap-1 align-center items-center output-squared justify-between"
    >
      {props.name}
      <div style={style} id={id} ref={ref} {...listeners} {...attributes}>
        {outputSVG}
        {transform && (
          <Xarrow
            start={id}
            end={ref}
            endAnchor={"right"}
            dashness={{ animation: -2 }}
            color={"#0d47a1"}
          />
        )}
      </div>
    </div>
  );
}

export {
  PluginVariableView,
  InputOutputView,
  VariableBallView,
  OutputConnectView,
};
