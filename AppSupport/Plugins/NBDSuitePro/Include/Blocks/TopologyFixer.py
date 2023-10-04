from HorusAPI import PluginVariable, PluginBlock, VariableTypes

# Input
input_yaml = PluginVariable(
    name="Input file",
    id="input_yaml",
    description="The input file for the NBD Suite.",
    type=VariableTypes.FILE,
    allowedValues=["nbdinput"],
)

het_residues_to_drop_input = PluginVariable(
    name="Drop het.",
    id="het_residues_to_drop",
    description="The heteroatoms to drop.",
    type=VariableTypes.HETERORES,
)

chains_to_drop_input = PluginVariable(
    name="Drop chains",
    id="std_residues_to_drop",
    description="The standard residues to drop.",
    type=VariableTypes.CHAIN,
)

# Variables
drop_water_variable = PluginVariable(
    name="Drop water",
    id="drop_water",
    description="When set to True, water molecules will be removed from topologies.",
    type=VariableTypes.BOOLEAN,
    defaultValue=True,
)

repair_heavy_atoms_variable = PluginVariable(
    name="Repair heavy atoms",
    id="repair_heavy_atoms",
    description="When set to True, an attempt to solve problems on \
    heavy atoms will be performed.",
    type=VariableTypes.BOOLEAN,
    defaultValue=True,
)

protonation_ph_variable = PluginVariable(
    name="Protonation pH",
    id="protonation_ph",
    description="pH to consider when protonating topologies.",
    type=VariableTypes.FLOAT,
    defaultValue=7.0,
)

fix_systems_variable = PluginVariable(
    name="Fix systems",
    id="fix_systems",
    description="Whether to fix systems.",
    type=VariableTypes.BOOLEAN,
    defaultValue=True,
)

fix_ligands_variable = PluginVariable(
    name="Fix ligands",
    id="fix_ligands",
    description="Whether to fix ligands.",
    type=VariableTypes.BOOLEAN,
    defaultValue=True,
)


# Outputs
output_yaml = PluginVariable(
    name="Input file",
    id="output_yaml",
    description="The input file for the NBD Suite.",
    type=VariableTypes.FILE,
    allowedValues=["nbdinput"],
)


def generateTopologyFixerBlock(block: PluginBlock):
    drop_water = block.variables.get("drop_water", None)
    repair_heavy_atoms = block.variables.get("repair_heavy_atoms", None)
    protonation_ph = block.variables.get("protonation_ph", None)
    fix_systems = block.variables.get("fix_systems", None)
    fix_ligands = block.variables.get("fix_ligands", None)

    missing_variables = [
        var_name
        for var_name, var_value in locals().items()
        if var_value is None
        and var_name
        in [
            "drop_water",
            "repair_heavy_atoms",
            "protonation_ph",
            "fix_systems",
            "fix_ligands",
        ]
    ]
    if missing_variables:
        raise Exception(
            f"Missing variables in the Topology Fixer block: \
            {', '.join(missing_variables)}"
        )

    input_yaml_recived = block.inputs.get("input_yaml", None)

    if input_yaml_recived is None:
        raise Exception("No input file provided.")

    het_res_to_drop = block.inputs.get("het_residues_to_drop", None)

    # Extract the "auth_comp_id" value from the
    # "het_res_to_drop" input and store it in a list
    if het_res_to_drop is not None:
        het_res_to_drop = [residue["auth_comp_id"] for residue in het_res_to_drop]
    else:
        het_res_to_drop = []

    chain_res_to_drop = block.inputs.get("std_residues_to_drop", None)

    if chain_res_to_drop is not None:
        chain_res_to_drop = [residue["chainID"] for residue in chain_res_to_drop]
    else:
        chain_res_to_drop = []

    inputContents = yamlContent(
        drop_water,
        repair_heavy_atoms,
        protonation_ph,
        het_res_to_drop,
        chain_res_to_drop,
        fix_systems,
        fix_ligands,
    )

    # Append to the input yaml file the topology extractor block
    with open(input_yaml_recived, "a") as f:
        f.write(inputContents)

    print("Appended the topology fixer block.")

    block.setOutput("output_yaml", input_yaml_recived)


topologyFixerBlock = PluginBlock(
    name="Topology Fixer",
    description="Prepares protein structures, fixing heavy atoms and taking \
    care of protonation states.",
    action=generateTopologyFixerBlock,
    variables=[
        drop_water_variable,
        repair_heavy_atoms_variable,
        protonation_ph_variable,
        fix_systems_variable,
        fix_ligands_variable,
    ],
    inputs=[input_yaml, het_residues_to_drop_input, chains_to_drop_input],
    outputs=[output_yaml],
)


def yamlContent(
    drop_water,
    repair_heavy_atoms,
    protonation_ph,
    het_residues_to_drop,
    chain_ids_to_drop,
    fix_systems,
    fix_ligands,
):
    return f"""
- block: topology_fixer
  options:
    drop_water: {drop_water}
    repair_heavy_atoms: {repair_heavy_atoms}
    protonation_ph: {protonation_ph}
    het_residues_to_drop: {het_residues_to_drop}
    chain_ids_to_drop: {chain_ids_to_drop}
    fix_systems: {fix_systems}
    fix_ligands: {fix_ligands}"""
