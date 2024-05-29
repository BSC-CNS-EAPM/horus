import { forwardRef } from "react";
import { AgGridReact } from "ag-grid-react"; // React Data Grid Component
import { AgGridEvent } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

type HorusTableProps = {
  rows: any[];
  columnDefs: any[];
  onCellClick?: (e: AgGridEvent) => void;
  onCellEdit?: (e: AgGridEvent) => void;
  getRowId?: (e: any) => any;
  sortable?: boolean;
};

export const HorusTable = forwardRef((props: HorusTableProps, ref: any) => {
  return (
    <div
      className="ag-theme-quartz h-full p-2" // applying the grid theme
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
      />
    </div>
  );
});
