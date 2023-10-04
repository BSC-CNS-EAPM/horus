"""
PELE Simulation block

https://nbdsoftware.github.io/NBDSuite/user_guide/blocks/pele/pele_simulation.html
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

#######################
# NBDSuite Parameters #
#######################
combine_pele_results_across_blocks = PluginVariable(
    name="Combine PELE results across blocks",
    id="combine_pele_results_across_blocks",
    description="When set to True, PELE results will be generated considering the exploration obtained from each topology across the different Blocks.",
    type=VariableTypes.BOOLEAN,
    defaultValue=False,
)

pele_representatives_criterion = PluginVariable(
    name="PELE representatives criterion",
    id="pele_representatives_criterion",
    description="The criterion to use in the definition of the structure representatives of each cluster obtained in PELE.",
    type=VariableTypes.STRING_LIST,
    allowedValues=["interaction_min", "interaction_max", "rmsd"],
    defaultValue="interaction_min",
)

only_prepare_input = PluginVariable(
    name="Only prepare input",
    id="only_prepare_input",
    description="When enabled PELE will not be executed but all its input files will be built. Use it when you want to call PELE yourself.",
    type=VariableTypes.BOOLEAN,
    defaultValue=False,
)

max_conformations_to_take = PluginVariable(
    name="Max conformations to take",
    id="max_conformations_to_take",
    description=" It defines the maximum number of conformations to take for each ligand that is simulated with PELE.",
    type=VariableTypes.INTEGER,
    defaultValue=5,
)

######################
# General Parameters #
######################

pele_steps = PluginVariable(
    name="PELE steps",
    id="pele_steps",
    description="Number of PELE steps to perform.",
    type=VariableTypes.INTEGER,
    defaultValue=20,
)

pele_temperature = PluginVariable(
    name="PELE temperature",
    id="pele_temperature",
    description="The System temperature in Kelvin (K) to consider during the Metropolis criterion.",
    type=VariableTypes.FLOAT,
    defaultValue=1500.0,
)

pele_trajectory_format = PluginVariable(
    name="PELE trajectory format",
    id="pele_trajectory_format",
    description="The format to use when writing PELE trajectories.",
    type=VariableTypes.STRING_LIST,
    allowedValues=["xtc", "pdb"],
    defaultValue="xtc",
)

pele_activate_proximity_detection = PluginVariable(
    name="PELE activate proximity detection",
    id="pele_activate_proximity_detection",
    description="Whether to activate the proximity detection in PELE.",
    type=VariableTypes.BOOLEAN,
    defaultValue=True,
)

activate_pele_minimum_steps = PluginVariable(
    name="Activate PELE minimum steps",
    id="activate_pele_minimum_steps",
    description="Controls whether the minimum steps option in PELE is enabled or not. When activated processes will not stop when they reach the minimum number of PELE steps to perform and will only stop once all processes have reached this minimum amount of PELE steps.",
    type=VariableTypes.BOOLEAN,
    defaultValue=False,
)

# Need more info about this variable
# pele_parameter_changes = PluginVariable(

###########################
# Perturbation Parameters #
###########################
pele_perturbation_level = PluginVariable(
    name="PELE perturbation level",
    id="pele_perturbation_level",
    description="Level that manages the strength of the perturbation algorithm of PELE. The higher, the stronger the perturbation is. If it is set to 0, the perturbation is completely disabled.",
    type=VariableTypes.INTEGER_LIST,
    defaultValue=2,
    allowedValues=[0, 1, 2, 3, 4, 5],
)

pele_rotation_scaling_factor = PluginVariable(
    name="PELE rotation scaling factor",
    id="pele_rotation_scaling_factor",
    description="Factor used to generate the rotation angles in the perturbation algorithm of PELE. If it is set to 0, the rotation is completely disabled. Range [0.0, 0.5].",
    type=VariableTypes.FLOAT,
)

pele_translation_range = PluginVariable(
    name="PELE translation range",
    id="pele_translation_range",
    description="Factor in the length of the random translation used in the perturbation algorithm of PELE. If it is set to 0, the translation is completely disabled. Range [0.0, inf].",
    type=VariableTypes.FLOAT,
)

pele_steering_update_frequency = PluginVariable(
    name="PELE steering update frequency",
    id="pele_steering_update_frequency",
    description="Frequency to update the steering direction used in the perturbation algorithm of PELE. If it is set to 0, then steering is deactivated and a random translation direction is used, until this parameter is changed again to a value greater than 0. Range [0, inf].",
    type=VariableTypes.FLOAT,
)

pele_perturbation_trials = PluginVariable(
    name="PELE perturbation trials",
    id="pele_perturbation_trials",
    description="Number of iterations in the perturbation algorithm of PELE. Range [0, inf].",
    type=VariableTypes.FLOAT,
)

pele_perturbation_steric_trials = PluginVariable(
    name="PELE perturbation steric trials",
    id="pele_perturbation_steric_trials",
    description="Number of steric trials in the perturbation algorithm of PELE. Range [0, inf].",
    type=VariableTypes.FLOAT,
)

pele_perturbation_type = PluginVariable(
    name="PELE perturbation type",
    id="pele_perturbation_type",
    description="Selects the Ligand perturbation that is going to be used.",
    type=VariableTypes.STRING_LIST,
    allowedValues=["naive", "metropolis"],
    defaultValue="naive",
)

pele_perturbation_translation_direction = PluginVariable(
    name="PELE perturbation translation direction",
    id="pele_perturbation_translation_direction",
    description="Selects the translation direction generation.",
    type=VariableTypes.STRING_LIST,
    allowedValues=["random", "steered"],
    defaultValue="steered",
)

pele_perturbation_rotation_angles = PluginVariable(
    name="PELE perturbation rotation angles",
    id="pele_perturbation_rotation_angles",
    description="The method of generating the rotation angles.",
    type=VariableTypes.STRING_LIST,
    allowedValues=["coupled", "nonCoupled"],
    defaultValue="nonCoupled",
)

pele_perturbation_overlap_factor = PluginVariable(
    name="PELE perturbation overlap factor",
    id="pele_perturbation_overlap_factor",
    description="The criteria that determines when two atoms are clashing.",
    type=VariableTypes.FLOAT,
    defaultValue=0.65,
)

pele_perturbation_box_type = PluginVariable(
    name="PELE perturbation box type",
    id="pele_perturbation_box_type",
    description="The shape the of box that defines the region of perturbation.",
    type=VariableTypes.STRING_LIST,
    allowedValues=["sphericalBox", "cubicBox"],
    defaultValue="sphericalBox",
)

pele_perturbation_box_radius = PluginVariable(
    name="PELE perturbation box radius",
    id="pele_perturbation_box_radius",
    description="Radius for the box that will define the restricted volume of the search space.",
    type=VariableTypes.FLOAT,
    defaultValue=5.0,
)

pele_perturbation_COM_constraint_constant = PluginVariable(
    name="PELE perturbation COM constraint constant",
    id="pele_perturbation_COM_constraint_constant",
    description="Adds a constraint to the center of mass of the perturbed atom set after the perturbation. This will affect the ANM, Side Chain prediction, and the minimization phases. The constraint is removed before the Metropolis test.",
    type=VariableTypes.FLOAT,
    defaultValue=1.0,
)

##################
# ANM Parameters #
##################

disable_pele_anm = PluginVariable(
    name="Disable PELE ANM",
    id="disable_pele_anm",
    description="When set to True, the ANM step of the PELE simulation is disabled, which is enabled by default.",
    type=VariableTypes.BOOLEAN,
    defaultValue=False,
)

pele_anm_frequency = PluginVariable(
    name="PELE ANM frequency",
    id="pele_anm_frequency",
    description="Frequency in number of steps to perform ANM.",
    type=VariableTypes.INTEGER,
    defaultValue=0,
)

####################################
# Side Chain Prediction Parameters #
####################################
pele_side_chain_prediction_frequency = PluginVariable(
    name="PELE side chain prediction frequency",
    id="pele_side_chain_prediction_frequency",
    description=" Frequency in number of steps to perform the side chain prediction.",
    type=VariableTypes.INTEGER,
    defaultValue=2,
)

pele_side_chain_prediction_region_radius = PluginVariable(
    name="PELE side chain prediction region radius",
    id="pele_side_chain_prediction_region_radius",
    description="Links within this radius from the Ligand will be considered by the side prediction algorithm.",
    type=VariableTypes.INTEGER,
    defaultValue=6,
)

pele_side_chain_prediction_resolution = PluginVariable(
    name="PELE side chain prediction resolution",
    id="pele_side_chain_prediction_resolution",
    description="Resolution in degrees to be considered when determining the best combination of side chain rotamers around the Ligand.",
    type=VariableTypes.INTEGER_LIST,
    allowedValues=[10, 20, 30, 40],
    defaultValue=10,
)

###########################
# Minimization Parameters #
###########################
disable_pele_minimization = PluginVariable(
    name="Disable PELE minimization",
    id="disable_pele_minimization",
    description="When set to True, the PELE minimization step of the PELE simulation is disabled, which is enabled by default.",
    type=VariableTypes.BOOLEAN,
    defaultValue=False,
)

pele_minimization_frequency = PluginVariable(
    name="PELE minimization frequency",
    id="pele_minimization_frequency",
    description="Frequency in number of steps to perform the constrained minimization (if side chain prediction was not performed in that step).",
    type=VariableTypes.INTEGER,
    defaultValue=1,
)

pele_minimizer_algorithm = PluginVariable(
    name="PELE minimizer algorithm",
    id="pele_minimizer_algorithm",
    description="Which minimization algorithm to use.",
    type=VariableTypes.STRING_LIST,
    allowedValues=["ConjugateGradient", "TruncatedNewton", "SteepestDescent"],
    defaultValue="TruncatedNewton",
)

pele_minimizer_maximum_newton_iterations = PluginVariable(
    name="PELE minimizer maximum newton iterations",
    id="pele_minimizer_maximum_newton_iterations",
    description="Maximum number of iterations for the Newton method.",
    type=VariableTypes.INTEGER,
    defaultValue=None,
)

pele_minimizer_non_bonding_list_updated_each_min_step = PluginVariable(
    name="PELE minimizer non bonding list updated each min step",
    id="pele_minimizer_non_bonding_list_updated_each_min_step",
    description="Controls whether the NB list is updated after each minimization step or not.",
    type=VariableTypes.BOOLEAN,
    defaultValue=True,
)

pele_perturbation_alpha_updated = PluginVariable(
    name="PELE perturbation alpha updated",
    id="pele_perturbation_alpha_updated",
    description="Controls whether the Born alpha radius is updated after each minimization step or not.",
    type=VariableTypes.BOOLEAN,
    defaultValue=False,
)

################
# PELE Metrics #
################
pele_task_metrics = PluginVariable(
    name="PELE task metrics",
    id="pele_task_metrics",
    description="Sets the tasks for PELE metrics. Input is a list of dictionaries, with each dictionary corresponding to a particular task. Each dictionary must have certain keys. Common to all dictionaries are the keys type (mandatory) and 'tag' (optional).",
    type=VariableTypes.STRING_LIST,
    allowedValues=["binding_energy", "sasa", "rmsd", "rand", "com_distance"],
    defaultValue=None,
)

####################
# PELE Constraints #
####################

pele_include_metal_constraints = PluginVariable(
    name="PELE include metal constraints",
    id="pele_include_metal_constraints",
    description="Whether to automatically constrain metals to keep coordination during a PELE simulation or not. Note that when disabling it, metal coordination will not be guaranteed and custom constraints should be added manually to keep coordination.",
    type=VariableTypes.BOOLEAN,
    defaultValue=True,
)

pele_harmonic_constraints = PluginVariable(
    name="PELE harmonic constraints",
    id="pele_harmonic_constraints",
    description="Custom harmonic constraints to be included in a PELE simulation. Several constraint types are supported.",
    type=VariableTypes.LIST,
    allowedValues=["atom_point", "atom_atom", "angle", "dihedral"],
)

pele_backbone_constaints_level = PluginVariable(
    name="PELE backbone constaints level",
    id="pele_backbone_constaints_level",
    description="Level that manages the strength of the backbone constraints applied in the PELE simulation. The higher, the stronger the constraints are. If it is set to 0, no constraints are applied on the backbone.",
    type=VariableTypes.INTEGER_LIST,
    defaultValue=3,
    allowedValues=[0, 1, 2, 3],
)

pele_backbone_terminal_constaints = PluginVariable(
    name="PELE backbone terminal constaints",
    id="pele_backbone_terminal_constaints",
    description="Sets the spring constant for the constraints of terminal alpha carbon atoms. Range [0.0, inf].",
    type=VariableTypes.FLOAT,
    defaultValue=None,
)

pele_backbone_intermediate_constraints = PluginVariable(
    name="PELE backbone intermediate constraints",
    id="pele_backbone_intermediate_constraints",
    description="Sets the spring constant for the constraints of intermediate alpha carbon atoms. Range [0.0, inf].",
    type=VariableTypes.FLOAT,
    defaultValue=None,
)

pele_backbone_constaints_interval = PluginVariable(
    name="PELE backbone constaints interval",
    id="pele_backbone_constaints_interval",
    description="Sets the interval at which the backbone alpha carbon atoms should be constrained. Range [1, inf].",
    type=VariableTypes.INTEGER,
    defaultValue=1,
)

# Outputs
output_yaml = PluginVariable(
    name="Input file",
    id="output_yaml",
    description="The input file for the NBD Suite.",
    type=VariableTypes.FILE,
    allowedValues=["nbdinput"],
)


def generatePELESimulationInput(block: PluginBlock):
    input_yaml_recieved = block.inputs.get("input_yaml", None)

    if input_yaml_recieved is None:
        raise Exception("No input yaml recieved")

    combine_pele_results_across_blocks_value = block.variables.get(
        "combine_pele_results_across_blocks", None
    )
    pele_representatives_criterion_value = block.variables.get(
        "pele_representatives_criterion", None
    )
    only_prepare_input_value = block.variables.get("only_prepare_input", None)
    max_conformations_to_take_value = block.variables.get("max_conformations_to_take", None)
    pele_steps_value = block.variables.get("pele_steps", None)
    pele_temperature_value = block.variables.get("pele_temperature", None)
    pele_trajectory_format_value = block.variables.get("pele_trajectory_format", None)
    pele_activate_proximity_detection_value = block.variables.get(
        "pele_activate_proximity_detection", None
    )
    activate_pele_minimum_steps_value = block.variables.get("activate_pele_minimum_steps", None)
    # pele_parameter_changes_value = block.variables.get("pele_parameter_changes", None)
    pele_perturbation_level_value = block.variables.get("pele_perturbation_level", None)
    pele_rotation_scaling_factor_value = block.variables.get("pele_rotation_scaling_factor", None)
    pele_translation_range_value = block.variables.get("pele_translation_range", None)
    pele_steering_update_frequency_value = block.variables.get(
        "pele_steering_update_frequency", None
    )
    pele_perturbation_trials_value = block.variables.get("pele_perturbation_trials", None)
    pele_perturbation_steric_trials_value = block.variables.get(
        "pele_perturbation_steric_trials", None
    )
    pele_perturbation_type_value = block.variables.get("pele_perturbation_type", None)
    pele_perturbation_translation_direction_value = block.variables.get(
        "pele_perturbation_translation_direction", None
    )
    pele_perturbation_rotation_angles_value = block.variables.get(
        "pele_perturbation_rotation_angles", None
    )
    pele_perturbation_overlap_factor_value = block.variables.get(
        "pele_perturbation_overlap_factor", None
    )
    pele_perturbation_box_type_value = block.variables.get("pele_perturbation_box_type", None)
    pele_perturbation_box_radius_value = block.variables.get("pele_perturbation_box_radius", None)
    pele_perturbation_COM_constraint_constant_value = block.variables.get(
        "pele_perturbation_COM_constraint_constant", None
    )
    disable_pele_anm_value = block.variables.get("disable_pele_anm", None)
    pele_anm_frequency_value = block.variables.get("pele_anm_frequency", None)
    pele_side_chain_prediction_frequency_value = block.variables.get(
        "pele_side_chain_prediction_frequency", None
    )
    pele_side_chain_prediction_region_radius_value = block.variables.get(
        "pele_side_chain_prediction_region_radius", None
    )
    pele_side_chain_prediction_resolution_value = block.variables.get(
        "pele_side_chain_prediction_resolution", None
    )
    disable_pele_minimization_value = block.variables.get("disable_pele_minimization", None)
    pele_minimization_frequency_value = block.variables.get("pele_minimization_frequency", None)
    pele_minimizer_algorithm_value = block.variables.get("pele_minimizer_algorithm", None)
    pele_minimizer_maximum_newton_iterations_value = block.variables.get(
        "pele_minimizer_maximum_newton_iterations", None
    )
    pele_minimizer_non_bonding_list_updated_each_min_step_value = block.variables.get(
        "pele_minimizer_non_bonding_list_updated_each_min_step", None
    )
    pele_perturbation_alpha_updated_value = block.variables.get(
        "pele_perturbation_alpha_updated", None
    )
    pele_task_metrics_value = block.variables.get("pele_task_metrics", None)
    pele_include_metal_constraints_value = block.variables.get(
        "pele_include_metal_constraints", None
    )
    pele_harmonic_constraints_value = block.variables.get("pele_harmonic_constraints", None)
    pele_harmonic_constraints_value = [
        f"{constraint['type']}:{constraint['value']}"
        for constraint in pele_harmonic_constraints_value
    ]
    pele_backbone_constaints_level_value = block.variables.get(
        "pele_backbone_constaints_level", None
    )
    pele_backbone_terminal_constaints_value = block.variables.get(
        "pele_backbone_terminal_constaints", None
    )
    pele_backbone_intermediate_constraints_value = block.variables.get(
        "pele_backbone_intermediate_constraints", None
    )
    pele_backbone_constaints_interval_value = block.variables.get(
        "pele_backbone_constaints_interval", None
    )

    inputContents = yamlContent(
        combine_pele_results_across_blocks_value,
        pele_representatives_criterion_value,
        only_prepare_input_value,
        max_conformations_to_take_value,
        pele_steps_value,
        pele_temperature_value,
        pele_trajectory_format_value,
        pele_activate_proximity_detection_value,
        activate_pele_minimum_steps_value,
        # pele_parameter_changes_value,
        pele_perturbation_level_value,
        pele_rotation_scaling_factor_value,
        pele_translation_range_value,
        pele_steering_update_frequency_value,
        pele_perturbation_trials_value,
        pele_perturbation_steric_trials_value,
        pele_perturbation_type_value,
        pele_perturbation_translation_direction_value,
        pele_perturbation_rotation_angles_value,
        pele_perturbation_overlap_factor_value,
        pele_perturbation_box_type_value,
        pele_perturbation_box_radius_value,
        pele_perturbation_COM_constraint_constant_value,
        disable_pele_anm_value,
        pele_anm_frequency_value,
        pele_side_chain_prediction_frequency_value,
        pele_side_chain_prediction_region_radius_value,
        pele_side_chain_prediction_resolution_value,
        disable_pele_minimization_value,
        pele_minimization_frequency_value,
        pele_minimizer_algorithm_value,
        pele_minimizer_maximum_newton_iterations_value,
        pele_minimizer_non_bonding_list_updated_each_min_step_value,
        pele_perturbation_alpha_updated_value,
        pele_task_metrics_value,
        pele_include_metal_constraints_value,
        pele_harmonic_constraints_value,
        pele_backbone_constaints_level_value,
        pele_backbone_terminal_constaints_value,
        pele_backbone_intermediate_constraints_value,
        pele_backbone_constaints_interval_value,
    )

    # Append to the input yaml file the pele simulation block
    with open(input_yaml_recieved, "a") as f:
        f.write(inputContents)

    print("Appended the PELE Simulation block.")

    block.setOutput("output_yaml", input_yaml_recieved)


PELESimulationBlock = PluginBlock(
    name="PELE Simulation",
    description="Runs a PELE simulation on the input complexes.",
    inputs=[input_yaml],
    variables=[
        combine_pele_results_across_blocks,
        pele_representatives_criterion,
        only_prepare_input,
        max_conformations_to_take,
        pele_steps,
        pele_temperature,
        pele_trajectory_format,
        pele_activate_proximity_detection,
        activate_pele_minimum_steps,
        # pele_parameter_changes,
        pele_perturbation_level,
        pele_rotation_scaling_factor,
        pele_translation_range,
        pele_steering_update_frequency,
        pele_perturbation_trials,
        pele_perturbation_steric_trials,
        pele_perturbation_type,
        pele_perturbation_translation_direction,
        pele_perturbation_rotation_angles,
        pele_perturbation_overlap_factor,
        pele_perturbation_box_type,
        pele_perturbation_box_radius,
        pele_perturbation_COM_constraint_constant,
        disable_pele_anm,
        pele_anm_frequency,
        pele_side_chain_prediction_frequency,
        pele_side_chain_prediction_region_radius,
        pele_side_chain_prediction_resolution,
        disable_pele_minimization,
        pele_minimization_frequency,
        pele_minimizer_algorithm,
        pele_minimizer_maximum_newton_iterations,
        pele_minimizer_non_bonding_list_updated_each_min_step,
        pele_perturbation_alpha_updated,
        pele_task_metrics,
        pele_include_metal_constraints,
        pele_harmonic_constraints,
        pele_backbone_constaints_level,
        pele_backbone_terminal_constaints,
        pele_backbone_intermediate_constraints,
        pele_backbone_constaints_interval,
    ],
    outputs=[output_yaml],
    action=generatePELESimulationInput,
)


def yamlContent(
    combine_pele_results_across_blocks_value,
    pele_representatives_criterion_value,
    only_prepare_input_value,
    max_conformations_to_take_value,
    pele_steps_value,
    pele_temperature_value,
    pele_trajectory_format_value,
    pele_activate_proximity_detection_value,
    activate_pele_minimum_steps_value,
    # pele_parameter_changes_value,
    pele_perturbation_level_value,
    pele_rotation_scaling_factor_value,
    pele_translation_range_value,
    pele_steering_update_frequency_value,
    pele_perturbation_trials_value,
    pele_perturbation_steric_trials_value,
    pele_perturbation_type_value,
    pele_perturbation_translation_direction_value,
    pele_perturbation_rotation_angles_value,
    pele_perturbation_overlap_factor_value,
    pele_perturbation_box_type_value,
    pele_perturbation_box_radius_value,
    pele_perturbation_COM_constraint_constant_value,
    disable_pele_anm_value,
    pele_anm_frequency_value,
    pele_side_chain_prediction_frequency_value,
    pele_side_chain_prediction_region_radius_value,
    pele_side_chain_prediction_resolution_value,
    disable_pele_minimization_value,
    pele_minimization_frequency_value,
    pele_minimizer_algorithm_value,
    pele_minimizer_maximum_newton_iterations_value,
    pele_minimizer_non_bonding_list_updated_each_min_step_value,
    pele_perturbation_alpha_updated_value,
    pele_task_metrics_value,
    pele_include_metal_constraints_value,
    pele_harmonic_constraints_value,
    pele_backbone_constaints_level_value,
    pele_backbone_terminal_constaints_value,
    pele_backbone_intermediate_constraints_value,
    pele_backbone_constaints_interval_value,
):
    return f"""
- block: pele_simulation
    options:
    combine_pele_results_across_blocks: {combine_pele_results_across_blocks_value}
    pele_representatives_criterion: {pele_representatives_criterion_value}
    only_prepare_input: {only_prepare_input_value}
    max_conformations_to_take: {max_conformations_to_take_value}
    pele_steps: {pele_steps_value}
    pele_temperature: {pele_temperature_value}
    pele_trajectory_format: {pele_trajectory_format_value}
    pele_activate_proximity_detection: {pele_activate_proximity_detection_value}
    activate_pele_minimum_steps: {activate_pele_minimum_steps_value}
    pele_perturbation_level: {pele_perturbation_level_value}
    pele_rotation_scaling_factor: {pele_rotation_scaling_factor_value}
    pele_translation_range: {pele_translation_range_value}
    pele_steering_update_frequency: {pele_steering_update_frequency_value}
    pele_perturbation_trials: {pele_perturbation_trials_value}
    pele_perturbation_steric_trials: {pele_perturbation_steric_trials_value}
    pele_perturbation_type: {pele_perturbation_type_value}
    pele_perturbation_translation_direction: {pele_perturbation_translation_direction_value}
    pele_perturbation_rotation_angles: {pele_perturbation_rotation_angles_value}
    pele_perturbation_overlap_factor: {pele_perturbation_overlap_factor_value}
    pele_perturbation_box_type: {pele_perturbation_box_type_value}
    pele_perturbation_box_radius: {pele_perturbation_box_radius_value}
    pele_perturbation_COM_constraint_constant: {pele_perturbation_COM_constraint_constant_value}
    disable_pele_anm: {disable_pele_anm_value}
    pele_anm_frequency: {pele_anm_frequency_value}
    pele_side_chain_prediction_frequency: {pele_side_chain_prediction_frequency_value}
    pele_side_chain_prediction_region_radius: {pele_side_chain_prediction_region_radius_value}
    pele_side_chain_prediction_resolution: {pele_side_chain_prediction_resolution_value}
    disable_pele_minimization: {disable_pele_minimization_value}
    pele_minimization_frequency: {pele_minimization_frequency_value}
    pele_minimizer_algorithm: {pele_minimizer_algorithm_value}
    pele_minimizer_maximum_newton_iterations: {pele_minimizer_maximum_newton_iterations_value}
    pele_minimizer_non_bonding_list_updated_each_min_step: {pele_minimizer_non_bonding_list_updated_each_min_step_value}
    pele_perturbation_alpha_updated: {pele_perturbation_alpha_updated_value}
    pele_task_metrics: {pele_task_metrics_value}
    pele_include_metal_constraints: {pele_include_metal_constraints_value}
    pele_harmonic_constraints: {pele_harmonic_constraints_value}
    pele_backbone_constaints_level: {pele_backbone_constaints_level_value}
    pele_backbone_terminal_constaints: {pele_backbone_terminal_constaints_value}
    pele_backbone_intermediate_constraints: {pele_backbone_intermediate_constraints_value}
    pele_backbone_constaints_interval: {pele_backbone_constaints_interval_value}"""
