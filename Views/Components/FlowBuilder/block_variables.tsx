import { useEffect, useState } from "react";

import {
  PluginVariable,
  PluginVariableType,
  PluginVariableTypes,
} from "./flow_builder_interfaces";

const PluginVariableView = <T extends PluginVariableType>(props: {
  variable: PluginVariable<T>;
  onChange: (value: T, id: string) => void;
}) => {
  const [value, setValue] = useState<T>(props.variable.value);

  const handleChange = (value: T) => {
    setValue(value);
    props.onChange(value, props.variable.id);
  };

  useEffect(() => {
    handleChange(props.variable.value);
  }, [props.variable.value]);

  return (
    <div className="plugin-variable">
      <div className="plugin-variable-name">{props.variable.name}</div>
      <div className="plugin-variable-description">
        {props.variable.description}
      </div>
      <div className="plugin-variable-value">
        {/* Define an input based on the type */}

        {/* If its a string, int or float, set a basic input */}
        {props.variable.type === PluginVariableTypes.STRING && (
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

        {/* If the type is a FILE, set a file upload button */}
        {props.variable.type === PluginVariableTypes.FILE && (
          <input
            type="file"
            onChange={(e) => handleChange(e.target.files[0] as any)}
          />
        )}
      </div>
    </div>
  );
};

export { PluginVariableView };
