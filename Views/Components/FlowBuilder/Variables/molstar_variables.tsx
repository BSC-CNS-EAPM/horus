// React imports
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";

// Mol*
import { Color } from "molstar/lib/mol-util/color";

// Horus components
import AppButton from "../../appbutton";

// Usuful types
import { VariableViewProps } from "./variables";
import {
  AtomInfo,
  MolInfo,
  SphereRef,
  BoxRef,
  MolstarClickEventDetail,
  MolstarEvents,
  isMolstarLoaded,
} from "../../Molstar/HorusWrapper/horusmolstar";
import { SearchComponent } from "@/Components/Search/Search";

// Utilities
function filterStructures(structures: MolInfo[], query?: string) {
  if (!query) {
    return structures;
  }

  return structures.filter(
    (structure) =>
      structure.label.toLowerCase().includes(query.toLowerCase()) ||
      structure.format.toLowerCase().includes(query.toLowerCase())
  );
}

function filterChains(chains: AtomInfo[], query?: string) {
  if (!query) {
    return chains;
  }

  return chains.filter((chain) =>
    chain.name.toLowerCase().includes(query.toLowerCase())
  );
}

function filterStandardResidues(residues: AtomInfo[], query?: string) {
  if (!query) {
    return residues;
  }

  return residues.filter(
    (res) =>
      res.name.toLowerCase().includes(query.toLowerCase()) ||
      res.chainID.includes(query.toLowerCase()) ||
      res.residue.toString().includes(query.toLowerCase())
  );
}

// Custom hooks
function useStructureFilters(
  currentValue: MolInfo[] | MolInfo | null,
  onChange: (value: any) => void
) {
  const [currentFilter, _setCurrentFilter] = useState("");
  const [filteredStructures, setFilteredStructures] = useState<MolInfo[]>([]);

  const setCurrentFilter = (query: string) => {
    _setCurrentFilter(query);
    setFilteredStructures(
      filterStructures(
        isMolstarLoaded(window.molstar)
          ? window.molstar?.listStructures?.()
          : [],
        query
      )
    );
  };

  const refreshStructures = useCallback(() => {
    const currentStructures = isMolstarLoaded(window.molstar)
      ? window.molstar?.listStructures?.()
      : [];

    // If any structure does not exist anymore, remove it from the values of the variable
    if (currentValue) {
      let newValue: MolInfo[] | MolInfo | null = currentValue;

      if (Array.isArray(currentValue)) {
        newValue = currentValue.filter((structure) =>
          currentStructures.find((s) => s.id === structure.id)
        );
      } else {
        newValue =
          currentStructures.find((s) => s.id === currentValue.id) ?? null;
      }

      onChange(newValue);
    }

    setFilteredStructures(filterStructures(currentStructures, currentFilter));
  }, [currentFilter, currentValue, onChange]);

  useEffect(() => {
    // Add event listener for structures
    window.addEventListener(MolstarEvents.STATE, refreshStructures);

    return () => {
      window.removeEventListener(MolstarEvents.STATE, refreshStructures);
    };
  }, [refreshStructures]);

  // Fetch initially the structures
  useEffect(() => {
    setFilteredStructures(
      isMolstarLoaded(window.molstar) ? window?.molstar?.listStructures?.() : []
    );
  }, []);

  return {
    setCurrentFilter,
    filteredStructures,
  };
}

function useChainFilters(
  currentValue: AtomInfo[] | AtomInfo | null,
  onChange: (value: any) => void
) {
  const [currentFilter, _setCurrentFilter] = useState("");
  const [filteredChains, setFilteredChains] = useState<AtomInfo[]>([]);

  const setCurrentFilter = (query: string) => {
    _setCurrentFilter(query);
    setFilteredChains(
      filterChains(
        isMolstarLoaded(window.molstar) ? window?.molstar?.listChains() : [],
        query
      )
    );
  };

  const refreshStructures = useCallback(() => {
    const currentChains = isMolstarLoaded(window.molstar)
      ? window?.molstar?.listChains()
      : [];
    // If any chain does not exist anymore, remove it from the values of the variable
    if (currentValue) {
      let newValue: AtomInfo[] | AtomInfo | null = currentValue;

      if (Array.isArray(currentValue)) {
        newValue = currentValue.filter((chain) =>
          currentChains.find(
            (c) =>
              c.structureID === chain.structureID && c.chainID === chain.chainID
          )
        );
      } else {
        newValue =
          currentChains.find(
            (c) =>
              c.structureID === currentValue.structureID &&
              c.chainID === currentValue.chainID
          ) ?? null;
      }

      onChange(newValue);
    }

    setFilteredChains(filterChains(currentChains, currentFilter));
  }, [currentFilter, currentValue, onChange]);

  useEffect(() => {
    // Add event listener for structures
    window.addEventListener(MolstarEvents.STATE, refreshStructures);

    return () => {
      window.removeEventListener(MolstarEvents.STATE, refreshStructures);
    };
  }, [refreshStructures]);

  // Fetch initially the structures
  useEffect(() => {
    setFilteredChains(
      isMolstarLoaded(window.molstar) ? window?.molstar?.listChains() : []
    );
  }, []);

  return {
    setCurrentFilter,
    filteredChains,
  };
}

function useResidueFilters(
  type: "standard" | "hetero",
  currentValue: AtomInfo[] | AtomInfo | null,
  onChange: (value: any) => void
) {
  const [currentFilter, _setCurrentFilter] = useState("");
  const [filteredResidues, setFilteredResidues] = useState<AtomInfo[]>([]);

  const getItems = (type: "standard" | "hetero"): AtomInfo[] => {
    if (isMolstarLoaded(window.molstar)) {
      if (type === "standard") {
        return window.molstar.listStandardRes();
      }
      if (type === "hetero") {
        return window.molstar.listHeteroRes();
      }
    }

    return [] as AtomInfo[];
  };
  const setCurrentFilter = (query: string) => {
    _setCurrentFilter(query);
    setFilteredResidues(filterStandardResidues(getItems(type), query));
  };

  const refreshStructures = useCallback(() => {
    const currentResidues = getItems(type);

    // If any residue does not exist anymore, remove it from the values of the variable
    if (currentValue) {
      let newValue: AtomInfo[] | AtomInfo | null = currentValue;

      if (Array.isArray(currentValue)) {
        newValue = currentValue.filter((residue) =>
          currentResidues.find(
            (r) =>
              r.structureID === residue.structureID &&
              r.chainID === residue.chainID &&
              r.residue === residue.residue
          )
        );
      } else {
        newValue =
          currentResidues.find(
            (r) =>
              r.structureID === currentValue.structureID &&
              r.chainID === currentValue.chainID &&
              r.residue === currentValue.residue
          ) ?? null;
      }

      onChange(newValue);
    }

    setFilteredResidues(filterStandardResidues(currentResidues, currentFilter));
  }, [currentFilter, currentValue, onChange, type]);

  useEffect(() => {
    // Add event listener for structures
    window.addEventListener(MolstarEvents.STATE, refreshStructures);

    return () => {
      window.removeEventListener(MolstarEvents.STATE, refreshStructures);
    };
  }, [refreshStructures]);

  // Fetch initially the structures
  useEffect(() => {
    setFilteredResidues(getItems(type));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    setCurrentFilter,
    filteredResidues,
  };
}

// Views
export function StructureVariableView(props: VariableViewProps) {
  const { currentValue, onChange } = props;

  const { setCurrentFilter, filteredStructures } = useStructureFilters(
    currentValue,
    onChange
  );

  useEffect(() => {
    // Set the initial structures
    const structures = filterStructures(
      isMolstarLoaded(window.molstar) ? window?.molstar?.listStructures() : []
    );

    if (!currentValue && structures.length > 0) {
      onChange(structures[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="plugin-variable-value">
      <SearchComponent
        placeholder="Search for a structure"
        onChange={(e) => {
          setCurrentFilter(e.target.value);
        }}
        showIcon={false}
      />
      {filteredStructures.length === 0 ? (
        <NotFoundView>No structures</NotFoundView>
      ) : (
        <div className="w-full overflow-auto max-h-28 min-h-12 mt-1">
          {filteredStructures.map((structure) => (
            <SelectSingleStructure
              key={structure.id}
              structure={structure}
              currentValue={props.currentValue}
              onChange={props.onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SelectSingleStructure({
  structure,
  currentValue,
  onChange,
}: {
  structure: MolInfo;
  currentValue: MolInfo | null;
  onChange: (value: MolInfo) => void;
}) {
  return (
    <div
      key={structure.id}
      className="flex flex-row items-center justify-between"
      style={{
        gap: "1rem",
        textAlign: "left",
        paddingInline: "0.25rem",
      }}
    >
      <input
        style={{ width: "1rem" }}
        type="radio"
        checked={currentValue?.id === structure.id}
        onChange={(e) => e.target.checked && onChange(structure)}
      />
      <div className="w-full flex flex-row gap-2 items-center">
        {structure.label}
        <span className="text-xs text-muted">
          - {structure.format.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

export function MultipleStructureVariableView(props: VariableViewProps) {
  const { currentValue, onChange } = props;

  const { setCurrentFilter, filteredStructures } = useStructureFilters(
    currentValue,
    onChange
  );

  useEffect(() => {
    // Set the initial structures
    const structures = filterStructures(
      isMolstarLoaded(window.molstar) ? window?.molstar?.listStructures() : []
    );

    if (!currentValue && structures.length > 0) {
      onChange([structures[0]]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="plugin-variable-value">
      <div className="flex flex-row gap-2 w-full">
        <SearchComponent
          className="w-full"
          placeholder="Search for a structure"
          onChange={(e) => {
            setCurrentFilter(e.target.value);
          }}
          showIcon={false}
        />
        <AppButton
          className="min-w-[40px]"
          action={() => {
            onChange(filteredStructures);
          }}
        >
          All
        </AppButton>
        <AppButton
          className="min-w-[60px]"
          action={() => {
            onChange([]);
          }}
        >
          None
        </AppButton>
      </div>
      {filteredStructures.length === 0 ? (
        <NotFoundView>No structures</NotFoundView>
      ) : (
        <div className="w-full overflow-auto max-h-28 min-h-12">
          {filteredStructures.map((structure) => (
            <SelectMultipleStructures
              key={structure.id}
              structure={structure}
              currentValue={props.currentValue}
              onChange={props.onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SelectMultipleStructures({
  structure,
  currentValue,
  onChange,
}: {
  structure: MolInfo;
  currentValue: MolInfo[] | null;
  onChange: (value: MolInfo[]) => void;
}) {
  return (
    <div
      key={structure.id}
      className="flex flex-row items-center justify-between"
      style={{
        gap: "1rem",
        textAlign: "left",
        paddingInline: "0.25rem",
      }}
    >
      <input
        style={{ width: "1rem" }}
        type="checkbox"
        checked={currentValue?.find((s) => s.id === structure.id) !== undefined}
        onChange={(e) =>
          onChange(
            e.target.checked
              ? [...(currentValue ?? []), structure]
              : (currentValue ?? []).filter(
                  (s: MolInfo) => s.id !== structure.id
                )
          )
        }
      />
      <div className="w-full flex flex-row gap-2 items-center">
        {structure.label}
        <span className="text-xs text-muted">
          - {structure.format.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

export function ChainView(props: VariableViewProps) {
  const { currentValue, onChange } = props;

  const { setCurrentFilter, filteredChains } = useChainFilters(
    currentValue,
    onChange
  );

  useEffect(() => {
    // Set the initial chains
    if (!currentValue && filteredChains.length > 0) {
      onChange([filteredChains[0]]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="plugin-variable-value">
      <div className="flex flex-row gap-2 w-full">
        <SearchComponent
          className="w-full"
          placeholder="Search for a chain"
          onChange={(e) => {
            setCurrentFilter(e.target.value);
          }}
          showIcon={false}
        />
        <AppButton
          className="min-w-[40px]"
          action={() => {
            onChange(filteredChains);
          }}
        >
          All
        </AppButton>
        <AppButton
          className="min-w-[60px]"
          action={() => {
            onChange([]);
          }}
        >
          None
        </AppButton>
      </div>
      {filteredChains.length === 0 ? (
        <NotFoundView>No chains</NotFoundView>
      ) : (
        <div className="w-full overflow-auto max-h-28 min-h-12 mt-1">
          {filteredChains.map((chain) => (
            <SelectMultipleChains
              key={chain.structureID + chain.chainID}
              chain={chain}
              currentValue={props.currentValue}
              onChange={props.onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SelectMultipleChains({
  chain,
  currentValue,
  onChange,
}: {
  chain: AtomInfo;
  currentValue: AtomInfo[] | null;
  onChange: (value: AtomInfo[]) => void;
}) {
  return (
    <div
      key={chain.structureID}
      className="flex flex-row items-center justify-between"
      style={{
        gap: "1rem",
        textAlign: "left",
        paddingInline: "0.25rem",
      }}
    >
      <input
        style={{ width: "1rem" }}
        type="checkbox"
        checked={
          currentValue?.find((c) => {
            return (
              c.structureID === chain.structureID && c.chainID === chain.chainID
            );
          }) !== undefined
        }
        onChange={(e) => {
          const newValue = e.target.checked
            ? [...(currentValue ?? []), chain]
            : (currentValue ?? []).filter(
                (c: AtomInfo) =>
                  !(
                    c.structureID === chain.structureID &&
                    c.chainID === chain.chainID
                  )
              );
          onChange(newValue);
        }}
      />
      <div className="w-full grid grid-cols-[2rem,2fr] gap-2 items-center">
        <span>{chain.chainID}</span>
        <span>{chain.label}</span>
      </div>
    </div>
  );
}

export function StandardResView(props: VariableViewProps) {
  const { currentValue, onChange } = props;

  const { setCurrentFilter, filteredResidues } = useResidueFilters(
    "standard",
    currentValue,
    onChange
  );

  useEffect(() => {
    if (!currentValue && filteredResidues.length > 0) {
      onChange([filteredResidues[0]]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="plugin-variable-value">
      <div className="flex flex-row gap-2 w-full">
        <SearchComponent
          className="w-full"
          placeholder="Search for a residue"
          onChange={(e) => {
            setCurrentFilter(e.target.value);
          }}
          showIcon={false}
        />
        <AppButton
          className="min-w-[40px]"
          action={() => {
            onChange(filteredResidues);
          }}
        >
          All
        </AppButton>
        <AppButton
          className="min-w-[60px]"
          action={() => {
            onChange([]);
          }}
        >
          None
        </AppButton>
      </div>
      {filteredResidues.length === 0 ? (
        <NotFoundView>No standard residues</NotFoundView>
      ) : (
        <div className="w-full overflow-auto max-h-28 min-h-12 mt-1">
          {filteredResidues.map((residue) => (
            <SelectMultipleResidues
              key={residue.structureID + residue.chainID + residue.residue}
              residue={residue}
              currentValue={props.currentValue}
              onChange={props.onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function HeteroResView(props: VariableViewProps) {
  const { currentValue, onChange } = props;

  const { setCurrentFilter, filteredResidues } = useResidueFilters(
    "hetero",
    currentValue,
    onChange
  );

  useEffect(() => {
    // Set the initial residues
    if (!currentValue && filteredResidues.length > 0) {
      onChange([filteredResidues[0]]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="plugin-variable-value">
      <div className="flex flex-row gap-2 w-full">
        <SearchComponent
          className="w-full"
          placeholder="Search for a residue"
          onChange={(e) => {
            setCurrentFilter(e.target.value);
          }}
          showIcon={false}
        />
        <AppButton
          className="min-w-[40px]"
          action={() => {
            onChange(filteredResidues);
          }}
        >
          All
        </AppButton>
        <AppButton
          className="min-w-[60px]"
          action={() => {
            onChange([]);
          }}
        >
          None
        </AppButton>
      </div>
      {filteredResidues.length === 0 ? (
        <NotFoundView>No hetero residues</NotFoundView>
      ) : (
        <div className="w-full overflow-auto max-h-28 min-h-12 mt-1">
          {filteredResidues.map((residue) => (
            <SelectMultipleResidues
              key={residue.structureID + residue.chainID + residue.residue}
              residue={residue}
              currentValue={props.currentValue}
              onChange={props.onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SelectMultipleResidues({
  residue,
  currentValue,
  onChange,
}: {
  residue: AtomInfo;
  currentValue: AtomInfo[] | null;
  onChange: (value: AtomInfo[]) => void;
}) {
  return (
    <div
      key={residue.structureID}
      className="flex flex-row items-center justify-between"
      style={{
        gap: "1rem",
        textAlign: "left",
        paddingInline: "0.25rem",
      }}
    >
      <input
        style={{ width: "1rem" }}
        type="checkbox"
        checked={
          currentValue?.find((r) => {
            return (
              r.structureID === residue.structureID &&
              r.residue === residue.residue &&
              r.chainID === residue.chainID
            );
          }) !== undefined
        }
        onChange={(e) =>
          onChange(
            e.target.checked
              ? [...(currentValue ?? []), residue]
              : (currentValue || []).filter(
                  (r: AtomInfo) =>
                    !(
                      r.structureID === residue.structureID &&
                      r.residue === residue.residue &&
                      r.chainID === residue.chainID
                    )
                )
          )
        }
      />
      <div className="w-full grid grid-cols-[2rem,2rem,2rem,2fr] gap-2 items-center">
        <span className="col-span-1">{residue.chainID}</span>
        <span className="col-span-1">{residue.residue}</span>
        <span className="col-span-1">{residue.auth_comp_id}</span>
        <span className="col-span-1">{residue.label}</span>
      </div>
    </div>
  );
}

export function ResidueView(props: VariableViewProps) {
  const { currentValue, onChange } = props;

  const [residue, setResidue] = useState<AtomInfo | null>(null);
  const [active, setActive] = useState(false);

  const handleResidueClick = (e: any) => {
    const atomInfo = (e.detail as MolstarClickEventDetail).atom;
    setResidue(atomInfo);
    onChange(atomInfo);
    // Deselect all residues once one is selected, because we only want to select one at a time
    if (isMolstarLoaded(window.molstar)) {
      window.molstar?.plugin?.managers.interactivity.lociSelects.deselectAll();
    }
  };

  useEffect(() => {
    if (isMolstarLoaded(window.molstar)) {
      window.molstar.plugin!.selectionMode = active;
      // Set the granularity to element
      window.molstar.plugin!.managers.interactivity.setProps({
        granularity: "residue",
      });
      // Unselect selected residues
      window.molstar.plugin!.managers.interactivity.lociSelects.deselectAll();
    }

    if (active) {
      window.addEventListener(MolstarEvents.COORDINATES, handleResidueClick);
    }

    return () => {
      window.removeEventListener(MolstarEvents.COORDINATES, handleResidueClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (currentValue) {
      setResidue(currentValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      onClick={() => setActive(!active)}
      className={`w-full h-full max-h-28 overflow-auto border-2 rounded-xl ${
        active && "bg-green-200 border-green-200"
      }`}
    >
      {!residue ? (
        <div className="text-center cut-text">
          Click here to enable selection
        </div>
      ) : (
        <div className="text-center cut-text px-2 max-w-[200px] m-auto">
          {residue.chainID}:{residue.auth_comp_id}:{residue.residue} -{" "}
          {residue.label}
        </div>
      )}
    </div>
  );
}

export function AtomView(props: VariableViewProps) {
  const { currentValue, onChange } = props;

  const [atom, setAtom] = useState<AtomInfo | null>(null);
  const [active, setActive] = useState<boolean>(false);

  const handleAtomClick = (e: any) => {
    const atomInfo = (e.detail as MolstarClickEventDetail).atom;
    setAtom(atomInfo);
    onChange(atomInfo);
    // Deselect all atoms once one is selected, because we only want to select one at a time
    if (isMolstarLoaded(window.molstar)) {
      window.molstar?.plugin?.managers.interactivity.lociSelects.deselectAll();
    }
  };

  useEffect(() => {
    if (isMolstarLoaded(window.molstar)) {
      window.molstar.plugin!.selectionMode = active;
      // Set the granularity to element
      window.molstar.plugin!.managers.interactivity.setProps({
        granularity: "element",
      });
      // Unselect selected residues
      window.molstar.plugin!.managers.interactivity.lociSelects.deselectAll();
    }

    if (active) {
      window.addEventListener(MolstarEvents.COORDINATES, handleAtomClick);
    }

    return () => {
      window.removeEventListener(MolstarEvents.COORDINATES, handleAtomClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (currentValue) {
      setAtom(currentValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      onClick={() => setActive(!active)}
      className={`w-full h-full max-h-28 overflow-auto border-2 rounded-xl ${
        active && "bg-green-200 border-green-200"
      }`}
    >
      {!atom ? (
        <div className="text-center px-1 cut-text">
          Click here to enable selection
        </div>
      ) : (
        <div className="text-center px-1 cut-text max-w-[200px] m-auto">
          {atom.auth_atom_id}:{atom.atom_index} - {atom.chainID}:
          {atom.auth_comp_id}:{atom.residue} - {atom.label}
        </div>
      )}
    </div>
  );
}
export function BoxVariableView(props: VariableViewProps) {
  const { currentValue, variable, onChange } = props;

  const boxRef = useRef<BoxRef | null>(currentValue?.ref ?? null);

  const [active, setActive] = useState(false);
  const [activeColor, setActiveColor] = useState(
    boxRef.current ? Color.toHexStyle(boxRef.current.color) : "#a5d6a7"
  );
  const mounted = useRef(false);

  const handleChange = useCallback(
    async (
      metrics: {
        x0: number | string;
        y0: number | string;
        z0: number | string;
        x1: number | string;
        y1: number | string;
        z1: number | string;
        x2: number | string;
        y2: number | string;
        z2: number | string;
        x3: number | string;
        y3: number | string;
        z3: number | string;
      },
      radiusScale: number | string,
      radialSegments: number | string
    ) => {
      const parsedBoxNumbers = {
        x0: Number(metrics.x0),
        y0: Number(metrics.y0),
        z0: Number(metrics.z0),
        x1: Number(metrics.x1),
        y1: Number(metrics.y1),
        z1: Number(metrics.z1),
        x2: Number(metrics.x2),
        y2: Number(metrics.y2),
        z2: Number(metrics.z2),
        x3: Number(metrics.x3),
        y3: Number(metrics.y3),
        z3: Number(metrics.z3),
      };

      let ref = null;
      if (isMolstarLoaded(window.molstar)) {
        const molstar = window.molstar;

        if (mounted.current) {
          ref = await molstar.addBox(
            parsedBoxNumbers,
            Number(radiusScale),
            Number(radialSegments),
            1,
            undefined,
            boxRef.current ?? undefined
          );

          boxRef.current = ref;

          setActiveColor(Color.toHexStyle(ref.color));
          window.molstar?.plugin?.managers.interactivity.lociSelects.deselectAll();
        }
      }

      const boxData = {
        metrics: {
          x0: metrics.x0,
          y0: metrics.y0,
          z0: metrics.z0,
          x1: metrics.x1,
          y1: metrics.y1,
          z1: metrics.z1,
          x2: metrics.x2,
          y2: metrics.y2,
          z2: metrics.z2,
          x3: metrics.x3,
          y3: metrics.y3,
          z3: metrics.z3,
        },
        radiusScale: radiusScale,
        radialSegments: radialSegments,
        ref: ref,
      };

      onChange(boxData);
    },
    [onChange]
  );

  // When unmounting, remove the box
  useEffect(() => {
    return () => {
      if (isMolstarLoaded(window.molstar) && boxRef?.current?.ref) {
        window.molstar.removeShape(boxRef.current.ref);
      }
    };
  }, []);

  const handleCoordinates = useCallback(
    (e: Event) => {
      if (active) {
        const data = (e as CustomEvent).detail;
        handleChange(
          {
            x0: data.x,
            y0: data.y,
            z0: data.z,
            x1: currentValue.metrics.x1,
            y1: currentValue.metrics.y1,
            z1: currentValue.metrics.z1,
            x2: currentValue.metrics.x2,
            y2: currentValue.metrics.y2,
            z2: currentValue.metrics.z2,
            x3: currentValue.metrics.x3,
            y3: currentValue.metrics.y3,
            z3: currentValue.metrics.z3,
          },
          currentValue?.radiusScale ?? 10,
          currentValue?.radialSegments ?? 2
        );
      }
    },
    [active, currentValue, handleChange]
  );

  // Place the box in the center of the screen
  useEffect(() => {
    if (isMolstarLoaded(window.molstar)) {
      window.molstar.plugin!.selectionMode = active;
      // Unselect selected residues
      window.molstar.plugin!.managers.interactivity.lociSelects.deselectAll();
    }

    // Listen for the MolstarEvents.COORDINATES event
    window.addEventListener(MolstarEvents.COORDINATES, handleCoordinates);
    return () => {
      window.removeEventListener(MolstarEvents.COORDINATES, handleCoordinates);
    };
  }, [active, handleCoordinates]);

  const handleNewlyPlaced = useCallback(async () => {
    const boxData: any = {
      metrics: {
        x0: 0,
        y0: 0,
        z0: 0,
        x1: 5,
        y1: 0,
        z1: 0,
        x2: 0,
        y2: 5,
        z2: 0,
        x3: 0,
        y3: 0,
        z3: 5,
      },
      radiusScale: 5,
      radialSegments: 2,
      ref: null,
    };

    if (isMolstarLoaded(window.molstar)) {
      const ref = await window.molstar.addBox(
        boxData.metrics,
        boxData.radius,
        0.3,
        undefined,
        undefined
      );
      boxRef.current = ref;
      setActiveColor(Color.toHexStyle(ref.color));

      boxData.ref = ref;
    }

    onChange(boxData);
  }, [onChange]);

  useEffect(() => {
    // Set the initial value in case it's not set
    if (!currentValue && !mounted.current) {
      handleNewlyPlaced();
    }
    mounted.current = true;
  });

  return (
    <div
      className="flex flex-col p-2 gap-2"
      style={{
        padding: "0 !important",
      }}
    >
      <div className="flex flex-row gap-2">
        <div className="flex flex-row gap-2">
          <span
            className="font-semibold"
            style={{
              color: "darkgray",
            }}
          >
            X:
          </span>
          <input
            id={`${variable.id}-x`}
            className="plugin-variable-value text-black"
            value={currentValue?.metrics?.x0 ?? ""}
            onChange={(e) => {
              handleChange(
                {
                  // CHANGE
                  x0: parseNumberOrNegative(e.target.value),

                  //UNCHANGED

                  y0: currentValue.metrics.y0,
                  z0: currentValue.metrics.z0,
                  y1: currentValue.metrics.y1,
                  x1: currentValue.metrics.x1,
                  z1: currentValue.metrics.z1,
                  x2: currentValue.metrics.x2,
                  y2: currentValue.metrics.y2,
                  z2: currentValue.metrics.z2,
                  x3: currentValue.metrics.x3,
                  y3: currentValue.metrics.y3,
                  z3: currentValue.metrics.z3,
                },
                currentValue.radiusScale,
                currentValue.radialSegments
              );
            }}
          />
        </div>
        <div className="flex flex-row gap-2">
          <span
            className="font-semibold"
            style={{
              color: "darkgray",
            }}
          >
            Y:
          </span>
          <input
            id={`${variable.id}-y`}
            className="plugin-variable-value text-black"
            value={currentValue?.metrics?.y0 ?? 0}
            onChange={(e) => {
              handleChange(
                {
                  // CHANGE
                  y0: parseNumberOrNegative(e.target.value),

                  //UNCHANGED

                  x0: currentValue.metrics.x0,
                  z0: currentValue.metrics.z0,
                  x1: currentValue.metrics.x1,
                  y1: currentValue.metrics.y1,
                  z1: currentValue.metrics.z1,
                  x2: currentValue.metrics.x2,
                  y2: currentValue.metrics.y2,
                  z2: currentValue.metrics.z2,
                  x3: currentValue.metrics.x3,
                  y3: currentValue.metrics.y3,
                  z3: currentValue.metrics.z3,
                },
                currentValue.radiusScale,
                currentValue.radialSegments
              );
            }}
          />
        </div>
        <div className="flex flex-row gap-2">
          <span
            className="font-semibold"
            style={{
              color: "darkgray",
            }}
          >
            Z:
          </span>
          <input
            id={`${variable.id}-z`}
            className="plugin-variable-value text-black"
            value={currentValue?.metrics?.z0 ?? 0}
            onChange={(e) => {
              handleChange(
                {
                  // CHANGE
                  z0: parseNumberOrNegative(e.target.value),

                  //UNCHANGED

                  x0: currentValue.metrics.x0,
                  y0: currentValue.metrics.y0,
                  x1: currentValue.metrics.x1,
                  y1: currentValue.metrics.y1,
                  z1: currentValue.metrics.z1,
                  x2: currentValue.metrics.x2,
                  y2: currentValue.metrics.y2,
                  z2: currentValue.metrics.z2,
                  x3: currentValue.metrics.x3,
                  y3: currentValue.metrics.y3,
                  z3: currentValue.metrics.z3,
                },
                currentValue.radiusScale,
                currentValue.radialSegments
              );
            }}
          />
        </div>
      </div>
      <div className="flex flex-row gap-2">
        <div className="flex flex-row gap-2">
          <span
            className="font-semibold"
            style={{
              color: "darkgray",
            }}
          >
            A:
          </span>
          <input
            id={`${variable.id}-x`}
            className="plugin-variable-value text-black"
            value={currentValue?.metrics?.x1 ?? ""}
            onChange={(e) => {
              handleChange(
                {
                  // CHANGE
                  x1: parseNumberOrNegative(e.target.value),

                  //UNCHANGED

                  x0: currentValue.metrics.x0,
                  y0: currentValue.metrics.y0,
                  z0: currentValue.metrics.z0,
                  y1: currentValue.metrics.y1,
                  z1: currentValue.metrics.z1,
                  x2: currentValue.metrics.x2,
                  y2: currentValue.metrics.y2,
                  z2: currentValue.metrics.z2,
                  x3: currentValue.metrics.x3,
                  y3: currentValue.metrics.y3,
                  z3: currentValue.metrics.z3,
                },
                currentValue.radiusScale,
                currentValue.radialSegments
              );
            }}
          />
        </div>
        <div className="flex flex-row gap-2">
          <span
            className="font-semibold"
            style={{
              color: "darkgray",
            }}
          >
            B:
          </span>
          <input
            id={`${variable.id}-y`}
            className="plugin-variable-value text-black"
            value={currentValue?.metrics?.y2 ?? 0}
            onChange={(e) => {
              handleChange(
                {
                  // CHANGE
                  y2: parseNumberOrNegative(e.target.value),

                  //UNCHANGED

                  x0: currentValue.metrics.x0,
                  y0: currentValue.metrics.y0,
                  z0: currentValue.metrics.z0,
                  x1: currentValue.metrics.x1,
                  y1: currentValue.metrics.y1,
                  z1: currentValue.metrics.z1,
                  x2: currentValue.metrics.x2,
                  z2: currentValue.metrics.z2,
                  x3: currentValue.metrics.x3,
                  y3: currentValue.metrics.y3,
                  z3: currentValue.metrics.z3,
                },
                currentValue.radiusScale,
                currentValue.radialSegments
              );
            }}
          />
        </div>
        <div className="flex flex-row gap-2">
          <span
            className="font-semibold"
            style={{
              color: "darkgray",
            }}
          >
            C:
          </span>
          <input
            id={`${variable.id}-z`}
            className="plugin-variable-value text-black"
            value={currentValue?.metrics?.z3 ?? 0}
            onChange={(e) => {
              handleChange(
                {
                  // CHANGE
                  z3: parseNumberOrNegative(e.target.value),

                  //UNCHANGED

                  x0: currentValue.metrics.x0,
                  y0: currentValue.metrics.y0,
                  z0: currentValue.metrics.z0,
                  x1: currentValue.metrics.x1,
                  y1: currentValue.metrics.y1,
                  z1: currentValue.metrics.z1,
                  x2: currentValue.metrics.x2,
                  y2: currentValue.metrics.y2,
                  z2: currentValue.metrics.z2,
                  x3: currentValue.metrics.x3,
                  y3: currentValue.metrics.y3,
                },
                currentValue.radiusScale,
                currentValue.radialSegments
              );
            }}
          />
        </div>
      </div>

      <div
        onClick={() => setActive(!active)}
        className={`w-full h-full max-h-28 overflow-auto border-2 rounded-xl ${
          active && "bg-green-200 border-green-200"
        }`}
      >
        {active ? (
          <div className="text-center px-1 cut-text">Click on Mol*</div>
        ) : (
          <div className="text-center px-1 cut-text">
            {boxRef.current ? (
              <div className="flex flex-row items-center justify-center gap-2">
                Placed box
                <div
                  className="w-4 h-4 rounded-full"
                  style={{
                    backgroundColor: activeColor,
                  }}
                ></div>
              </div>
            ) : (
              "Enable Mol* selection"
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function SphereVariableView(props: VariableViewProps) {
  const { currentValue, variable, onChange } = props;

  const sphereRef = useRef<SphereRef | null>(currentValue?.ref ?? null);

  const [active, setActive] = useState(false);
  const [activeColor, setActiveColor] = useState(
    sphereRef.current ? Color.toHexStyle(sphereRef.current.color) : "#a5d6a7"
  );
  const mounted = useRef(false);

  const handleChange = useCallback(
    async (
      position: {
        x: number | string;
        y: number | string;
        z: number | string;
      },
      radius: number | string
    ) => {
      const parsedSphereNumbers = {
        x: Number(position.x),
        y: Number(position.y),
        z: Number(position.z),
      };

      let ref = null;
      if (isMolstarLoaded(window.molstar)) {
        const molstar = window.molstar;
        if (mounted.current) {
          ref = await molstar.addSphere(
            parsedSphereNumbers,
            Number(radius),
            0.3,
            undefined,
            sphereRef.current ?? undefined
          );
          setActiveColor(Color.toHexStyle(ref.color));
          sphereRef.current = ref;
          window.molstar?.plugin?.managers.interactivity.lociSelects.deselectAll();
        }
      }

      const sphereData = {
        center: {
          x: position.x,
          y: position.y,
          z: position.z,
        },
        radius: radius,
        ref: ref,
      };

      onChange(sphereData);
    },
    [onChange]
  );

  // When unmounting, remove the sphere
  useEffect(() => {
    return () => {
      if (isMolstarLoaded(window.molstar) && sphereRef?.current?.ref) {
        window.molstar.removeShape(sphereRef.current.ref);
      }
    };
  }, []);

  const handleCoordinates = useCallback(
    (e: Event) => {
      if (active) {
        const data = (e as CustomEvent).detail;

        handleChange(
          {
            x: data.x,
            y: data.y,
            z: data.z,
          },
          currentValue?.radius ?? 10
        );
      }
    },
    [active, currentValue, handleChange]
  );

  // Place the sphere in the center of the screen
  useEffect(() => {
    if (isMolstarLoaded(window.molstar)) {
      window.molstar.plugin!.selectionMode = active;
      // Unselect selected residues
      window.molstar.plugin!.managers.interactivity.lociSelects.deselectAll();
    }

    // Listen for the MolstarEvents.COORDINATES event
    window.addEventListener(MolstarEvents.COORDINATES, handleCoordinates);
    return () => {
      window.removeEventListener(MolstarEvents.COORDINATES, handleCoordinates);
    };
  }, [active, handleCoordinates]);

  const handleNewlyPlaced = useCallback(async () => {
    const sphereData: any = {
      center: {
        x: 0,
        y: 0,
        z: 0,
      },
      radius: 10,
      ref: null,
    };

    if (isMolstarLoaded(window.molstar)) {
      const ref = await window.molstar.addSphere(
        sphereData.center,
        sphereData.radius,
        0.3,
        undefined,
        undefined
      );
      sphereRef.current = ref;
      setActiveColor(Color.toHexStyle(ref.color));

      sphereData.ref = ref;
    }

    onChange(sphereData);
  }, [onChange]);

  useEffect(() => {
    // Set the initial value in case it's not set
    if (!currentValue && !mounted.current) {
      handleNewlyPlaced();
    }
    mounted.current = true;
  });

  return (
    <div
      className="flex flex-col p-2 gap-2"
      style={{
        padding: "0 !important",
      }}
    >
      <div className="flex flex-row gap-2">
        <div className="flex flex-row gap-2">
          <span
            className="font-semibold"
            style={{
              color: "darkgray",
            }}
          >
            X:
          </span>
          <input
            id={`${variable.id}-x`}
            className="plugin-variable-value text-black"
            value={currentValue?.center?.x ?? ""}
            onChange={(e) => {
              handleChange(
                {
                  x: parseNumberOrNegative(e.target.value),
                  y: currentValue.center.y,
                  z: currentValue.center.z,
                },
                currentValue.radius
              );
            }}
          />
        </div>
        <div className="flex flex-row gap-2">
          <span
            className="font-semibold"
            style={{
              color: "darkgray",
            }}
          >
            Y:
          </span>
          <input
            id={`${variable.id}-y`}
            className="plugin-variable-value text-black"
            value={currentValue?.center?.y ?? 0}
            onChange={(e) => {
              handleChange(
                {
                  x: currentValue.center.x,
                  y: parseNumberOrNegative(e.target.value),
                  z: currentValue.center.z,
                },
                currentValue.radius
              );
            }}
          />
        </div>
        <div className="flex flex-row gap-2">
          <span
            className="font-semibold"
            style={{
              color: "darkgray",
            }}
          >
            Z:
          </span>
          <input
            id={`${variable.id}-z`}
            className="plugin-variable-value text-black"
            value={currentValue?.center?.z ?? 0}
            onChange={(e) => {
              handleChange(
                {
                  x: currentValue.center.x,
                  y: currentValue.center.y,
                  z: parseNumberOrNegative(e.target.value),
                },
                currentValue.radius
              );
            }}
          />
        </div>
        <div className="flex flex-row gap-2">
          <span
            className="font-semibold"
            style={{
              color: "darkgray",
            }}
          >
            R:
          </span>
          <input
            id={`${variable.id}-radius`}
            className="plugin-variable-value text-black"
            value={currentValue?.radius ?? ""}
            onChange={(e) => {
              const newRadius = parseNumberOrNegative(e.target.value);
              handleChange(
                {
                  x: currentValue.center.x,
                  y: currentValue.center.y,
                  z: currentValue.center.z,
                },
                newRadius
              );
            }}
          />
        </div>
      </div>
      <div
        onClick={() => setActive(!active)}
        className={`w-full h-full max-h-28 overflow-auto border-2 rounded-xl ${
          active && "bg-green-200 border-green-200"
        }`}
      >
        {active ? (
          <div className="text-center px-1 cut-text">Click on Mol*</div>
        ) : (
          <div className="text-center px-1 cut-text">
            {sphereRef.current ? (
              <div className="flex flex-row items-center justify-center gap-2">
                Click to enable Mol* selection
                <div
                  className="w-4 h-4 rounded-full"
                  style={{
                    backgroundColor: activeColor,
                  }}
                ></div>
              </div>
            ) : (
              "Enable Mol* selection"
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function NotFoundView(props: { children: ReactNode }) {
  return (
    <div
      role="placeholder"
      className="text-center pt-2"
      style={{
        color: "darkgray",
      }}
    >
      {props.children}
    </div>
  );
}

function parseNumberOrNegative(value: string) {
  // If the field is empty, return "",
  // if the value is "-", return "-",
  // if the value is a number, return the number
  // If the value does not qualify for a number (contains characters), return ""
  // Allow also for decimals

  if (value === "") {
    return "";
  }

  if (value === "-") {
    return "-";
  }

  // If the last character is a dot, return the value
  if (value[value.length - 1] === ".") {
    return value;
  }

  const parsedValue = Number(value);

  if (isNaN(parsedValue)) {
    return "";
  } else {
    return parsedValue;
  }
}
