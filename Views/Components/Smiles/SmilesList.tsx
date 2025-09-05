import { ColDef, IRowNode, SelectionChangedEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { HorusTable } from "../TablePlot/horustable";
import { SmilesView } from "./SmilesComponent";
import { CannotEdit3D, NoPreviewSmilesView } from "./SmilesGrid";
import { HorusSmilesType } from "./SmilesWrapper/horusSmiles";
import { useAlert } from "../HorusPrompt/horus_alert";

function getPropertiesSet(smiles: HorusSmilesType[]) {
  const properties = new Set<string>();

  smiles.forEach((smile: HorusSmilesType) => {
    if (!smile.properties) return;

    Object.keys(smile.properties).forEach((key) => {
      if (properties.has(key)) return;
      properties.add(key);
    });
  });

  return properties;
}

function getPropertiesAsColDef(properties: Set<string>): ColDef[] {
  const colDef: ColDef[] = [];
  properties.forEach((property) => {
    colDef.push({
      // @ts-ignore
      isProperty: true,
      field: property,
      filter: "agNumberColumnFilter",
      sortable: true,
      editable: true,
      valueGetter: (params: { data: HorusSmilesType }) =>
        params.data.properties?.[property] ?? null
    });
  });
  return colDef;
}

export function SmilesList(props: {
  availableSmiles: HorusSmilesType[];
  updateExistingSmiles: (smiles: HorusSmilesType) => void;
  onClickEdit: (smiles: HorusSmilesType) => void;
  previewSmiles: boolean;
}) {
  const { availableSmiles, updateExistingSmiles, onClickEdit, previewSmiles } =
    props;

  const tableRef = useRef<AgGridReact | null>(null);
  const horusAlert = useAlert();

  const BASIC_COLDEF = useMemo<ColDef[]>(() => {
    return [
      {
        width: 50,
        checkboxSelection: true,
        headerCheckboxSelection: true,
        headerCheckboxSelectionFilteredOnly: true
      },
      {
        resizable: false,
        width: 180,
        field: "2D",
        filter: false,
        sortable: false,
        cellStyle: { padding: "0px" },
        refData: {
          smi: "smi"
        },
        cellRenderer: (params: any) => {
          const data = params.data as HorusSmilesType;

          if (!previewSmiles)
            return (
              <NoPreviewSmilesView
                smiles={data}
                onClickEdit={() => {
                  onClickEdit(data);
                }}
              />
            );

          return (
            <SmilesView
              width={"180px"}
              height={"50px"}
              smiles={data.smi}
              removePolygon={false}
              containerProps={{
                onClick: () => {
                  onClickEdit?.(data);
                }
              }}
              options={{
                depict: true,
                zoom: false
              }}
            />
          );
        }
      },
      {
        field: "smi",
        headerName: "SMILES",
        filter: true,
        sortable: true,
        editable: true,
        singleClickEdit: true
      },
      {
        field: "label",
        filter: true,
        sortable: true,
        editable: true
      },
      {
        field: "group",
        filter: true,
        sortable: true,
        editable: true
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
        editable: false
      },
      {
        field: "extraInfo",
        filter: true,
        sortable: true,
        editable: true,
        valueGetter: (params: any) => {
          const data = params.data as HorusSmilesType;
          return data.extraInfo ?? "-";
        }
      }
    ];
  }, [onClickEdit, previewSmiles]);

  const [additionalProperties, setAdditionalProperties] = useState<ColDef[]>();

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
        selected: selectedData.includes(s.id)
      };
    });

    window.smiles?.setSmilesList(newSmiles);
  };

  useEffect(() => {
    setTimeout(async () => {
      const properties = getPropertiesSet(availableSmiles);
      const propertiesAsColDef = getPropertiesAsColDef(properties);
      setAdditionalProperties(propertiesAsColDef);
    }, 100);
  }, [availableSmiles]);

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
      source: "rowDataChanged"
    });
  }, [tableRef, availableSmiles]);

  const columnDefs = useMemo(
    () => BASIC_COLDEF.concat(additionalProperties ?? []),
    [BASIC_COLDEF, additionalProperties]
  );

  return (
    <HorusTable
      ref={tableRef}
      columnDefs={columnDefs}
      rows={availableSmiles}
      gridProps={{
        getRowId: (e: any) => e.data.id,
        singleClickEdit: true,
        suppressRowVirtualisation: false,
        suppressColumnVirtualisation: true,
        onSelectionChanged: handleRowSelected,
        suppressPropertyNamesCheck: true,
        rowSelection: "multiple",
        suppressRowClickSelection: true,
        suppressScrollOnNewData: true,
        defaultColDef: {
          cellStyle: {
            display: "flex",
            alignItems: "center "
          }
        },
        onCellEditingStarted: handleRowEditingStarted
      }}
      onCellEdit={editCell}
    ></HorusTable>
  );
}
