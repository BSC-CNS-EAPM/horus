from HorusAPI import PluginVariable, SlurmBlock, VariableTypes
import os

# Variables

cpusVariable = PluginVariable(
    name="CPUs",
    id="cpus",
    description="Number of CPUs to use.",
    type=VariableTypes.INTEGER,
    defaultValue=1,
)

simulationName = PluginVariable(
    name="Simulation name",
    id="simulation_name",
    description="Name of the simulation.",
    type=VariableTypes.STRING,
    defaultValue="minimizer",
)

ediffVariable = PluginVariable(
    name="ediff",
    id="ediff",
    description="Energy difference.",
    type=VariableTypes.FLOAT,
    defaultValue=1e-6,
)

rmstolVariable = PluginVariable(
    name="rmstol",
    id="rmstol",
    description="RMS tolerance.",
    type=VariableTypes.FLOAT,
    defaultValue=1e-6,
)

maxitVariable = PluginVariable(
    name="maxit",
    id="maxit",
    description="Maximum number of iterations.",
    type=VariableTypes.INTEGER,
    defaultValue=1000,
)

# Inputs

structureInput = PluginVariable(
    name="Structure",
    id="structure",
    description="The PDB file to optimize.",
    type=VariableTypes.STRUCTURE,
)

folderInput = PluginVariable(
    name="PDB Folder",
    id="pdb_folder",
    description="The folder where to search for PDBs to optimize.",
    type=VariableTypes.FOLDER,
)

# Output

folderOutput = PluginVariable(
    name="Minimized PDBs folder",
    id="minimized-pdbs",
    description="The folder containing the minimized PDB(s).",
    type=VariableTypes.FOLDER,
)


# Minimize PDB block
def minimizePDBInitial(block: SlurmBlock):
    system_data = block.inputs.get("structure", None)

    if system_data is None:
        system_data = block.inputs.get("pdb_folder", None)

        if system_data is None or system_data == "":
            raise Exception("No PDBs provided.")

        system_data = system_data + "/*.pdb"

    cpus = block.variables.get("cpus", 1)
    name = block.variables.get("simulation_name", "minimizer")
    ediff = block.variables.get("ediff", 1e-6)
    rmstol = block.variables.get("rmstol", 1e-6)
    maxit = block.variables.get("maxit", 1000)

    print("Generating NBDSuite input files...")

    yaml_file_path = os.path.join(os.getcwd(), name + ".yaml")

    inputContents = inputYAML(system_data, name, cpus, ediff, rmstol, maxit)

    # Save the yaml file
    with open(yaml_file_path, "w") as f:
        f.write(inputContents)

    simRemoteDir = os.path.join(block.remote.horusDir, name)

    # Create the simulation folder in the remote
    block.remote.remoteCommand(f"mkdir -p -v {simRemoteDir}")

    print(f"Created simulation folder in the remote at {simRemoteDir}")
    print("Sending data to the remote...")

    system_data_remote = os.path.join(simRemoteDir, os.path.basename(system_data))

    # Send the complex data to the remote
    block.remote.sendData(
        system_data,
        system_data_remote,
    )

    # Send the input YAML to the remote
    block.remote.sendData(f"{name}.yaml", os.path.join(simRemoteDir, f"{name}.yaml"))

    # Save the SLURM script
    from Utils import slurmScript

    with open(f"{name}.slurm", "w") as f:
        f.write(slurmScript(name, cpus))

    scriptPath = os.path.join(simRemoteDir, f"{name}.slurm")

    # Send the SLURM script to the remote
    block.remote.sendData(f"{name}.slurm", scriptPath)

    print("Data sent to the remote.")
    print("Running the simulation...")

    # Run the simulation
    jobID = block.remote.submitJob(scriptPath)

    # # Get the job ID
    # jobID = out.split(" ")[-1].strip()

    print(f"Simulation running with job ID {jobID}")


def minimizePDBFinal(block: SlurmBlock):
    name = block.variables.get("simulation_name", "minimizer")

    block.setOutput("folder", name)


minimizePDBBlock = SlurmBlock(
    name="Minimize structure",
    description="Optimize a protein structure file using the NBDSuite.",
    initialAction=minimizePDBInitial,
    finalAction=minimizePDBFinal,
    variables=[cpusVariable, simulationName],
    inputs=[structureInput, folderInput],
    outputs=[folderOutput],
)


def inputYAML(system_data, name, cpus, ediff, rmstol, maxit):
    return f"""
system_data: {system_data}
working_directory: .
name: {name}
static_name: true
cpus: {cpus}
verbosity: info
restart: false
pipeline:
    - block: topology_extractor
    - block: pele_pdb_preprocessor
      options:
          set_unique_pdb_atom_names: True
          aggressive_replacement: True
    - block: pele_parameterizer
    - block: pele_energy_minimizer
      options:
          pele_minimizer_ediff: {ediff}
          pele_minimizer_rmstol: {rmstol}
          pele_minimizer_maxit: {maxit}
"""
