import React, { useEffect, useState, useRef } from "react";
import { Jsme } from "jsme-react";
import { useDroppable } from "@dnd-kit/core";
import {
  Block,
  BlockVarPair,
  PluginVariable,
  PluginVariableTypes,
} from "./flow_builder_types";
import { horusGet, horusPost } from "../../Utils/utils";
import NBDButton from "../nbdbutton";
import { SearchComponent } from "../Toolbar/toolbar";

type PluginVariableViewProps = {
  variable: PluginVariable;
  onChange: (value: any, id: string) => void;
  hideName?: boolean;
};

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

  return (
    <div className="plugin-variable">
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

        {props.variable.type === PluginVariableTypes.INTEGER && (
          <input
            type="number"
            value={value as number}
            onChange={(e) => handleChange(e.target.value as any)}
          />
        )}

        {props.variable.type === PluginVariableTypes.FLOAT && (
          <input
            type="number"
            value={value as number}
            onChange={(e) => handleChange(e.target.value as any)}
          />
        )}

        {/* If its a boolean, set a checkbox */}
        {props.variable.type === PluginVariableTypes.BOOLEAN && (
          <input
            style={{ marginLeft: "50%" }}
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
        {props.variable.type === PluginVariableTypes.INTEGER_LIST && (
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

        {/* If its a list of floats, set a dropdown */}
        {props.variable.type === PluginVariableTypes.FLOAT_LIST && (
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

        {/* If its a list of booleans, set radio items*/}
        {props.variable.type === PluginVariableTypes.BOOLEAN_LIST && (
          <div className="flex flex-row">
            {(props.variable.allowedValues as boolean[])?.map(
              (value, index) => (
                <div key={index} className="flex flex-row items-center">
                  <input
                    type="radio"
                    checked={value === (value as boolean)}
                    onChange={(e) => handleChange(value as any)}
                  />
                  <div className="ml-2">{value}</div>
                </div>
              )
            )}
          </div>
        )}

        {/* If the type is a FILE, set a button which, on the server, 
        will open the server file explorer. On the client, will open the file pickers */}
        {props.variable.type === PluginVariableTypes.FILE && (
          <button
            onClick={async () => {
              const header = {
                "Content-Type": "application/json",
                accept: "application/json",
              };

              const body = JSON.stringify({
                extensions: props.variable.allowedValues,
              });

              const request = await horusPost("/openfile", header, body);

              const data = await request.json();

              // If the data.path is a list, store only the first element
              const path = Array.isArray(data.path) ? data.path[0] : data.path;

              handleChange(path);
            }}
          >
            {props.variable.value || "Select file"}
          </button>
        )}

        {props.variable.type === PluginVariableTypes.FOLDER && (
          <button
            onClick={async () => {
              const request = await horusGet("/openfolder");

              const data = await request.json();

              const file = data.path;

              handleChange(file);
            }}
          >
            {props.variable.value || "Select folder"}
          </button>
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

  const [atoms, setAtoms] = useState<any[]>([]);

  const loadMolstarAtoms = async () => {
    const molstar = window.molstar;
    const atoms = molstar?.getSelectedStructures();

    if (!atoms) setAtoms([]);

    setAtoms(atoms);

    props.handleChange(atoms, props.variable.id);
  };

  useEffect(() => {
    loadMolstarAtoms();

    // Listen for the molstar-coordinates event
    window.addEventListener("molstar-coordinates", loadMolstarAtoms);

    return () => {
      window.removeEventListener("molstar-coordinates", loadMolstarAtoms);
    };
  }, []);

  return (
    <div
      onMouseDown={loadMolstarAtoms}
      className="w-full max-h-28 overflow-auto"
    >
      {atoms.length === 0 ? (
        <div className="text-center">No atoms selected</div>
      ) : (
        atoms.map((atom) => (
          <div className="text-center">
            {atom.auth_atom_id} - {atom.sourceIndex} - {atom.structure.name}
          </div>
        ))
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
                  checked={value?.name?.includes(stdRes.name)}
                  onChange={(e) =>
                    props.handleChange(
                      e.target.checked
                        ? [...value, stdRes]
                        : value.filter((res) => res.name !== stdRes.name),
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
  const sphereRef = useRef<string | null>(null);

  const [hasStructure, setHasStructure] = useState(false);
  const [active, setActive] = useState(false);
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

    const ref = await molstar.addSphere(position, radius, sphereRef.current);

    sphereRef.current = ref;

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
          backgroundColor: active ? "#a5d6a7" : "",
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
      variableType === otherVariableType
    ) {
      return true;
    }

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
        className="flex flex-row gap-1 align-center items-center absolute variable-squared"
      >
        <div className={classNameVariableBall} />
        {props.variable.name}
      </div>
    </div>
  );
}

export { PluginVariableView, InputOutputView, VariableBallView };
