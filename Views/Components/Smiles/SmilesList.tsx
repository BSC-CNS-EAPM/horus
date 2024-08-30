import { ColDef, IRowNode, SelectionChangedEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useEffect, useMemo, useRef } from "react";
import { HorusTable } from "../TablePlot/horustable";
import { SmilesView } from "./SmilesComponent";
import { CannotEdit3D, NoPreviewSmilesView } from "./SmilesGrid";
import { HorusSmilesType } from "./SmilesWrapper/horusSmiles";
import { useAlert } from "../HorusPrompt/horus_alert";

export function SmilesList(props: {
  availableSmiles: HorusSmilesType[];
  updateExistingSmiles: (smiles: HorusSmilesType) => void;
  onClickEdit: (smiles: HorusSmilesType) => void;
  previewSmiles: boolean;
}) {
  const { availableSmiles, updateExistingSmiles, onClickEdit } = props;

  const tableRef = useRef<AgGridReact | null>(null);

  const columns = useMemo(() => {
    const columns: ColDef[] = [
      {
        width: 50,
        checkboxSelection: true,
        headerCheckboxSelection: true,
        headerCheckboxSelectionFilteredOnly: true,
      },
      {
        resizable: false,
        width: 180,
        field: "2D",
        filter: false,
        sortable: false,
        cellStyle: { padding: "0px" },
        refData: {
          smi: "smi",
        },
        cellRenderer: (params: any) => {
          const data = params.data as HorusSmilesType;

          if (props.previewSmiles) {
            return (
              <SmilesView
                width={"180px"}
                height={"50px"}
                smiles={data.smi}
                removePolygon={true}
                containerProps={{
                  onClick: () => {
                    if (data.structureRef) return;
                    onClickEdit(data);
                  },
                }}
                options={{
                  depict: true,
                  zoom: false,
                }}
              ></SmilesView>
            );
          }

          return (
            <NoPreviewSmilesView
              smiles={data}
              onClickEdit={() => {
                data.structureRef ? null : onClickEdit(data);
              }}
            />
          );
        },
      },
      {
        field: "smi",
        headerName: "SMILES",
        filter: true,
        sortable: true,
        editable: true,
        singleClickEdit: true,
      },
      {
        field: "label",
        filter: true,
        sortable: true,
        editable: true,
      },
      {
        field: "group",
        filter: true,
        sortable: true,
        editable: true,
      },
      {
        field: "structureRef",
        headerName: "Comes from 3D structure",

        valueGetter: (params: any) => {
          const data = params.data as HorusSmilesType;
          return data.structureRef ? true : false;
        },
        cellRenderer: "agCheckboxCellRenderer",
        sortable: true,
        filter: true,
        editable: false,
      },
      {
        field: "extraInfo",
        filter: true,
        sortable: true,
        editable: true,
        valueGetter: (params: any) => {
          const data = params.data as HorusSmilesType;
          return data.extraInfo ?? "-";
        },
      },
    ];

    const addedProperties = new Set<string>();

    const addProperties = (smile: HorusSmilesType) => {
      if (!smile.properties) return;

      Object.keys(smile.properties).forEach((key) => {
        if (!addedProperties.has(key)) {
          addedProperties.add(key);
          columns.push({
            // @ts-ignore
            isProperty: true,
            field: key,
            filter: "agNumberColumnFilter",
            sortable: true,
            editable: true,
            valueGetter: (params: any) => {
              const data = params.data as HorusSmilesType;

              if (!data.properties) return null;

              return data.properties[key];
            },
          });
        }
      });
    };

    availableSmiles.forEach(addProperties);

    return columns;
  }, [availableSmiles, onClickEdit]);

  const horusAlert = useAlert();

  const handleRowEditingStarted = (event: any) => {
    // If the molecule comes from 3D structure, do not allow editing
    if (event.data.structureRef) {
      horusAlert(CannotEdit3D);
      event.api.stopEditing();
    }
  };

  const editCell = (event: any) => {
    // If the modified value is from the property, we need to update the smiles accordingly
    if (event.colDef.isProperty) {
      const newValue = event.newValue;
      const field = event.colDef.field;
      // Find the smiles
      const smiles = availableSmiles.find((s) => s.id === event.data.id);
      if (!smiles) return;
      if (!smiles.properties) smiles.properties = {};
      smiles.properties[field] = newValue;
      updateExistingSmiles(smiles);
    } else {
      // Just assign the new value
      updateExistingSmiles(event.data);
    }
  };

  const handleRowSelected = (event: SelectionChangedEvent) => {
    if (event.source === "rowDataChanged") {
      return;
    }

    if (!tableRef.current) return;
    const selectedNodes = tableRef.current.api.getSelectedNodes();
    const selectedData = selectedNodes.map((node: IRowNode) => node.data.id);

    const newSmiles = availableSmiles.map((s) => {
      return {
        ...s,
        selected: selectedData.includes(s.id),
      };
    });

    window.smiles?.setSmilesList(newSmiles);
  };

  useEffect(() => {
    const api = tableRef.current?.api;

    if (!api) return;

    const selectedData = new Set<string>(
      availableSmiles.filter((s) => s.selected).map((s) => s.id)
    );
    const nodesToSelect: IRowNode[] = [];
    api.forEachNode((node: IRowNode) => {
      if (node.data && selectedData.has(node.data.id)) {
        nodesToSelect.push(node);
      }
    });
    api.setNodesSelected({
      nodes: nodesToSelect,
      newValue: true,
      source: "rowDataChanged",
    });
  }, [tableRef, availableSmiles]);

  return (
    <HorusTable
      ref={tableRef}
      columnDefs={columns}
      rows={availableSmiles}
      gridProps={{
        singleClickEdit: true,
        rowBuffer: 0,
        onRowSelected: handleRowSelected,
        suppressPropertyNamesCheck: true,
        rowSelection: "multiple",
        suppressRowClickSelection: true,
        suppressScrollOnNewData: true,
        defaultColDef: {
          cellStyle: {
            display: "flex",
            alignItems: "center ",
          },
        },
        onCellEditingStarted: handleRowEditingStarted,
      }}
      onCellEdit={editCell}
    ></HorusTable>
  );
}
