import os
from flask import request

from HorusAPI import (
    Plugin,
    PluginBlock,
    PluginVariable,
    VariableTypes,
    PluginPage,
    PluginEndpoint,
)

# Import the NBDSuite parser from the Include folder
import importlib.machinery
import types
import time

loader = importlib.machinery.SourceFileLoader(
    "NBDSuiteParser",
    os.path.join(os.path.dirname(__file__), "Include/NBDSuiteParser.py"),
)

mod = types.ModuleType(loader.name)
loader.exec_module(mod)

NBDSuiteParser = mod.NBDSuiteParser


def createPlugin():
    plugin = Plugin(id="NBDSuite")

    plugin.info = {
        "name": "NBDSuite",
        "description": "The NBDSuite plugin for Horus",
        "author": "Nostrum Biodiscovery",
        "version": "0.0.1",
        "dependencies": [
            # "nbdsuite"
            # It is not distributed by pip,
            # thus it will be installed manually in the deps folder
            "pandas",
            "biopython",
            "pydantic==1.10.11",
            "rdkit",
            "openmm",
            "scipy",
            "pyyaml",
        ],
    }

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

    # Minimize PDB block
    def minimizePDB(block: PluginBlock):
        system_data = block.inputs.get("file", None)

        if system_data is None:
            system_data = block.inputs.get("folder", None)

            if system_data is None or system_data == "":
                raise Exception("No system data provided.")

            system_data = system_data + "/*.pdb"

        cpus = block.variables.get("cpus", 1)
        name = block.variables.get("simulation_name", "minimizer")

        print("Importing NBDsuite...")

        from nbdsuite.design import Launcher
        from nbdsuite.parameters.blocks.common import GeneralBuilder  # type: ignore

        print("Generating NBDSuite input files...")

        flow = []

        generalBuilder = GeneralBuilder()

        generalBuilder.system_data = system_data
        generalBuilder.cpus = cpus
        generalBuilder.name = name
        flow.append(generalBuilder)

        from nbdsuite.parameters.blocks.common import (
            TopologyExtractorBuilder,
        )  # noqa: E501

        flow.append(TopologyExtractorBuilder())

        from nbdsuite.parameters.blocks.pele import PDBPreprocessorBuilder  # noqa: E501

        pdbPreprocessor = PDBPreprocessorBuilder()
        pdbPreprocessor.set_unique_pdb_atom_names = True
        pdbPreprocessor.aggressive_replacement = True

        flow.append(pdbPreprocessor)

        from nbdsuite.parameters.blocks.pele import ParameterizerBuilder  # noqa: E501

        flow.append(ParameterizerBuilder())

        from nbdsuite.parameters.blocks.pele import EnergyMinimizerBuilder  # noqa: E501

        minimizer = EnergyMinimizerBuilder()
        minimizer.pele_minimizer_ediff = 1
        minimizer.pele_minimizer_rmstol = 1
        minimizer.pele_minimizer_maxit = 1

        flow.append(minimizer)

        print("Running launcher")

        launcher = Launcher(flow)

        print("Saving yaml file...")

        yaml_file_path = os.path.join(os.getcwd(), name + ".yaml")

        launcher.to_yaml(yaml_file_path)

        # Remove from the yaml file the "!!python/tuple" tag
        # Just replace it as a string by placing ""
        with open(yaml_file_path, "r") as f:
            yaml_file = f.read()
        yaml_file = yaml_file.replace("!!python/tuple", "")

        # Save the yaml file
        with open(yaml_file_path, "w") as f:
            f.write(yaml_file)

        print(f"Minimizing PDBs from {system_data}...")

        block.setOutput("folder", yaml_file_path)

        print("Output of block: ", block.outputs)

    fileInput = PluginVariable(
        name="File",
        id="file",
        description="The PDB file to optimize.",
        type=VariableTypes.FILE,
    )

    folderInput = PluginVariable(
        name="Folder",
        id="folder",
        description="The folder where to search for PDBs to optimize.",
        type=VariableTypes.FOLDER,
    )

    folderOutput = PluginVariable(
        name="Folder",
        id="folder",
        description="The folder containing the minimized PDBs.",
        type=VariableTypes.FOLDER,
    )

    minimizePDBBlock = PluginBlock(
        name="Optimize structure",
        description="Optimize a protein structure file using the NBDSuite.",
        action=minimizePDB,
        variables=[cpusVariable, simulationName],
        inputs=[fileInput, folderInput],
        outputs=[folderOutput],
    )

    plugin.addBlock(minimizePDBBlock)

    complexDataInput = PluginVariable(
        name="Complex data",
        id="file",
        description="The PDB file path with the ligand docked.",
        type=VariableTypes.FILE,
    )

    complexLigandSelection = PluginVariable(
        name="Ligand selection",
        id="ligand_selection",
        description="The ligand selection string.",
        type=VariableTypes.STRING,
        defaultValue="L:1",
    )

    cpusProtPrep = PluginVariable(
        name="CPUs",
        id="cpus",
        description="Number of CPUs to use.",
        type=VariableTypes.INTEGER,
        defaultValue=1,
    )

    nameProtPrep = PluginVariable(
        name="Simulation name",
        id="simulation_name",
        description="Name of the simulation.",
        type=VariableTypes.STRING,
        defaultValue="prot_prep",
    )

    flexibleRegionRadius = PluginVariable(
        name="Flexible region radius",
        id="flexible_region_radius",
        description="Radius of the flexible region.",
        type=VariableTypes.FLOAT,
        defaultValue=10.0,
    )

    frozenRegionRadius = PluginVariable(
        name="Frozen region radius",
        id="frozen_region_radius",
        description="Radius of the frozen region.",
        type=VariableTypes.FLOAT,
        defaultValue=15.0,
    )

    outputPreparedir = PluginVariable(
        name="Prepared complex",
        id="file",
        description="The PDB containing the prepared complex.",
        type=VariableTypes.FILE,
    )

    # Prot prep and ligand prep block
    def protLigPrep(block: PluginBlock):
        complex_data = block.inputs.get("file", None)

        if complex_data is None:
            raise Exception("No complex data provided.")

        # complex_ligand_selection = block.variables.get("ligand_selection", None)
        # cpus = block.variables.get("cpus", 1)
        # name = block.variables.get("simulation_name", "prot_prep")
        # flexible_region_radius = block.variables.get("flexible_region_radius", 10.0)
        # frozen_region_radius = block.variables.get("frozen_region_radius", 15.0)

        print("Importing NBDsuite...")

        print("Sending simulation...")

        block.setOutput("file", "complex_data.pdb")

    # Define the block
    protLigPrepBlock = PluginBlock(
        name="Prot-Lig prep",
        description="Prepare a protein-ligand complex for PELE simulation.",
        action=protLigPrep,
        variables=[
            complexLigandSelection,
            cpusProtPrep,
            nameProtPrep,
            flexibleRegionRadius,
            frozenRegionRadius,
        ],
        inputs=[complexDataInput],
        outputs=[outputPreparedir],
    )

    # Add the block to the plugin
    plugin.addBlock(protLigPrepBlock)

    ifrComplexdataInput = PluginVariable(
        name="Complex data",
        id="file",
        description="The PDB file path with the ligand docked.",
        type=VariableTypes.FILE,
    )

    complex_ligand_selection = PluginVariable(
        name="Ligand selection",
        id="ligand_selection",
        description="The ligand selection string.",
        type=VariableTypes.STRING,
        defaultValue="L:1",
    )

    cpusIFR = PluginVariable(
        name="CPUs",
        id="cpus",
        description="Number of CPUs to use.",
        type=VariableTypes.INTEGER,
        defaultValue=4,
    )

    nameIFR = PluginVariable(
        name="Simulation name",
        id="simulation_name",
        description="Name of the simulation.",
        type=VariableTypes.STRING,
        defaultValue="ifr",
    )

    flexibleRegionRadiusIFR = PluginVariable(
        name="Flexible region radius",
        id="flexible_region_radius",
        description="Radius of the flexible region.",
        type=VariableTypes.FLOAT,
        defaultValue=10.0,
    )

    frozenRegionRadiusIFR = PluginVariable(
        name="Frozen region radius",
        id="frozen_region_radius",
        description="Radius of the frozen region.",
        type=VariableTypes.FLOAT,
        defaultValue=15.0,
    )

    peleFFIRF = PluginVariable(
        name="PELE force field",
        id="pele_force_field",
        description="PELE force field.",
        type=VariableTypes.STRING_LIST,
        defaultValue="openff-2.0.0",
        allowedValues=["openff-2.0.0", "openff-1.3.0"],
    )

    peleStepsIFR = PluginVariable(
        name="PELE steps",
        id="pele_steps",
        description="PELE steps.",
        type=VariableTypes.INTEGER,
        defaultValue=5,
    )

    epochsIFR = PluginVariable(
        name="Epochs",
        id="epochs",
        description="PELE epochs.",
        type=VariableTypes.INTEGER,
        defaultValue=1,
    )

    outputIFR = PluginVariable(
        name="Simulation results",
        id="path",
        description="The folder containing the results.",
        type=VariableTypes.FOLDER,
    )

    # Induced fit refinement block
    def inducedFitRefinement(block: PluginBlock):
        complex_data = block.inputs.get("file", None)

        if complex_data is None:
            raise Exception("No complex data provided.")

        complex_data_filename = os.path.basename(complex_data)
        complex_ligand_selection = block.variables.get("ligand_selection", None)
        cpus = block.variables.get("cpus", 1)

        cpus = int(cpus)

        if cpus < 2:
            raise Exception("CPUs must be greater than 1.")

        name = block.variables.get("simulation_name", "ifr")
        flexible_region_radius = block.variables.get("flexible_region_radius", 10.0)
        frozen_region_radius = block.variables.get("frozen_region_radius", 15.0)
        pele_force_field = block.variables.get("pele_force_field", "OPLS2005")
        pele_steps = block.variables.get("pele_steps", 5)
        epochs = block.variables.get("epochs", 1)

        if isinstance(pele_force_field, list):
            pele_force_field = pele_force_field[0]

        inputYAML = f"""
complex_data: {complex_data_filename}
complex_ligand_selection: {complex_ligand_selection}
working_directory: .
name: {name}
static_name: false
cpus: {cpus}
verbosity: info
seed: 22371
restart: false
pele_solvent: OBC
pipeline:
- block: topology_extractor
  options:
    check_topology: true
    explicit_h_in_smiles: false
    remove_implicit_hydrogen: false
    fix_structures: true
    assemble_conformations: true
- block: topology_fixer
  options:
    drop_water: true
    repair_heavy_atoms: true
    protonation_ph: 7.0
    het_residues_to_drop: []
    fix_systems: true
    fix_ligands: true
- flow: induced_fit_refinement
  options:
    pele_forcefield: {pele_force_field}
    pele_steps: {pele_steps}
    adaptive_epochs: {epochs}
    flexible_region_radius: {flexible_region_radius}
    frozen_region_radius: {frozen_region_radius}
"""
        # Save the input YAML
        with open(f"{name}.yaml", "w") as f:
            f.write(inputYAML)

        simRemoteDir = os.path.join(block.remote.horusDir, name)

        # Create the simulation folder in the remote
        block.remote.remoteCommand(f"mkdir -p {simRemoteDir}")

        print(f"Created simulation folder in the remote at {simRemoteDir}")
        print("Sending data to the remote...")
        # Send the complex data to the remote
        block.remote.sendData(
            complex_data, os.path.join(simRemoteDir, complex_data_filename)
        )

        # Send the input YAML to the remote
        block.remote.sendData(
            f"{name}.yaml", os.path.join(simRemoteDir, f"{name}.yaml")
        )

        slurmScript = f"""#!/bin/bash
#SBATCH -J {name}-horus
#SBATCH --output={name}-horus%j.out
#SBATCH --error={name}-horus%j.err
#SBATCH --ntasks={cpus}
#SBATCH --mem-per-cpu=1000
#SBATCH --nodes=1
#SBATCH --time=01:00:00

## PELE
ml PELE
ml Schrodinger


## NBD Suite
source activate /shared/work/NBDSuite/envs/nbdsuite-0.0.1rc1

time python -m nbdsuite.main {name}.yaml

"""
        # Save the SLURM script
        with open(f"{name}.slurm", "w") as f:
            f.write(slurmScript)

        # Send the SLURM script to the remote
        block.remote.sendData(
            f"{name}.slurm", os.path.join(simRemoteDir, f"{name}.slurm")
        )

        print("Data sent to the remote.")
        print("Running the simulation...")

        # Run the simulation
        out = block.remote.remoteCommand(f"cd {simRemoteDir} && sbatch {name}.slurm")

        # Get the job ID
        jobID = out.split(" ")[-1].strip()

        print(f"Simulation running with job ID {jobID}")

        # Wait for the job to finish
        print("Waiting for the simulation to finish...")
        while True:
            out = block.remote.remoteCommand(f"squeue -j {jobID}")
            if jobID not in out:
                break
            time.sleep(10)

        # Check if the slurm job was successful with sacct
        out = block.remote.remoteCommand(f"sacct -j {jobID} -o state --noheader")

        if "COMPLETED" not in out:
            # Read the slurm .err file
            out = block.remote.remoteCommand(
                f"cat {simRemoteDir}/{name}-horus{jobID}.err"
            )
            print(out)
            raise Exception("PELE simulation failed.")

        print("Simulation finished successfully.")

        # Get the results
        block.setOutput("path", simRemoteDir)

    # Define the block
    inducedFitRefinementBlock = PluginBlock(
        name="Induced fit refinement",
        description="Perform an induced fit refinement simulation",
        action=inducedFitRefinement,
        variables=[
            complex_ligand_selection,
            cpusIFR,
            nameIFR,
            flexibleRegionRadiusIFR,
            frozenRegionRadiusIFR,
            peleFFIRF,
            peleStepsIFR,
            epochsIFR,
        ],
        inputs=[ifrComplexdataInput],
        outputs=[outputIFR],
    )

    # Add the block to the plugin
    plugin.addBlock(inducedFitRefinementBlock)

    # ========== PAGES ========== #

    # Define the PELE results page
    nbdsuitepage = PluginPage(
        name="PELE Results",
        description="Analyse NBDSuite PELE results.",
        html="nbdsuite.html",
    )

    def loadComplexes():
        path = request.json

        if path is None:
            return {"ok": False, "msg": "No path provided."}

        path = path.get("path", None)

        if isinstance(path, list):
            path = path[0]

        if path is None:
            return {"ok": False, "msg": "No path provided."}

        try:
            parser = NBDSuiteParser(path)

            complexes = parser.listComplexes()
        except Exception as e:
            return {"ok": False, "msg": str(e)}

        return {"ok": True, "complexes": complexes}

    # Add an endpoint for loading the complex dropdown
    loadComplexesEndpoint = PluginEndpoint(
        url="/loadComplexes",
        methods=["POST"],
        function=loadComplexes,
    )

    # Add the endpoint to the page
    nbdsuitepage.addEndpoint(loadComplexesEndpoint)

    def loadTopSelections():
        data = request.json

        if data is None:
            return {"ok": False, "msg": "No data provided."}

        path = data.get("path", None)
        complex = data.get("complex", None)

        if isinstance(path, list):
            path = path[0]

        if isinstance(complex, list):
            complex = complex[0]

        if path is None or complex is None:
            return {"ok": False, "msg": "No complex or path provided."}

        try:
            parser = NBDSuiteParser(path)

            selections = parser.listTopSelections(complex)
        except Exception as e:
            return {"ok": False, "msg": str(e)}

        return {"ok": True, "selections": selections}

    # Add an endpoint for loading the top selections dropdown
    loadTopSelectionsEndpoint = PluginEndpoint(
        url="/loadTopSelections",
        methods=["POST"],
        function=loadTopSelections,
    )

    # Add the endpoint to the page
    nbdsuitepage.addEndpoint(loadTopSelectionsEndpoint)

    def loadPlotData():
        data = request.json

        if data is None:
            return {"ok": False, "msg": "No data provided."}

        path = data.get("path", None)
        complex = data.get("complex", None)

        if isinstance(path, list):
            path = path[0]

        if isinstance(complex, list):
            complex = complex[0]

        if path is None or complex is None:
            return {"ok": False, "msg": "No data provided."}

        try:
            parser = NBDSuiteParser(path)
            data = parser.getPlotData(complex)
        except Exception as e:
            return {"ok": False, "msg": str(e)}

        return {"ok": True, "plotdata": data}

    # Add an endpoint for loading the plot data
    plotData = PluginEndpoint(
        url="/getPlotData",
        methods=["POST", "GET"],
        function=loadPlotData,
    )

    # Add the endpoint to the page
    nbdsuitepage.addEndpoint(plotData)

    def loadInputPDB():
        data = request.json

        if data is None:
            return {"ok": False, "msg": "No data provided."}

        path = data.get("path", None)

        if isinstance(path, list):
            path = path[0]

        if path is None:
            return {"ok": False, "msg": "No data provided."}

        try:
            parser = NBDSuiteParser(path)
            data = parser.getInputPDB()
            return {"ok": True, "data": data}
        except Exception as e:
            return {"ok": False, "msg": str(e)}

    # Add an endpoint for loading the input pdb
    loadPDBEndpoint = PluginEndpoint(
        url="/loadInputPDB",
        methods=["POST"],
        function=loadInputPDB,
    )

    # Add the endpoint to the plugin
    nbdsuitepage.addEndpoint(loadPDBEndpoint)

    def getInputInfo():
        data = request.json

        if data is None:
            return {"ok": False, "msg": "No data provided."}

        path = data.get("path", None)

        if isinstance(path, list):
            path = path[0]

        if path is None:
            return {"ok": False, "msg": "No data provided."}

        try:
            parser = NBDSuiteParser(path)
            data = parser.getInputInfo()
            return {"ok": True, "data": data}
        except Exception as e:
            return {"ok": False, "msg": str(e)}

    # Add an endpoint for loading the input pdb
    getInputInfoEndpoint = PluginEndpoint(
        url="/getInputInfo",
        methods=["POST"],
        function=getInputInfo,
    )

    # Add the endpoint to the plugin
    nbdsuitepage.addEndpoint(getInputInfoEndpoint)

    def getPDB():
        """
        Parses the selected PDB from the table (and untruncates if necessary)
        """

        data = request.json

        if data is None:
            return {"ok": False, "msg": "No data provided."}

        path = data.get("path", None)

        if isinstance(path, list):
            path = path[0]

        if path is None:
            return {"ok": False, "msg": "No data provided."}

        try:
            parser = NBDSuiteParser(path)
            data = parser.getPDB(data)
            return {"ok": True, "data": data}
        except Exception as e:
            return {"ok": False, "msg": str(e)}

    # Add an endpoint for loading the input pdb
    loadPDBEndpoint = PluginEndpoint(
        url="/getPDB",
        methods=["POST"],
        function=getPDB,
    )

    # Add the endpoint to the plugin
    nbdsuitepage.addEndpoint(loadPDBEndpoint)

    def getInputSimulationName():
        """
        Returns the name of the input simulation
        """

        data = request.json

        if data is None:
            return {"ok": False, "msg": "No data provided."}

        path = data.get("path", None)

        if isinstance(path, list):
            path = path[0]

        if path is None:
            return {"ok": False, "msg": "No data provided."}

        try:
            parser = NBDSuiteParser(path)
            data = parser.getInputSimulationName()
            return {"ok": True, "data": data}
        except Exception as e:
            return {"ok": False, "msg": str(e)}

    # Add an endpoint for loading the input pdb
    getInputSimulationNameEndpoint = PluginEndpoint(
        url="/getInputSimulationName",
        methods=["POST"],
        function=getInputSimulationName,
    )

    # Add the endpoint to the plugin
    nbdsuitepage.addEndpoint(getInputSimulationNameEndpoint)

    # Add atom-atom distance calculator endpoint
    def getAtomAtomDistance():
        """
        Computes the atom atom distance for a given complex and atom list
        """

        data = request.json

        if data is None:
            return {"ok": False, "msg": "No data provided."}

        path = data.get("path", None)

        if isinstance(path, list):
            path = path[0]

        if path is None:
            return {"ok": False, "msg": "No simulation path provided."}

        selectedComplex = data.get("selectedComplex", None)
        selectedAtoms = data.get("selectedAtoms", None)

        if selectedComplex is None or selectedAtoms is None:
            return {"ok": False, "msg": "No complex or atom list provided."}

        try:
            parser = NBDSuiteParser(path)
            parser.atomAtomDistance(selectedComplex, selectedAtoms)
            return {"ok": True}
        except Exception as e:
            return {"ok": False, "msg": str(e)}

    # Create the endpoint
    getAtomAtomDistanceEndpoint = PluginEndpoint(
        url="/getAtomAtomDistance",
        methods=["POST"],
        function=getAtomAtomDistance,
    )

    # Add the endpoint to the page
    nbdsuitepage.addEndpoint(getAtomAtomDistanceEndpoint)

    # Add the PELE results page to the plugin
    plugin.addPage(nbdsuitepage)

    # Return the plugin
    return plugin


plugin = createPlugin()
