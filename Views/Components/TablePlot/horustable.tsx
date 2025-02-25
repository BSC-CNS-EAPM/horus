import { forwardRef } from "react";
import { AgGridReact } from "ag-grid-react"; // React Data Grid Component
import { AgGridEvent, GridApi, GridOptions } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import "./table.css";
import AppButton from "../appbutton";

type HorusTableProps = {
  rows: any[];
  columnDefs: any[];
  allowDownload?: {
    filename: string;
  };
  onCellClick?: (e: AgGridEvent) => void;
  onCellEdit?: (e: AgGridEvent) => void;
  getRowId?: (e: any) => any;
  sortable?: boolean;
  gridProps?: GridOptions;
};

export const HorusTable = forwardRef((props: HorusTableProps, ref: any) => {
  const downloadCSV = () => {
    const gridRef = ref.current.api as GridApi;
    console.log(ref);
    const csv =
      gridRef?.getDataAsCsv({
        suppressQuotes: true,
      }) ?? "";

    window.horus.saveFile(
      new File([csv], props.allowDownload?.filename ?? "data.csv", {
        type: "text/csv",
      }),
    );
  };

  const height = props.allowDownload ? "[97%]" : "full";

  return (
    <div className="h-full p-2">
      {props.allowDownload && (
        <AppButton action={downloadCSV}>Save CSV</AppButton>
      )}
      <div
        className={`ag-theme-quartz h-${height}`} // applying the grid theme
      >
        <AgGridReact
          // @ts-ignore
          ref={ref}
          singleClickEdit
          rowData={props.rows}
          columnDefs={props.columnDefs}
          onCellClicked={props.onCellClick}
          onCellEditingStopped={props.onCellEdit}
          getRowId={props.getRowId}
          {...props.gridProps}
        />
      </div>
    </div>
  );
});
