import React, {
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { horusGet, horusPost } from "../../../../Views/Utils/utils";
import Plot from "react-plotly.js";
import NBDSuiteData from "./nbdsuitedata";
import HorusMolstar from "../../../../Views/Components/Molstar/HorusWrapper/horusmolstar";

import { AgGridReact } from "ag-grid-react"; // the AG Grid React Component
import "ag-grid-community/styles/ag-grid.css"; // Core grid CSS, always needed
import "ag-grid-community/styles/ag-theme-alpine.css"; // Optional theme CSS

declare global {
  interface Window {
    molstar?: HorusMolstar;
  }
}

interface OpenFolderProps {
  setOpenedFolder: (value: React.SetStateAction<string>) => void;
}

function OpenFolder(props: OpenFolderProps) {
  const openPickFolder = async () => {
    const request = await horusGet("/openfolder");

    const data = await request.json();

    const folder = data.path;

    props.setOpenedFolder(folder);
  };

  return (
    <div>
      <button onClick={openPickFolder}>Open Folder</button>
    </div>
  );
}

interface OpenInputFileProps {
  setOpenedFile: (value: React.SetStateAction<string>) => void;
}

function OpenInputFile(props: OpenInputFileProps) {
  const openPickFile = async () => {
    const request = await horusGet("/openfile");

    const data = await request.json();

    const file = data.path;

    props.setOpenedFile(file);
  };

  return (
    <div>
      <button onClick={openPickFile}>Open NBDSuite input</button>
    </div>
  );
}

interface PELEPlotProps {
  nbdData: NBDSuiteData;
}

function PELEPlot(props: PELEPlotProps) {
  const nbdData = props.nbdData;

  const [xAxis, setXAxis] = useState("");
  const [yAxis, setYAxis] = useState("");

  const [data, setData] = useState<Array<any>>([]);
  const [legendData, setLegendData] = useState<Array<any>>([]);

  const [axisOptions, setAxisOptions] = useState<Array<string>>([]);

  useEffect(() => {
    const options = nbdData.axisOptions();

    setAxisOptions(options);

    setXAxis(options[0]);
    setYAxis(options[1]);
  }, []);

  function dataToPlot() {
    const clusterColors = {
      A: "#636EFA",
      B: "#EF553B",
      C: "#00CC96",
      D: "#AB63FA",
      E: "#FFA15A",
      Other: "#909091",
    };

    const dToP: Array<any> = [];
    const legendEntries: any = {};
    for (const d in nbdData.plotData) {
      const currentData = nbdData.plotData[d];

      const xValues = currentData[xAxis];
      const yValues = currentData[yAxis];
      const clusters = currentData.Cluster;

      if (!xValues || !yValues || !clusters) {
        continue;
      }

      let symbol = "circle";

      if (d === "repr") {
        symbol = "star";
      }

      for (let i = 0; i < xValues.length; i++) {
        const cluster = clusters[i];
        let showLegend = false;
        if (!legendEntries[cluster]) {
          legendEntries[cluster] = {
            color: clusterColors[cluster] || "red",
            symbol: symbol,
          };
          showLegend = true;
        }
        const data = {
          x: [xValues[i]],
          y: [yValues[i]],
          type: "scatter",
          mode: "markers",
          marker: {
            color: clusterColors[cluster] || clusterColors.Other,
            symbol: symbol,
          },
          name: cluster,
          // Hide the legend for the repr data
          showlegend: showLegend,
        };

        dToP.push(data);
      }
    }
    setData(dToP);

    setLegendData(legendData);
  }

  useEffect(() => {
    dataToPlot();
  }, [xAxis, yAxis]);

  const updateXAxis = (e: any) => {
    setXAxis(e.target.value);
  };

  const updateYAxis = (e: any) => {
    setYAxis(e.target.value);
  };

  const xAxisOptions = (
    <select onChange={updateXAxis}>
      {axisOptions.map((c: string) => {
        return <option key={c}>{c}</option>;
      })}
    </select>
  );

  const yAxisOptions = (
    <select onChange={updateYAxis}>
      {axisOptions.map((c: string) => {
        return <option key={c}>{c}</option>;
      })}
    </select>
  );

  return (
    <div>
      <Plot
        key={"plot"}
        data={data}
        layout={{ width: 900, height: 800, title: "Test plot" }}
      />
      {xAxisOptions}
      {yAxisOptions}
    </div>
  );
}

interface PELETableProps {
  nbdData: NBDSuiteData;
}

function PELETable(props: PELETableProps) {
  const gridRef = useRef(); // Optional - for accessing Grid's API
  const [rowData, setRowData] = useState(); // Set rowData to Array of Objects, one Object per Row

  // Each Column Definition results in one Column.
  const [columnDefs, setColumnDefs] = useState([
    { field: "make", filter: true },
    { field: "model", filter: true },
    { field: "price" },
  ]);

  // DefaultColDef sets props common to all Columns
  const defaultColDef = useMemo(() => ({
    sortable: true,
  }));

  // Example of consuming Grid Event
  const cellClickedListener = useCallback((event) => {
    console.log("cellClicked", event);
  }, []);

  function loadDataTable() {
    const columnDefs = props.nbdData.axisOptions().map((c: string) => {
      return { headerName: c, field: c };
    });

    let rowData = props.nbdData.plotData.repr;

    const rdata = [];
    for (const r in rowData) {
      for (const c in rowData[r]) {
        if (!rdata[c]) {
          rdata[c] = {};
        }

        rdata[c][r] = rowData[r][c];
      }
    }

    rowData = props.nbdData.plotData.norepr;

    for (const r in rowData) {
      for (const c in rowData[r]) {
        if (!rdata[c]) {
          rdata[c] = {};
        }

        rdata[c][r] = rowData[r][c];
      }
    }

    setColumnDefs(columnDefs);
    setRowData(rdata);
  }

  useEffect(() => {
    if (props.nbdData) {
      loadDataTable();
    }
  }, []);

  // Example using Grid's API
  const buttonListener = useCallback((e) => {
    gridRef.current.api.deselectAll();
  }, []);

  return (
    <div>
      {/* Example using Grid's API */}
      <button onClick={buttonListener}>Push Me</button>

      {/* On div wrapping Grid a) specify theme CSS Class Class and b) sets Grid size */}
      <div className="ag-theme-alpine" style={{ width: 500, height: 500 }}>
        <AgGridReact
          ref={gridRef} // Ref for accessing Grid's API
          rowData={rowData} // Row Data for Rows
          columnDefs={columnDefs} // Column Defs for Columns
          defaultColDef={defaultColDef} // Default Column Properties
          animateRows={true} // Optional - set to 'true' to have rows animate when sorted
          rowSelection="multiple" // Options - allows click selection of rows
          onCellClicked={cellClickedListener} // Optional - registering for Grid Event
        />
      </div>
    </div>
  );
  // const [rows, setRows] = useState<Array<any>>([]);
  // const [columnDefs, setColumnDefs] = useState([
  //   { field: "make", filter: true },
  //   { field: "model", filter: true },
  //   { field: "price" },
  // ]);

  // function loadDataTable() {
  //   const columnDefs = props.nbdData.axisOptions().map((c: string) => {
  //     return { headerName: c, field: c };
  //   });

  //   const rowData = JSON.stringify(props.nbdData.plotData.repr);

  //   console.log([rowData]);

  //   fetch("https://www.ag-grid.com/example-assets/row-data.json")
  //     .then((result) => result.json())
  //     .then((rowData) => setRows(rowData));
  // }

  // useEffect(() => {
  //   if (props.nbdData) {
  //     loadDataTable();
  //   }
  // }, [props.nbdData]);

  // return (
  //   <div>
  //     <div>This is my first table</div>
  //     <AgGridReact rowData={rows} columnDefs={columnDefs} />
  //   </div>
  // );
}

interface PELEInputProps {
  nbdData: NBDSuiteData;
}

function PELEInput(props: PELEInputProps) {
  const [info, setInfo] = useState<any>(null);

  async function loadInputInfo() {
    await props.nbdData.getInputInfo();
    setInfo(props.nbdData.inputInfo);
  }

  useEffect(() => {
    if (props.nbdData) {
      loadInputInfo();
    }
  }, []);

  return (
    <textarea
      value={info}
      onChange={(e) => setInfo(e.target.value)}
      style={{ height: "200px" }}
    />
  );
}

function NBDSuiteResults() {
  const [openedFile, setOpenedFile] = useState("");

  const [complexes, setComplexes] = useState<Array<string>>([]);
  const [data, setData] = useState([]);

  const [selectedComplex, setSelectedComplex] = useState("");

  const [error, setError] = useState(false);

  const errorMsg = useRef("");
  const NBDData = useRef<NBDSuiteData | null>(null);

  const updateSelectedComplex = (e: any) => {
    setSelectedComplex(e.target.value);
  };

  const complexesView = (
    <select>
      {complexes.map((c: any) => {
        return <option onChange={updateSelectedComplex}>{c}</option>;
      })}
    </select>
  );

  const fetchNBDData = async () => {
    const nbddata = new NBDSuiteData(openedFile);

    try {
      await nbddata.getComplexes();

      setComplexes(nbddata.complexes);

      await nbddata.getPlotData(nbddata.complexes[0]);

      setData(nbddata.plotData);

      nbddata.getInputPDB();

      NBDData.current = nbddata;
    } catch (e) {
      setError(true);
      errorMsg.current = e.message;
      return;
    }
  };

  useEffect(() => {
    if (openedFile) {
      fetchNBDData();
    }
  }, [openedFile]);

  return openedFile ? (
    <div>
      {error && <p>Error reading results {errorMsg.current}</p>}
      <p>Opened: {openedFile}</p>
      {complexesView}
      {NBDData.current && (
        <div>
          <PELEPlot nbdData={NBDData.current} />
          <PELETable nbdData={NBDData.current} />
          <PELEInput nbdData={NBDData.current} />
        </div>
      )}
      <button onClick={() => setOpenedFile("")}>Close</button>
    </div>
  ) : (
    <OpenInputFile setOpenedFile={setOpenedFile} />
  );
}

export { NBDSuiteResults };
