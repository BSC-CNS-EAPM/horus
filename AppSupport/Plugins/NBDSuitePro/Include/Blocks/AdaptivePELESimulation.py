"""
AdaptivePELE Simulation block

https://nbdsoftware.github.io/NBDSuite/user_guide/blocks/pele/adaptive_pele_simulation.html
"""
from HorusAPI import PluginVariable, PluginBlock, VariableTypes

# Input
input_yaml = PluginVariable(
    name="Input file",
    id="input_yaml",
    description="The input file for the NBD Suite.",
    type=VariableTypes.FILE,
    allowedValues=["nbdinput"],
)

# Variables
pele_steps = PluginVariable(
    name="PELE steps",
    id="pele_steps",
    description="The number of PELE steps to perform.",
    type=VariableTypes.INTEGER,
    defaultValue=10,
)

adaptive_epochs = PluginVariable(
    name="Adaptive epochs",
    id="adaptive_epochs",
    description="The number of adaptive epochs to perform.",
    type=VariableTypes.INTEGER,
    defaultValue=5,
)

adaptive_spawning_type = PluginVariable(
    name="Adaptive spawning type",
    id="adaptive_spawning_type",
    description="Type of spawning to perform with Adaptive.",
    type=VariableTypes.STRING_LIST,
    allowedValues=["inverselyProportional", "epsilon", "independent", "independentMetric"],
    defaultValue="inverselyProportional",
)

adaptive_bias_column = PluginVariable(
    name="Adaptive bias column",
    id="adaptive_bias_column",
    description="Metrics column in PELE reports from where bias values will be extracted for AdaptivePELE.",
    type=VariableTypes.INTEGER,
    defaultValue=None,
)

adaptive_epsilon = PluginVariable(
    name="Adaptive epsilon",
    id="adaptive_epsilon",
    description="Epsilon to define the bias strength of AdaptivePELE. This parameter defines the fraction of trajectories that will be assigned in order to apply the bias towards the selected metric. It is a value between 0 and 1. This can only be set when adaptive_spawning_type is set to epsilon.",
    type=VariableTypes.FLOAT,
    defaultValue=None,
)

adaptive_bias_conditions = PluginVariable(
    name="Adaptive bias conditions",
    id="adaptive_bias_conditions",
    description="Selects whether to promote maximum or minimum values in epsilon related AdaptivePELE simulations. This can only be set when adaptive_spawning_type is set to epsilon.",
    type=VariableTypes.STRING_LIST,
    defaultValue="min",
    allowedValues=["min", "max"],
)

adaptive_spawning_density = PluginVariable(
    name="Adaptive spawning density",
    id="adaptive_spawning_density",
    description="The method of which to calculate the density of the cluster. If not defined here, Adaptive will automatically set to constant (or null).",
    type=VariableTypes.STRING_LIST,
    defaultValue="null",
    allowedValues=["null", "constant", "heaviside", "continuous", "exitContinuous"],
)

adaptive_exit_condition = PluginVariable(
    name="Adaptive exit condition",
    id="adaptive_exit_condition",
    description="The properties of an exit condition, which stops the simulation when a certain condition is met. Default is None, i.e. no exit condition is set. To set, the input must be a dictionary with the following keys: type (str), metricCol (int), exitValue (float), condition (str, < or >) and numberTrajectories (int).",
    type=VariableTypes.LIST,
    allowedValues=["type", "metricCol", "exitValue", "condition", "numberTrajectories"],
)

adaptive_threshold_calculator_value = PluginVariable(
    name="Adaptive threshold calculator value",
    id="adaptive_threshold_calculator_value",
    description=" Values assigned according to a set of step functions that vary according to a ratio of protein-ligand contacts and Ligand size. The list supplied must be the same length as that of adaptive_threshold_calculator_conditions.",
    type=VariableTypes.LIST,
    defaultValue=[1.75, 2.5, 4, 6],
)

adaptive_threshold_calculator_conditions = PluginVariable(
    name="Adaptive threshold calculator conditions",
    id="adaptive_threshold_calculator_conditions",
    description="The condition list that is iterated until r > condition[i], and the used threshold is values[i]. The list supplied must be the same length as that of adaptive_threshold_calculator_values.",
    type=VariableTypes.LIST,
    defaultValue=[1, 0.6, 0.4, 0.0],
)

adaptive_threshold_distance = PluginVariable(
    name="Adaptive threshold distance",
    id="adaptive_threshold_distance",
    description=" Maximum distance at which two atoms have to be separated to be considered in contact. If not defined here, Adaptive will set it to 8.",
    type=VariableTypes.FLOAT,
    defaultValue=8,
)

# Outputs
output_yaml = PluginVariable(
    name="Input file",
    id="output_yaml",
    description="The input file for the NBD Suite.",
    type=VariableTypes.FILE,
    allowedValues=["nbdinput"],
)


def generateAdaptivePELESimulationInput(block: PluginBlock):
    input_yaml_recieved = block.inputs.get("input_yaml", None)

    if input_yaml_recieved is None:
        raise Exception("No input yaml recieved")

    pele_steps_value = block.variables.get("pele_steps", 10)
    adaptive_epochs_value = block.variables.get("adaptive_epochs", 5)
    adaptive_spawning_type_value = block.variables.get(
        "adaptive_spawning_type", "inverselyProportional"
    )
    adaptive_bias_column_value = block.variables.get("adaptive_bias_column", "null")
    adaptive_epsilon_value = block.variables.get("adaptive_epsilon", "null")
    adaptive_bias_conditions_value = block.variables.get("adaptive_bias_conditions", "min")
    adaptive_spawning_density_value = block.variables.get("adaptive_spawning_density", "null")
    adaptive_exit_condition_value = block.variables.get("adaptive_exit_condition", "null")

    adaptive_exit_condition_dict = {}
    for item in adaptive_exit_condition_value:
        adaptive_exit_condition_dict[item["type"]] = item["value"]
    adaptive_exit_condition_value = adaptive_exit_condition_dict

    adaptive_threshold_calculator_value_value = block.variables.get(
        "adaptive_threshold_calculator_value", [1.75, 2.5, 4, 6]
    )
    adaptive_threshold_calculator_conditions_value = block.variables.get(
        "adaptive_threshold_calculator_conditions", [1, 0.6, 0.4, 0.0]
    )
    adaptive_threshold_distance_value = block.variables.get("adaptive_threshold_distance", 8)

    inputContents = yamlContent(
        pele_steps_value,
        adaptive_epochs_value,
        adaptive_spawning_type_value,
        adaptive_bias_column_value,
        adaptive_epsilon_value,
        adaptive_bias_conditions_value,
        adaptive_spawning_density_value,
        adaptive_exit_condition_value,
        adaptive_threshold_calculator_value_value,
        adaptive_threshold_calculator_conditions_value,
        adaptive_threshold_distance_value,
    )

    # Append to the input yaml file the pele simulation block
    with open(input_yaml_recieved, "a") as f:
        f.write(inputContents)

    print("Appended the AdaptivePELE Simulation block.")

    block.setOutput("output_yaml", input_yaml_recieved)


AdaptivePELESimulationBlock = PluginBlock(
    name="AdaptivePELE Simulation",
    description="Runs an AdaptivePELE simulation on the input complexes.",
    inputs=[input_yaml],
    variables=[
        pele_steps,
        adaptive_epochs,
        adaptive_spawning_type,
        adaptive_bias_column,
        adaptive_epsilon,
        adaptive_bias_conditions,
        adaptive_spawning_density,
        adaptive_exit_condition,
        adaptive_threshold_calculator_value,
        adaptive_threshold_calculator_conditions,
        adaptive_threshold_distance,
    ],
    outputs=[output_yaml],
    action=generateAdaptivePELESimulationInput,
)


def yamlContent(
    pele_steps,
    adaptive_epochs,
    adaptive_spawning_type,
    adaptive_bias_column,
    adaptive_epsilon,
    adaptive_bias_conditions,
    adaptive_spawning_density,
    adaptive_exit_condition,
    adaptive_threshold_calculator_value,
    adaptive_threshold_calculator_conditions,
    adaptive_threshold_distance,
):
    return f"""
- block: adaptive_pele_simulation
    options:
    pele_steps: {pele_steps}
    adaptive_epochs: {adaptive_epochs}
    adaptive_spawning_type: {adaptive_spawning_type}
    adaptive_bias_column: {adaptive_bias_column}
    adaptive_epsilon: {adaptive_epsilon}
    adaptive_bias_conditions: {adaptive_bias_conditions}
    adaptive_spawning_density: {adaptive_spawning_density}
    adaptive_exit_condition: {adaptive_exit_condition}
    adaptive_threshold_calculator_value: {adaptive_threshold_calculator_value}
    adaptive_threshold_calculator_conditions: {adaptive_threshold_calculator_conditions}
    adaptive_threshold_distance: {adaptive_threshold_distance}"""
