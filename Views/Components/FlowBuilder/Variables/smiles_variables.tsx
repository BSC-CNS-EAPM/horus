import { useCallback, useContext, useEffect, useState } from "react";
import { VariableViewProps } from "./variables";
import {
  HorusSmilesType,
  SmilesEvents,
} from "../../Smiles/SmilesWrapper/horusSmiles";
import { NotFoundView } from "./molstar_variables";
import AppButton from "../../appbutton";
import { BreakLongUnderscoreNames } from "../Blocks/block.view";
import { SearchComponent } from "@/Components/Search/Search";
import {
  addPanel,
  DockContext,
  PANEL_REGISTRY,
} from "@/Components/MainApp/PanelView";

function filterSmiles(structures: HorusSmilesType[], query?: string) {
  if (!query) {
    return structures;
  }

  return structures.filter(
    (structure) =>
      structure.label.toLowerCase().includes(query.toLowerCase()) ||
      structure.group?.toLowerCase().includes(query.toLowerCase()),
  );
}

function useSmilesFilter() {
  const [currentFilter, _setCurrentFilter] = useState("");
  const [filteredSmiles, setFilteredSmiles] = useState<HorusSmilesType[]>([]);

  const setCurrentFilter = (query: string) => {
    _setCurrentFilter(query);
    setFilteredSmiles(
      filterSmiles(window.smiles?.getSmilesList() ?? [], query),
    );
  };

  const refreshStructures = useCallback(() => {
    setFilteredSmiles(
      filterSmiles(window.smiles?.getSmilesList() ?? [], currentFilter),
    );
  }, [currentFilter]);

  useEffect(() => {
    // Add event listener for structures
    window.addEventListener(SmilesEvents.STATE, refreshStructures);

    return () => {
      window.removeEventListener(SmilesEvents.STATE, refreshStructures);
    };
  }, [refreshStructures]);

  // Fetch initially the structures
  useEffect(() => {
    setFilteredSmiles(window.smiles?.getSmilesList() ?? []);
  }, []);

  return {
    setCurrentFilter,
    filteredStructures: filteredSmiles,
  };
}

export function SmilesVariableView(props: VariableViewProps) {
  const dockContext = useContext(DockContext);

  const { setCurrentFilter, filteredStructures } = useSmilesFilter();

  const [usingSelectedSmiles, setUsingSelectedSmiles] = useState(false);

  // If the smiles state got updated, update also the current value if the smiles was selected
  useEffect(() => {
    const updateOnEvent = () => {
      if (usingSelectedSmiles) {
        props.onChange(window.smiles?.getSelectedSmiles());
        return;
      }

      if (props.currentValue) {
        const currentSelected = props.currentValue.flatMap(
          (s: HorusSmilesType) => s.id,
        );

        if (!window.smiles) {
          return;
        }

        const selectedAndUpdated = window.smiles
          .getSmilesList()
          .filter((s) => currentSelected.includes(s.id));

        props.onChange(selectedAndUpdated);
      }
    };

    window.addEventListener(SmilesEvents.STATE, updateOnEvent);

    return () => {
      window.removeEventListener(SmilesEvents.STATE, updateOnEvent);
    };
  }, [props, usingSelectedSmiles]);

  return (
    <div className="plugin-variable-value min-h-[60px]">
      <div className="flex flex-row gap-2 w-full justify-center">
        {!usingSelectedSmiles && (
          <>
            <SearchComponent
              className="w-full"
              placeholder="Search..."
              onChange={(e) => {
                setCurrentFilter(e.target.value);
              }}
              showIcon={false}
            />
            <AppButton
              action={() => {
                props.onChange(filteredStructures);
              }}
            >
              All
            </AppButton>
            <AppButton
              action={() => {
                props.onChange(null);
              }}
            >
              None
            </AppButton>
          </>
        )}
        <AppButton
          action={() => {
            if (usingSelectedSmiles) {
              props.onChange(null);
            } else {
              props.onChange(filteredStructures);
            }
            setUsingSelectedSmiles(!usingSelectedSmiles);
          }}
        >
          {usingSelectedSmiles ? "Select manually" : "From viewer"}
        </AppButton>
        {usingSelectedSmiles && (
          <AppButton
            action={() => {
              addPanel({
                dockApi: dockContext.dockApi,
                component: PANEL_REGISTRY.smiles.component,
                panelID: PANEL_REGISTRY.smiles.id,
              });
            }}
          >
            Open SMILES viewer
          </AppButton>
        )}
      </div>
      {usingSelectedSmiles ? (
        <div className="w-full grid place-items-center plugin-variable-name text-center mt-2">
          Using {window.smiles?.getSelectedSmiles().length} selected SMILES.
          Modify the selection in the Smiles viewer.
        </div>
      ) : filteredStructures.length === 0 ? (
        <NotFoundView>No SMILES</NotFoundView>
      ) : (
        <div className="w-full overflow-auto max-h-28 min-h-12 mt-1">
          {filteredStructures.map((smiles) => (
            <SelectMultipleSmiles
              key={smiles.id}
              smiles={smiles}
              currentValue={props.currentValue}
              onChange={props.onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SelectMultipleSmiles({
  smiles,
  currentValue,
  onChange,
}: {
  smiles: HorusSmilesType;
  currentValue: HorusSmilesType[] | null;
  onChange: (value: HorusSmilesType[]) => void;
}) {
  return (
    <div
      key={smiles.id}
      className="flex flex-row items-center justify-between"
      style={{
        gap: "1rem",
        textAlign: "left",
        paddingInline: "0.5rem",
      }}
    >
      <input
        id={smiles.id}
        style={{ width: "1rem" }}
        type="checkbox"
        checked={currentValue?.find((s) => s.id === smiles.id) !== undefined}
        onChange={(e) =>
          onChange(
            e.target.checked
              ? [...(currentValue ?? []), smiles]
              : (currentValue ?? []).filter(
                  (s: HorusSmilesType) => s.id !== smiles.id,
                ),
          )
        }
      />
      <span className="w-full text-ellipsis">
        <BreakLongUnderscoreNames name={smiles.label} />
        {smiles.group && (
          <span className="text-xs text-muted">
            {" "}
            - <BreakLongUnderscoreNames name={smiles.group} />
          </span>
        )}
      </span>
    </div>
  );
}
