import os
import yaml
import re
from flask import request
import pandas as pd
import typing as t

from HorusAPI import (
    Plugin,
    PluginBlock,
    PluginVariable,
    VariableTypes,
    PluginPage,
    PluginEndpoint,
    TempFile,
)


def createPlugin():
    plugin = Plugin(id="NBDSuite")

    plugin.info = {
        "name": "NBDSuite",
        "description": "The NBDSuite plugin for Horus",
        "author": "Nostrum Biodiscovery",
        "version": "0.0.1",
        "dependencies": ["nbdsuite", "pandas", "biopython"],
    }

    # Define the variables for the Input Yaml block

    cpus = PluginVariable(
        id="cpus",
        name="CPUs",
        description="The number of computation cores that \
            NBDSuite will use in the run.",
        type=VariableTypes.INTEGER,
        defaultValue=1,
    )

    verbosity = PluginVariable(
        id="verbosity",
        name="Verbosity",
        description=" Defines the general verbosity level for the NBD Suite run.",
        type=VariableTypes.STRING_LIST,
        defaultValue="info",
        allowedValues=["info", "debug", "warning", "error", "critical"],
    )

    systemData = PluginVariable(
        id="systemData",
        name="System data",
        description="Path to a System PDB file. This should only contain the protein or"
        "biological system. Can also be a list of PDB files or a string with"
        "an asterisk wildcard representing a file pattern.",
        type=VariableTypes.STRING,
        defaultValue="",
    )

    ligandData = PluginVariable(
        id="ligandData",
        name="Ligand data",
        description="Path to a Ligand PDB file. This should only contain the ligand."
        "Can also be a list of PDB or DF files, a string with an asterisk"
        "wildcard representing a file pattern, or a list of SMILES tags.",
        type=VariableTypes.STRING,
        defaultValue="",
    )

    name = PluginVariable(
        id="name",
        name="Name",
        description="Pipeline name. It will determine the name of the folder where the"
        "output of the NBD Suite simulation will be saved.",
        type=VariableTypes.STRING,
        defaultValue="NBDSuite",
    )

    static_name = PluginVariable(
        id="static_name",
        name="Static name",
        description="Private attribute of the model to define whether the output folder"
        "of the NBD Suite must be static or can be indexed to avoid"
        "overwriting an existing folder. Its default value is set to False"
        "if a the default name is used for Pipeline. If it has a custom"
        "value, static_name is set to True.",
        type=VariableTypes.BOOLEAN,
        defaultValue=False,
    )

    # Define the action for the Input Yaml block
    def createYAML(block: PluginBlock):
        print("Creating YAML file...")

    # Define the Input Yaml block
    createYAMLBlock = PluginBlock(
        name="NBDSuite input",
        description="Creates a NBDSuite input file.",
        action=createYAML,
        variables=[cpus, verbosity, systemData, ligandData, name, static_name],
    )

    topology_extractor = PluginBlock(
        name="Topology extractor",
        description="Adds a topology extractor to the pipeline.",
        action=lambda block: print("Adding topology extractor..."),
        variables=[
            PluginVariable(
                id="check_topology",
                name="Check topology",
                description="Checks that residues with same name are \
                    consistent among all"
                "input structures.",
                type=VariableTypes.BOOLEAN,
                defaultValue=True,
            ),
            PluginVariable(
                id="explicit_h_in_smiles",
                name="Explicit H in SMILES",
                description="Whether the input molecule has explicit information about"
                "hydrogen atoms to be considered when the molecule is built.",
                type=VariableTypes.BOOLEAN,
                defaultValue=False,
            ),
            PluginVariable(
                id="remove_implicit_hydrogens",
                name="Remove implicit hydrogens",
                description="It removes implicit hydrogen atoms from input structures."
                "This strategy might solve some problems with wrong geometries"
                "in input structures. Implicit hydrogen atoms are selected by"
                "PDB atom name and are those that are not defining any"
                "variable protonation state.",
                type=VariableTypes.BOOLEAN,
                defaultValue=False,
            ),
            PluginVariable(
                id="fix_structures",
                name="Fix structures",
                description="Tries to fix any problem with input structures.\
                      If they have"
                "already been prepared carefully, this step can be skipped.",
                type=VariableTypes.BOOLEAN,
                defaultValue=True,
            ),
        ],
    )

    createYAMLBlock.addSubBlock(topology_extractor)

    topology_fixer = PluginBlock(
        name="Topology fixer",
        description="Adds a topology fixer to the pipeline.",
        action=lambda block: print("Adding topology fixer..."),
        variables=[
            PluginVariable(
                id="drop_water",
                name="Drop water",
                description="When set to True, water molecules will be removed from"
                "topologies.",
                type=VariableTypes.BOOLEAN,
                defaultValue=True,
            ),
            PluginVariable(
                id="repair_heavy_atoms",
                name="Repair heavy atoms",
                description="When set to True, an attempt to solve problems on heavy"
                "atoms will be performed.",
                type=VariableTypes.BOOLEAN,
                defaultValue=True,
            ),
            PluginVariable(
                id="protonation_ph",
                name="Protonation pH",
                description="pH to consider when protonating topologies.",
                type=VariableTypes.INTEGER,
                defaultValue=7,
            ),
            PluginVariable(
                id="std_residues_to_drop",
                name="Standard residues to drop",
                description="List of standard residue names to remove from topology"
                "models.",
                type=VariableTypes.STRING,
                defaultValue=[],
            ),
            PluginVariable(
                id="het_residues_to_drop",
                name="Hetero residues to drop",
                description="List of non standard residue names to remove from topology"
                "model.",
                type=VariableTypes.STRING,
                defaultValue=[],
            ),
        ],
    )

    createYAMLBlock.addSubBlock(topology_fixer)

    # Add the Input Yaml block to the plugin
    plugin.addBlock(createYAMLBlock)

    # Define the PELE results page
    nbdsuitepage = PluginPage(
        name="NBDSuite",
        description="Analyse NBDSuite results.",
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

    # Add the PELE results page to the plugin
    plugin.addPage(nbdsuitepage)

    return plugin


plugin = createPlugin()


class NBDSuiteParser:
    path: str
    """
    The path to the job folder.
    """

    inputPath: str
    """
    The path to the input.yaml file.
    """

    simulationPath: str
    """
    The path to the simulation folder.
    """

    latestSimPath: str
    """
    The path to the latest simulation folder.
    """

    TRANSLATE_PLOT_DATA = {
        "Cluster": "Cluster label",
        "Step": "Step",
        "bindingEnergy": "Binding energy",
        "currentEnergy": "Current energy",
        "epoch": "Epoch",
        "ligandRMSD": "Ligand RMSD",
        "ligandSASA": "Ligand SASA",
        "numberOfAcceptedPeleSteps": "Accepted PELE steps",
    }

    def __init__(self, inputPath: str):
        # Get the path to the simulation folder (remove the file from the path)
        self.path = os.path.dirname(inputPath)
        self.inputPath = inputPath
        self._parse(inputPath)

    def _parse(self, inputPath):
        """
        Parses the input.yaml file.

        Parameters
        ----------
        inputPath : str
            Full path to the input.yaml file.
        """
        with open(inputPath) as f:
            self.input = yaml.load(f, Loader=yaml.FullLoader)

        self.simulationPath = os.path.join(self.path, self.input["name"])

        # Get the last adaptive simulation folder
        adaptive_dir = self._getLastFolder(
            self.simulationPath, "_adaptive_pele_simulation"
        )

        # Define pele output path
        self.latestSimPath = os.path.join(self.simulationPath, adaptive_dir)

    def getInputInfo(self):
        """
        Returns the input information (YAML) as a JSON object.
        """

        # Return the input file as a string
        with open(self.inputPath) as f:
            return f.read()

    def getInputSimulationName(self):
        """
        Returns the input simulation name.
        """
        return self.input["name"]

    def listComplexes(self):
        """
        Lists the complexes inside the simulation folder
        (last *_adaptive_pele_simulation folder)
        """

        # Load complexes (dropdown components)
        complexes = self._get_immediate_subdirectories(self.latestSimPath)

        # Filter out the folders that do not start with 'complex_'
        complexes = [x for x in complexes if x.startswith("complex_")]

        # pop '.block' from dropdown contents
        complexes = [i for i in complexes if i != ".block"]

        # Sort the dropdown contents alphabetically
        complexes.sort(key=self.natural_keys)

        return complexes

    def listTopSelections(self, complex: str):
        """
        Lists the top selections inside the given complex folder.

        Parameters
        ----------
        complex : str
            Name of the complex folder retrived by the listComplexes function.
        """

        # Get the path to the top selection file
        topSelFile = os.path.join(
            self.latestSimPath, complex, "results", "top_selections.csv"
        )

        # Read the top selection file
        topSeldf = pd.read_csv(topSelFile)

        topSelOptions = [
            {"label": f"Cluster {i}", "value": i} for i in topSeldf["Cluster label"]
        ]
        return topSelOptions

    def getPlotData(self, complex: str):
        """
        Returns the data for the plot.

        Parameters
        ----------
        complex : str
            Name of the complex folder retrived by the listComplexes function.
        selection : int
            The selected top selection to plot retrieved by the
            listTopSelections function.
        """

        # Get the important paths
        complexPath = os.path.join(self.latestSimPath, complex)
        resultsCSV = os.path.join(complexPath, "results", "results.csv")
        infoCSV = os.path.join(complexPath, "results", "info.csv")
        topSelFile = os.path.join(complexPath, "results", "top_selections.csv")

        # Read the results.csv file
        topDF = pd.read_csv(topSelFile)
        infoDF = pd.read_csv(infoCSV)
        resultsDF = pd.read_csv(resultsCSV)

        # Create a dict for the cluster label
        cluster_label_dict = {}
        cluster_representative_ids = []
        for i in range(len(infoDF)):
            label = infoDF["Selected labels"][i]
            cluster = str(infoDF["Cluster"][i])

            # Only add clusters that appear in top_selections.csv
            if label in topDF["Cluster label"].values:
                cluster_label_dict[cluster] = label
                cluster_row = topDF[topDF["Cluster label"] == label].iloc[0]
                cluster_trajectory = cluster_row["trajectory"]
                cluster_step = cluster_row["Step"]
                cluster_representative_ids.append((cluster_trajectory, cluster_step))

        # Remove outliers
        n_points_to_remove = int(len(resultsDF) * 0.1)
        resultsDF = resultsDF.sort_values(by=["currentEnergy"], ascending=False).iloc[
            n_points_to_remove:
        ]

        # Show in the scatter plot only the clusters that appear in keys
        keys = list(cluster_label_dict.keys())
        clusterDF = resultsDF[resultsDF["Cluster"].isin(keys)]
        noclusterDF = resultsDF[~resultsDF["Cluster"].isin(keys)]

        # Generate representatives dataframe
        reprDF = pd.DataFrame()
        for index, row in clusterDF.iterrows():
            trajectory = row["trajectory"]
            step = row["numberOfAcceptedPeleSteps"]

            if (trajectory, step) in cluster_representative_ids:
                reprDF = pd.concat([reprDF, pd.DataFrame([row])], ignore_index=True)

        # Generate no representatives dataframe
        noreprDF = (
            pd.merge(clusterDF, reprDF, indicator=True, how="outer")
            .query('_merge=="left_only"')
            .drop("_merge", axis=1)
        )

        # Add the cluster label to the dataframe from the dict
        clusterDF["Cluster"] = clusterDF["Cluster"].map(cluster_label_dict)
        noclusterDF["Cluster"] = "Other"
        reprDF["Cluster"] = reprDF["Cluster"].map(cluster_label_dict)
        noreprDF["Cluster"] = noreprDF["Cluster"].map(cluster_label_dict)

        # Sort the dataframe by cluster label
        reprDF = reprDF.sort_values(by=["Cluster"], ascending=False)
        noreprDF = noreprDF.sort_values(by=["Cluster"], ascending=False)

        # Add filepath new column for the top selection proteins
        reprDF["filename"] = reprDF["Cluster"].apply(lambda x: f"cluster_{x}.pdb")
        reprDF["filepath"] = reprDF["filename"].apply(
            lambda x: os.path.join(complexPath, "results", x)
        )

        # Add filepath new column for the no top selection proteins
        noreprDF["filename"] = None
        noreprDF["filepath"] = None

        # Add filepath new column for the no cluster proteins
        noclusterDF["filename"] = None
        noclusterDF["filepath"] = None

        # Add n new id column
        reprDF["id"] = "R" + reprDF.index.astype(str)
        noreprDF["id"] = "NR" + noreprDF.index.astype(str)
        noclusterDF["id"] = "NC" + noclusterDF.index.astype(str)

        # Add a "type" column to the dataframes
        reprDF["Type"] = "Representative"
        noreprDF["Type"] = "No representative"
        noclusterDF["Type"] = "No cluster"

        def truncateDecimals(df, decimals: int):
            # Truncate the decimals of the dataframe data
            df = df.round(decimals)
            # Add trailing zeros to the decimals of columns that
            # are floats
            df = df.applymap(
                lambda x: f"{x:.{decimals}f}" if isinstance(x, float) else x
            )
            # Convert back to float if possible
            df = df.applymap(
                lambda x: float(x)
                if isinstance(x, str) and x.replace(".", "", 1).isdigit()
                else x or x
            )
            return df

        reprDF = truncateDecimals(reprDF, 3)
        noreprDF = truncateDecimals(noreprDF, 3)
        noclusterDF = truncateDecimals(noclusterDF, 3)

        # Use the TRANSLATE_PLOT_DATA dict to rename the columns.
        # If a entry is not present the column name is not changed.
        reprDF = reprDF.rename(columns=self.TRANSLATE_PLOT_DATA)
        noreprDF = noreprDF.rename(columns=self.TRANSLATE_PLOT_DATA)
        noclusterDF = noclusterDF.rename(columns=self.TRANSLATE_PLOT_DATA)

        # Return the dataframes
        data = {
            "nocluster": noclusterDF.to_dict(orient="records"),
            "repr": reprDF.to_dict(orient="records"),
            "norepr": noreprDF.to_dict(orient="records"),
        }

        return data

    def getInputPDB(self):
        """
        Reads and sends the input PDB file to the frontend.
        """

        # Get the path to the input PDB file
        inputPDBName = self.input["system_data"]

        inputPDB = os.path.join(self.path, inputPDBName)

        # Read the input PDB file
        with open(inputPDB, "r") as f:
            inputPDB = f.read()

        data = {"pdb": inputPDB, "name": inputPDBName}

        return data

    def untruncatePDB(self, truncatedPDBPath: str):
        """
        Reads and sends the untruncated PDB file to the frontend.
        """

        # Get the topology_truncator folder
        tpTruncatorDir = self._getLastFolder(self.simulationPath, "_topology_truncator")

        # Read the results.csv present in the _topology_truncator block
        truncatorcsv = os.path.join(self.simulationPath, tpTruncatorDir, "results.csv")

        # Load the csv as a pandas dataframe
        df = pd.read_csv(truncatorcsv)

        original_complex = df["original_conformation"][0]

        pdb_name = original_complex.split("/")[-1]

        original_complex_filename = os.path.join("complexes", pdb_name)

        topolgy_merger_path = self._getLastFolder(
            self.simulationPath, "_topology_merger"
        )

        originalComplexPath = os.path.join(
            self.simulationPath, topolgy_merger_path, original_complex_filename
        )

        # Add between the pdb name and the extension the "_ligand" string
        ligandFilename = pdb_name.split(".")[0] + "_ligand.pdb"

        ligandPath = os.path.join(
            self.simulationPath, topolgy_merger_path, "complexes", ligandFilename
        )

        from nbdsuite.utils.helpers.common import PDB  # type: ignore

        ligandPDB = PDB(ligandPath)

        ligandID = ligandPDB.get_hetero_molecule_residue_ids()[0]

        # Read the system_path and store the pdb in a string
        with open(originalComplexPath, "r") as f:
            pdb = f.read()

        # Create a tmp file where the untruncated pdb will be stored
        tmpfile = TempFile("untruncated.pdb")
        tmpfile.write(pdb)

        from nbdsuite.utils.helpers.common import pdb as pdb_helper  # type: ignore

        # Untruncate the pdbFile with the NBDSuite
        coordsUpdater = pdb_helper.PDBCoordsUpdater(
            originalComplexPath, truncatedPDBPath, tmpfile.tmpFolder
        )

        # Get the "flexible_residue_ids" values for the first row
        flexible_residue_ids = df["flexible_residue_ids"][0]

        from nbdsuite.utils import string_to_link_ids_list  # type: ignore

        flexible_residue_ids = string_to_link_ids_list(flexible_residue_ids)

        formatted_flexible_residue_ids = list()
        for flexible_residue_id in flexible_residue_ids:
            chain, resnum = flexible_residue_id.split(":")
            resnum = int(resnum)
            formatted_flexible_residue_ids.append((chain, resnum))
        flexible_residue_ids = formatted_flexible_residue_ids

        flexible_residue_ids.append(ligandID)

        untruncated_path = coordsUpdater.update_residues_subset(flexible_residue_ids)

        # Return the filepath
        return untruncated_path

    def _getPDBFromTrajectory(
        self,
        selectedComplex: str,
        trajectoryPath: str,
        step: str,
        cluster: str = "Other",
    ):
        current_path = os.path.join(self.latestSimPath, selectedComplex, "results")

        # Define the topoly path (adaptive.conf)
        conf = os.path.join(self.latestSimPath, selectedComplex, "adaptive.conf")

        # Repalce %20 with spaces in conf
        conf = conf.replace("%20", " ")

        # Read the file as JSON
        import json

        with open(conf, "r") as f:
            conf = json.load(f)

        # Get the topology path
        topology = conf["generalParams"]["initialStructures"][0]

        filename = f"{cluster}_{step}.pdb"

        # Create a temp file for storing the pdb
        tmp_pdb = TempFile(filename, self.path)

        ##########################################################
        # TEMPORARY DEVELOPMENT
        # Get only the last part of the path as
        # it can change depending on where PELE was run
        # /shared/work/hmartin/NBDSuite_benchmark/cdk8/cdk8_test_1/ +
        # + 9_adaptive_pele_simulation/complex_33/output/0/trajectory_2.xtc
        # /dataweb/app/development/nbdsuite_gui/database_users_folder/ +
        # + cdominguez/pele/cdk8_test_1/9_adaptive_pele_simulation/complex_33/results

        # Get the last 3 parts of the path
        xtc_path = "/".join(trajectoryPath.split("/")[-3:])
        xtc_path = os.path.join(current_path, "..", xtc_path)
        ##########################################################

        # Using the NBDSuite, extract the pdb file
        import nbdsuite.utils.helpers.common.xtc as xtc  # type: ignore

        try:
            xtc.extract_snapshot_from_xtc(xtc_path, tmp_pdb.path, topology, step)
        except Exception as e:
            import traceback

            print(traceback.format_exc())
            raise Exception(
                f"Error while extracting the pdb file from the trajectory: {e}"
            )

        return tmp_pdb.path, filename

    def getPDB(self, data: dict[str, t.Any]):
        """
        Reads and sends the PDB file to the frontend.
        """

        # Get the selected complex
        selectedComplex = data["selectedComplex"]

        # Get the filepath and filename
        filepath = data["filepath"]
        filename = data["filename"]

        if filename is None:
            # Get the trajectory and step
            trajectory = data["trajectory"]
            step = data["step"]

            # Find the PDB from the trajectory
            filename, filepath = self._getPDBFromTrajectory(
                selectedComplex, trajectoryPath=trajectory, step=step
            )

        # Untruncate the pdbFile with the NBDSuite
        untruncatedPath = self.untruncatePDB(filepath)

        # Read the untruncated_path and store the pdb in a string
        with open(untruncatedPath, "r") as f:
            pdb = f.read()

        # Remove the untruncated file
        os.remove(untruncatedPath)

        data = {"pdb": pdb, "name": filename}

        # Return the pdb
        return data

    @staticmethod
    def _getLastFolder(path, name):
        # This function returns the last folder of the different blocks

        # Get all the folders that contain the name
        dirs = [
            x for x in os.listdir(path) if x.endswith(name) and not x.startswith(".")
        ]

        # Replace any spaces by %20
        dirs = [x.replace(" ", "%20") for x in dirs]

        # Sort the folders by the number of the last folder
        dirs.sort(key=lambda x: int(x.split("_")[0]))

        # Get the last folder
        dir = dirs[-1]

        # Replace %20 by spaces
        dir = dir.replace("%20", " ")

        # Return the dir
        return dir

    @staticmethod
    def _get_immediate_subdirectories(a_dir, full_path=False):
        try:
            subdirectories = [
                os.path.join(a_dir, name) if full_path else name
                for name in os.listdir(a_dir)
                if os.path.isdir(os.path.join(a_dir, name))
            ]
            subdirectories.sort(
                key=lambda x: os.path.getctime(os.path.join(a_dir, x)), reverse=True
            )
            return subdirectories
        except Exception:
            return []

    @staticmethod
    def natural_keys(text):
        """
        alist.sort(key=natural_keys) sorts in human order
        http://nedbatchelder.com/blog/200712/human_sorting.html
        (See Toothy's implementation in the comments)
        """

        def atoi(text):
            return int(text) if text.isdigit() else text

        return [atoi(c) for c in re.split(r"(\d+)", text)]
