"""
Topology merger block 

https://nbdsoftware.github.io/NBDSuite/user_guide/blocks/structure_processing/topology_merger.html
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
first_topology_to_merge = PluginVariable(
    name="First topology to merge",
    id="first_topology_to_merge",
    description="The first topology to be merged.",
    type=VariableTypes.STRING,
)

second_topology_to_merge = PluginVariable(
    name="Second topology to merge",
    id="second_topology_to_merge",
    description="The second topology to be merged.",
    type=VariableTypes.STRING,
)

ligand_topology_chain = PluginVariable(
    name="Ligand topology chain",
    id="ligand_topology_chain",
    description=" The chain to assign to the Ligand topology.",
    type=VariableTypes.STRING,
    defaultValue="L",
)

ligand_topology_seqnum = PluginVariable(
    name="Ligand topology seqnum",
    id="ligand_topology_seqnum",
    description="The sequence number to assign to the Ligand topology.",
    type=VariableTypes.INTEGER,
    defaultValue=1,
)

only_enabled_topologies = PluginVariable(
    name="Only enabled topologies",
    id="only_enabled_topologies",
    description="Whether to consider all topology elements in the selection or only those that are enabled.",
    type=VariableTypes.BOOLEAN,
    defaultValue=False,
)

ligand_topology_resname = PluginVariable(
    name="Ligand topology resname",
    id="ligand_topology_resname",
    description="The residue name to assign to the Ligand topology.",
    type=VariableTypes.STRING,
    defaultValue="LIG",
)

# Outputs
output_yaml = PluginVariable(
    name="Input file",
    id="output_yaml",
    description="The input file for the NBD Suite.",
    type=VariableTypes.FILE,
    allowedValues=["nbdinput"],
)


def generateTopologyMerger(block: PluginBlock):
    first_topology_to_merge = block.variables.get("first_topology_to_merge", None)
    second_topology_to_merge = block.variables.get("second_topology_to_merge", None)
    ligand_topology_chain = block.variables.get("ligand_topology_chain", None)
    ligand_topology_seqnum = block.variables.get("ligand_topology_seqnum", None)
    only_enabled_topologies = block.variables.get("only_enabled_topologies", None)
    ligand_topology_resname = block.variables.get("ligand_topology_resname", None)

    inputContents = yamlContent(
        first_topology_to_merge,
        second_topology_to_merge,
        ligand_topology_chain,
        ligand_topology_seqnum,
        only_enabled_topologies,
        ligand_topology_resname,
    )

    input_yaml_recived = block.inputs.get("input_yaml", None)

    if input_yaml_recived is None:
        raise Exception("No input yaml file provided. Have you run the general block?")

    # Append to the input yaml file the topology extractor block
    with open(input_yaml_recived, "a") as f:
        f.write(inputContents)

    print("Appended the topology merger block.")

    block.setOutput("output_yaml", input_yaml_recived)


topologyMergerBlock = PluginBlock(
    name="Topology Merger",
    description="Merges two topologies (a System with Ligand) to produce a Complex.",
    action=generateTopologyMerger,
    variables=[
        first_topology_to_merge,
        second_topology_to_merge,
        ligand_topology_chain,
        ligand_topology_seqnum,
        only_enabled_topologies,
        ligand_topology_resname,
    ],
    inputs=[input_yaml],
    outputs=[output_yaml],
)


def yamlContent(
    first_topology_to_merge,
    second_topology_to_merge,
    ligand_topology_chain,
    ligand_topology_seqnum,
    only_enabled_topologies,
    ligand_topology_resname,
):
    return f"""
- block: topology_merger
  options:
    first_topology_to_merge: {first_topology_to_merge}
    second_topology_to_merge: {second_topology_to_merge}
    ligand_topology_chain: {ligand_topology_chain}
    ligand_topology_seqnum: {ligand_topology_seqnum}
    only_enabled_topologies: {only_enabled_topologies}
    ligand_topology_resname: {ligand_topology_resname}
"""
