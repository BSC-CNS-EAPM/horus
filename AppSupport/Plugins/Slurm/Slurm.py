from HorusAPI import (
    Plugin,
    PluginBlock,
    PluginVariable,
    VariableTypes,
)

plugin = Plugin(id="Slurm")

plugin.info = {
    "name": "Slurm",
    "description": "The Slurm plugin for Horus",
    "author": "Nostrum Biodiscovery",
    "version": "0.0.1",
}

jobname = PluginVariable(
    id="job_name",
    name="Job name",
    description="The name of the job.",
    type=VariableTypes.STRING,
    defaultValue="slurm",
)

output = PluginVariable(
    id="output",
    name="Output",
    description="The output file name.",
    type=VariableTypes.STRING,
    defaultValue="slurm_%j.out",
)

error = PluginVariable(
    id="error",
    name="Error",
    description="The error file name.",
    type=VariableTypes.STRING,
    defaultValue="slurm_%j.err",
)

tasks = PluginVariable(
    id="tasks",
    name="Tasks",
    description="The number of tasks.",
    type=VariableTypes.INTEGER,
    defaultValue=1,
)

nodes = PluginVariable(
    id="nodes",
    name="Nodes",
    description="The number of nodes.",
    type=VariableTypes.INTEGER,
    defaultValue=1,
)

mem_per_cpu = PluginVariable(
    id="mem_per_cpu",
    name="Memory per CPU",
    description="The memory per CPU.",
    type=VariableTypes.INTEGER,
    defaultValue=1000,
)

time = PluginVariable(
    id="time",
    name="Time",
    description="The time.",
    type=VariableTypes.STRING,
    defaultValue="00:10:00",
)

script = PluginVariable(
    id="script",
    name="Script",
    description="The script to run.",
    type=VariableTypes.STRING,
    defaultValue="echo 'Hello world!'",
)


def createSlurmScript(block: PluginBlock):
    script_name = block.variables["job_name"] + ".sh"
    with open(script_name, "w") as f:
        f.write("#!/bin/bash\n")
        f.write("#SBATCH --job-name=" + block.variables["job_name"] + "\n")
        f.write("#SBATCH --output=" + block.variables["output"] + "\n")
        f.write("#SBATCH --error=" + block.variables["error"] + "\n")
        f.write("#SBATCH --ntasks=" + str(block.variables["tasks"]) + "\n")
        f.write("#SBATCH --nodes=" + str(block.variables["nodes"]) + "\n")
        f.write("#SBATCH --mem-per-cpu=" + str(block.variables["mem_per_cpu"]) + "\n")
        f.write("#SBATCH --time=" + block.variables["time"] + "\n")
        f.write("\n")
        f.write(block.variables["script"] + "\n")


slurmblock = PluginBlock(
    name="Slurm script",
    description="Generate a Slurm script.",
    variables=[
        jobname,
        output,
        error,
        tasks,
        nodes,
        mem_per_cpu,
        time,
        script,
    ],
    action=createSlurmScript,
)

plugin.addBlock(slurmblock)
