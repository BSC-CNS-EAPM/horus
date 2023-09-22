from HorusAPI import PluginPage, PluginEndpoint
from NBDSuiteParser import NBDSuiteParser
from flask import request

# Define the PELE results page
peleResultsPage = PluginPage(
    id="peleresults",
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
peleResultsPage.addEndpoint(loadComplexesEndpoint)


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
peleResultsPage.addEndpoint(loadTopSelectionsEndpoint)


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
peleResultsPage.addEndpoint(plotData)


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
peleResultsPage.addEndpoint(loadPDBEndpoint)


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
peleResultsPage.addEndpoint(getInputInfoEndpoint)


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
peleResultsPage.addEndpoint(loadPDBEndpoint)


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
peleResultsPage.addEndpoint(getInputSimulationNameEndpoint)


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
peleResultsPage.addEndpoint(getAtomAtomDistanceEndpoint)
