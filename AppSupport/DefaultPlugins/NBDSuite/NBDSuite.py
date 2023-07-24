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
        "dependencies": ["nbdsuite", "pandas", "biopython"],
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
        defaultValue=1,
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
        defaultValue=["OPLS2005"],
        allowedValues=["OPLS2005", "OPENFF-2.0.0", "OPENFF-1.3.0"],
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
        id="folder",
        description="The folder containing the results.",
        type=VariableTypes.FOLDER,
    )

    # Induced fit refinement block
    def inducedFitRefinement(block: PluginBlock):
        complex_data = block.inputs.get("file", None)

        if complex_data is None:
            raise Exception("No complex data provided.")

        # complex_ligand_selection = block.variables.get("ligand_selection", None)
        # cpus = block.variables.get("cpus", 1)
        # name = block.variables.get("simulation_name", "ifr")
        # flexible_region_radius = block.variables.get("flexible_region_radius", 10.0)
        # frozen_region_radius = block.variables.get("frozen_region_radius", 15.0)
        # pele_force_field = block.variables.get("pele_force_field", "OPLS2005")
        # pele_steps = block.variables.get("pele_steps", 5)
        # epochs = block.variables.get("epochs", 1)

        print("Defining pipeline induced_fit_refinement...")

        block.setOutput("folder", "simulation/example")

    # Define the block
    inducedFitRefinementBlock = PluginBlock(
        name="Induced fit refinement",
        description="Perform an induced fit refinement simulation.",
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

    return plugin


plugin = createPlugin()
