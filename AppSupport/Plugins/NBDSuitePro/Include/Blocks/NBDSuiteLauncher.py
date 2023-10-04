"""
Launcher for the NBDSuitePro plugin. (generate the slurm script and send it to the remote)
"""

import os
import yaml
from HorusAPI import PluginVariable, SlurmBlock, VariableTypes
from ProUtils import SlurmProScript

# Input
input_yaml = PluginVariable(
    name="Input file",
    id="input_yaml",
    description="The input file for the NBD Suite.",
    type=VariableTypes.FILE,
    allowedValues=["nbdinput"],
)

# Variables
download_results = PluginVariable(
    name="Download results",
    id="download_results",
    description="Download the results from the remote (if connected).",
    type=VariableTypes.BOOLEAN,
    defaultValue=False,
)

slurm_mem = PluginVariable(
    name="Memory per CPU",
    id="slurm_mem",
    description="Memory to be requested to Slurm (in MB).",
    type=VariableTypes.INTEGER,
    defaultValue=1000,
)

slurm_time = PluginVariable(
    name="Slurm time",
    id="slurm_time",
    description="Time to be requested to Slurm.",
    type=VariableTypes.STRING,
    defaultValue="02:00:00",
)

slurm_partition = PluginVariable(
    name="Slurm partition",
    id="slurm_partition",
    description="Partition to be requested to Slurm.",
    type=VariableTypes.STRING,
    defaultValue="defq",
)

slurm_queue = PluginVariable(
    name="Slurm queue",
    id="slurm_queue",
    description="Queue to be requested to Slurm.",
    type=VariableTypes.STRING,
    defaultValue="normal",
)

slurm_nodes = PluginVariable(
    name="Slurm nodes",
    id="slurm_nodes",
    description="Nodes to be requested to Slurm.",
    type=VariableTypes.INTEGER,
    defaultValue=1,
)

modules = PluginVariable(
    name="Modules",
    id="modules",
    description="Modules to be loaded.",
    type=VariableTypes.LIST,
)

suite_env_path = PluginVariable(
    name="Suite environment path",
    id="suite_env_path",
    description="Path to the conda environment where the NBDSuite is installed.",
    type=VariableTypes.STRING,
    defaultValue="/shared/work/NBDSuite/envs/nbdsuite-0.0.1rc1",
)


def generateLauncher(block: SlurmBlock):  # pylint: disable=missing-function-docstring
    input_yaml_recived = block.inputs.get("input_yaml", None)

    yamlPath = os.path.join(os.getcwd(), input_yaml_recived)

    # Read from the yaml the name and the CPU
    with open(yamlPath, "r") as stream:
        try:
            yamlContent = yaml.safe_load(stream)
        except yaml.YAMLError as exc:
            raise Exception(exc) from exc

    # Get the name of the pipeline
    name = yamlContent["name"]

    # Get the number of CPUs
    cpus = yamlContent["cpus"]

    # Get the rest of slurm variables
    slurm_mem = block.variables.get("slurm_mem", None)
    slurm_time = block.variables.get("slurm_time", None)
    slurm_partition = block.variables.get("slurm_partition", None)
    slurm_queue = block.variables.get("slurm_queue", None)
    slurm_nodes = block.variables.get("slurm_nodes", None)
    modules = block.variables.get("modules", None)
    suite_env_path = block.variables.get("suite_env_path", None)

    # Generate the slurm script
    slurmScript = SlurmProScript()
    slurmScript.name = name
    slurmScript.cpus = cpus
    slurmScript.mem = slurm_mem
    slurmScript.qos = slurm_queue
    slurmScript.partition = slurm_partition
    slurmScript.nodes = slurm_nodes
    slurmScript.time = slurm_time
    slurmScript.modules = modules
    slurmScript.suiteEnvPath = suite_env_path

    # Write the slurm script
    slurmFilePath = f"{name}.slurm"
    with open(slurmFilePath, "w", encoding="utf-8") as f:
        f.write(slurmScript.getScript())

    # Send the required data to the cluster
    system_data = yamlContent.get("system_data", None)
    ligand_data = yamlContent.get("ligand_data", None)
    complex_data = yamlContent.get("complex_data", None)
    sequence_data = yamlContent.get("sequence_data", None)

    required_data = [
        system_data,
        ligand_data,
        complex_data,
        sequence_data,
        yamlPath,
        slurmFilePath,
    ]
    required_data = [data for data in required_data if data is not None]

    destination_dir = os.path.join(block.remote.workDir, name)

    block.remote.remoteCommand(f"mkdir -p {destination_dir}")

    final_path_should_be_slurm = None
    for data in required_data:
        if os.path.exists(data):
            print(f"Sending {data} to remote")
            destination_path = os.path.join(destination_dir, os.path.basename(data))
            block.remote.sendData(data, destination_path)
            final_path_should_be_slurm = destination_path

    print("Submitting job...")

    if final_path_should_be_slurm is None:
        raise Exception("No slurm file provided.")

    jobID = block.remote.submitJob(final_path_should_be_slurm)

    print(f"Job is running with job ID: {jobID}")


def generateLauncherFinalAction(block: SlurmBlock):
    download_results = block.variables.get("download_results", None)

    if download_results:
        print("Downloading results...")

        # Get from the input the simulation name
        input_yaml_recived = block.inputs.get("input_yaml", None)

        # Read from the yaml the name
        with open(input_yaml_recived, "r") as stream:
            try:
                yamlContent = yaml.safe_load(stream)
            except yaml.YAMLError as exc:
                raise Exception(exc) from exc

        name = yamlContent["name"]

        results_path = os.path.join(block.remote.workDir, name, name)
        dest_path = os.path.join(os.getcwd(), name)

        block.remote.getData(results_path, dest_path)
        print("Results downloaded to the flow directory.")
    else:
        print("Finished. Results are on remote.")


launcherBlock = SlurmBlock(
    name="NBDSuite Launcher",
    description="Launch an NBDSuite input pipeline on the remote.",
    initialAction=generateLauncher,
    finalAction=generateLauncherFinalAction,
    inputs=[input_yaml],
    variables=[
        download_results,
        slurm_mem,
        slurm_time,
        slurm_partition,
        slurm_queue,
        slurm_nodes,
        modules,
        suite_env_path,
    ],
)
