import { ReactNode, useEffect, useRef, useState } from "react";

import "react-virtualized/styles.css";

import AutoSizer from "react-virtualized/dist/commonjs/AutoSizer";
import List from "react-virtualized/dist/commonjs/List";

import AppButton from "../appbutton";
import { useAlert } from "../HorusPrompt/horus_alert";
import { usePrompt } from "../HorusPrompt/horus_prompt";
import { HorusModal } from "../reusable";
import RotatingLines from "../RotatingLines/rotatinglines";
import SidebarView from "../SidebarView/sidebar_view";
import CenterView from "../Toolbar/Icons/CenterView";
import EyeIcon from "../Toolbar/Icons/Eye";
import LogFile from "../Toolbar/Icons/LogFile";
import MolStarIcon from "../Toolbar/Icons/MolStar";
import SaveIcon from "../Toolbar/Icons/Save";
import { ToolbarMenu, ToolBarMenuProps } from "../Toolbar/toolbar";
import { SmilesView } from "./SmilesComponent";
import { SmilesList } from "./SmilesList";
import { HorusSmilesType, SmilesEvents } from "./SmilesWrapper/horusSmiles";

const SMILES_GRID_WIDTH = 200;
const SMILES_GRID_HEIGTH = 150;

type ViewMode = "list" | "grid";

export const CannotEdit3D =
  "This SMILES comes from a 3D structure. It cannot be modified from here. Use the Mol* panel to remove / edit it. In order to manipulate a SMILES coming from a structure, first duplicate it using the 'Selection' > 'Duplicate selected' tool.";

export function SmilesGrid() {
  const [availableSmiles, setAvailableSmiles] = useState<HorusSmilesType[]>([]);
  const [editingSmiles, setEditingSmiles] = useState<HorusSmilesType | null>(
    null
  );
  const [loadingFile, setLoadingFile] = useState<boolean>(false);
  const [currentGroup, setCurrentGroup] = useState<string | undefined>();

  useEffect(() => {
    const updateAvailableSmilesEventListener = () => {
      const availableSmiles = window.smiles?.getSmilesList();

      if (!availableSmiles) {
        return;
      }

      setAvailableSmiles(availableSmiles);
    };

    // Add an evenet listener
    window.addEventListener(
      SmilesEvents.STATE,
      updateAvailableSmilesEventListener
    );

    return () => {
      window.removeEventListener(
        SmilesEvents.STATE,
        updateAvailableSmilesEventListener
      );
    };
  }, []);

  const updateExistingSmiles = (newSmiles: HorusSmilesType) => {
    window.smiles?.setSmilesList(
      window.smiles?.getSmilesList().map((s) => {
        if (s.id === newSmiles.id) {
          return newSmiles;
        }
        return s;
      })
    );
  };

  const [isHoveringFile, setIsHoveringFile] = useState(false);

  const horusAlert = useAlert();

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    setIsHoveringFile(false);
    setLoadingFile(true);

    e.preventDefault();

    try {
      await window.smiles?.loadFiles(e.dataTransfer.files);
    } catch (error) {
      // @ts-ignore
      await horusAlert(error);
    } finally {
      setLoadingFile(false);
      handleDragEnd(e);
    }
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsHoveringFile(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsHoveringFile(true);
  };

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [previewSmiles, setPreviewSmiles] = useState<boolean>(true);
  const [alertShownAtLeastOnce, setAlertShownAtLeastOnce] = useState(false);

  useEffect(() => {
    if (!alertShownAtLeastOnce && availableSmiles.length > 30) {
      setPreviewSmiles(false);
      setAlertShownAtLeastOnce(true);
      horusAlert(
        `Disabled SMILES preview due to the list being too large. Click 'View' -> 'Toggle SMILES preview' to enable previews again at the cost of performance.`
      );
    }
  }, [availableSmiles]);

  return (
    <div
      className="w-full h-full flex flex-col relative"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragExit={handleDragEnd}
      onDragLeave={handleDragEnd}
    >
      {isHoveringFile && (
        <_GreenOverlay>
          <div className="flex flex-col gap-2 items-center justify-center font-semibold">
            <SaveIcon className="w-16 h-16" />
            Drop a .CSV / .SMI / .SDF file
          </div>
        </_GreenOverlay>
      )}
      {loadingFile && (
        <_GreenOverlay>
          <div className="flex flex-col gap-2 items-center justify-center font-semibold">
            <RotatingLines />
            Loading files...
          </div>
        </_GreenOverlay>
      )}
      <SmilesToolBox
        currentGroup={currentGroup}
        availableSmiles={availableSmiles}
        viewMode={viewMode}
        setViewMode={setViewMode}
        toggleSMILESPreview={() => setPreviewSmiles(!previewSmiles)}
      />
      {availableSmiles.length > 0 ? (
        viewMode === "grid" ? (
          <InternalSmilesGridView
            availableSmiles={availableSmiles}
            setEditingSmiles={setEditingSmiles}
            updateExistingSmiles={updateExistingSmiles}
            setCurrentGroup={setCurrentGroup}
            previewSmiles={previewSmiles}
          />
        ) : (
          <SmilesList
            availableSmiles={availableSmiles}
            updateExistingSmiles={updateExistingSmiles}
            previewSmiles={previewSmiles}
            onClickEdit={(smiles) => {
              setEditingSmiles(smiles);
            }}
          />
        )
      ) : (
        <div
          className="flex flex-col justify-center items-center h-full text-muted"
          style={{
            margin: "auto",
          }}
        >
          <span>No molecules available.</span>
          <span className="text-center">
            Load a protein in Mol* with ligands or draw manually one using the
            "New molecule" button
          </span>
        </div>
      )}
      <EditSmilesModal
        smiles={editingSmiles}
        onChange={(newSmiles) => {
          // Update the smiles
          updateExistingSmiles(newSmiles);
        }}
        isOpen={editingSmiles !== null}
        onClose={() => {
          setEditingSmiles(null);
        }}
      />
    </div>
  );
}

function _GreenOverlay({ children }: { children: ReactNode }) {
  return (
    <div
      className="backdrop-blur-sm bg-green-200 bg-opacity-50 m-auto cursor-copy w-full h-full"
      style={{
        placeContent: "center",
        display: "grid",
        position: "absolute",
        zIndex: 100,
      }}
    >
      {children}
    </div>
  );
}

export type InternalSmilesGridViewProps = {
  availableSmiles: HorusSmilesType[];
  setEditingSmiles: (smiles: HorusSmilesType) => void;
  updateExistingSmiles: (smiles: HorusSmilesType) => void;
  setCurrentGroup: (group?: string) => void;
  previewSmiles: boolean;
};

function InternalSmilesGridView(props: InternalSmilesGridViewProps) {
  const getSmilesGrouped = () => {
    const smilesGrouped: Record<string, HorusSmilesType[]> = {};
    const smilesGroupedViews: { [key: string]: React.ReactNode[] } = {};

    for (const smiles of props.availableSmiles) {
      if (!smilesGrouped[smiles.group ?? "Horus"]) {
        smilesGrouped[smiles.group ?? "Horus"] = [];
      }

      smilesGrouped[smiles.group ?? "Horus"]!.push(smiles);
    }

    for (const group in smilesGrouped) {
      smilesGroupedViews[group] = [
        <_GroupingVirtualizedOfSmilesView
          {...props}
          availableSmiles={smilesGrouped[group]!}
          key={group}
        />,
      ];
    }

    return smilesGroupedViews;
  };

  return <SidebarView views={getSmilesGrouped()} />;
}

function _GroupingVirtualizedOfSmilesView(props: InternalSmilesGridViewProps) {
  const { availableSmiles, setCurrentGroup } = props;

  const [delayedRender, setDelayedRender] = useState(true);

  useEffect(() => {
    setCurrentGroup(availableSmiles[0]?.group);
  }, [availableSmiles, setCurrentGroup]);

  useEffect(() => {
    setDelayedRender(false);
  }, []);

  const currentSize = useRef({ width: 0, height: 0 });
  const timer = useRef<Timer | null>(null);

  if (delayedRender) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <RotatingLines />
        <span>Loading SMILES...</span>
      </div>
    );
  }

  return (
    <AutoSizer
      onResize={({ width, height }) => {
        if (
          currentSize.current.width === width &&
          currentSize.current.height === height
        ) {
          return;
        }

        currentSize.current = { width, height };
        // Set a delay of 1 second before re-rendering
        setDelayedRender(true);

        if (timer.current) {
          clearTimeout(timer.current);
        }

        timer.current = setTimeout(() => {
          setDelayedRender(false);
        }, 500);
      }}
    >
      {({ height, width }) => {
        let itemsPerRow = Math.floor(width / SMILES_GRID_WIDTH);

        if (itemsPerRow < 1) {
          itemsPerRow = 1;
        }

        const rowCount = Math.ceil(availableSmiles.length / itemsPerRow);

        return (
          <List
            width={width}
            height={height}
            rowCount={rowCount}
            rowHeight={SMILES_GRID_HEIGTH}
            rowRenderer={({ index, key, style, isVisible }) => {
              const items = [];
              const convertedIndex = index * itemsPerRow;

              for (
                let i = convertedIndex;
                i < convertedIndex + itemsPerRow;
                i++
              ) {
                if (i >= availableSmiles.length) {
                  break;
                }

                items.push(
                  <_VirtualizedSmilesView
                    key={i}
                    smilesToRender={availableSmiles[i]!}
                    index={i}
                    updateExistingSmiles={props.updateExistingSmiles}
                    setEditingSmiles={props.setEditingSmiles}
                    isScrolling={!isVisible}
                    previewSmiles={props.previewSmiles}
                  />
                );
              }
              return (
                <div className="flex flex-row" key={key} style={style}>
                  {items}
                </div>
              );
            }}
          />
        );
      }}
    </AutoSizer>
  );
}

type VirtualizedSmilesViewType = Omit<
  InternalSmilesGridViewProps,
  "availableSmiles" | "setCurrentGroup"
> & {
  smilesToRender: HorusSmilesType;
  index: number;
  isScrolling: boolean;
  previewSmiles: boolean;
};

function _VirtualizedSmilesView({
  smilesToRender: smiles,
  index,
  updateExistingSmiles,
  setEditingSmiles,
  isScrolling,
  previewSmiles,
}: VirtualizedSmilesViewType) {
  const horusAlert = useAlert();

  return (
    <div
      className="border relative"
      key={smiles.id}
      style={{
        cursor: smiles.structureRef ? "not-allowed" : "default",
      }}
      onClick={() => {
        if (smiles.structureRef) {
          horusAlert(CannotEdit3D);
        }
      }}
    >
      <span
        className="absolute"
        style={{
          top: "0",
          left: "1px",
          zIndex: 10,
        }}
      >
        {index + 1}
      </span>
      <input
        id={`${smiles.id}-label`}
        disabled={smiles.structureRef ? true : false}
        className="absolute"
        style={{
          width: "calc(100% - 4px)",
          bottom: "2px",
          left: "2px",
          zIndex: 10,
          backgroundColor: "transparent",
        }}
        type="text"
        placeholder="Unnamed SMILES"
        value={
          smiles?.label
            ? smiles.structureRef
              ? `${smiles.label}`
              : smiles.label
            : ""
        }
        onChange={(e) => {
          updateExistingSmiles({ ...smiles, label: e.target.value });
        }}
      />
      {smiles?.structureRef && (
        <MolStarIcon
          style={{
            position: "absolute",
            bottom: "2px",
            right: "2px",
            zIndex: 10,
            backgroundColor: "white",
          }}
        />
      )}
      <input
        id={`${smiles.id}-selected`}
        className="absolute"
        style={{
          top: "2px",
          right: "2px",
          zIndex: 10,
        }}
        type="checkbox"
        checked={smiles.selected ?? false}
        onChange={(e) => {
          if (e.target.checked) {
            updateExistingSmiles({ ...smiles, selected: true });
          } else {
            updateExistingSmiles({ ...smiles, selected: false });
          }
        }}
      ></input>
      {isScrolling ? (
        <div
          className="w-full h-full grid place-content-center"
          style={{
            width: `${SMILES_GRID_WIDTH}px`,
            height: `${SMILES_GRID_HEIGTH}px`,
          }}
        >
          <RotatingLines />
        </div>
      ) : !previewSmiles ? (
        <NoPreviewSmilesView
          smiles={smiles}
          onClickEdit={() => setEditingSmiles(smiles)}
          containerStyle={{
            width: `${SMILES_GRID_WIDTH}px`,
            height: `${SMILES_GRID_HEIGTH}px`,
          }}
        />
      ) : (
        <SmilesView
          width={`${SMILES_GRID_WIDTH}px`}
          // Needed for overflow issue to substract -2px (-10 if )
          height={`${SMILES_GRID_HEIGTH - 2}px`}
          options={{
            depict: true,
            contextmenu: false,
            zoom: false,
            // showdragandDropIconindepictmode: false,
          }}
          smiles={smiles?.smi ?? ""}
          onClickEdit={
            smiles.structureRef
              ? undefined
              : () => {
                  setEditingSmiles(smiles);
                }
          }
        />
      )}
    </div>
  );
}

export function NoPreviewSmilesView({
  smiles,
  containerStyle,
  onClickEdit,
}: {
  smiles: HorusSmilesType;
  containerStyle?: React.CSSProperties;
  onClickEdit: () => void;
}) {
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ ...containerStyle }}
    >
      <AppButton
        disabled={smiles.structureRef ? true : false}
        action={onClickEdit}
      >
        {smiles.structureRef ? <MolStarIcon /> : "Edit SMILES"}
      </AppButton>
    </div>
  );
}
function SmilesToolBox(props: {
  availableSmiles: HorusSmilesType[];
  currentGroup?: string;
  viewMode: ViewMode;
  setViewMode: (viewMode: ViewMode) => void;
  toggleSMILESPreview: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const horusPrompt = usePrompt();

  const getSDFFile = async () => {
    const fileName = await horusPrompt(
      "Enter the name of the file to save the converted SDF"
    );

    const sdfContents = await window.smiles?.convertSelectedToSDF();
    if (!fileName || !sdfContents) return null;

    return new File([sdfContents], fileName + ".sdf", {
      type: "text/plain",
    });
  };

  const selectionMenu: ToolBarMenuProps[] = [
    {
      name: "Select all",
      disabled: props.viewMode === "list",
      onClick: () => {
        const updatedSmiles = props.availableSmiles.map((s) => {
          return { ...s, selected: true };
        });

        window.smiles?.setSmilesList(updatedSmiles);
      },
    },
    {
      name: "Unselect all",
      disabled: props.viewMode === "list",
      onClick: () => {
        const updatedSmiles = props.availableSmiles.map((s) => {
          return { ...s, selected: false };
        });

        window.smiles?.setSmilesList(updatedSmiles);
      },
    },
    {
      name: "Select molecules in current group",
      disabled: props.viewMode === "list",
      onClick: () => {
        const updatedSmiles = props.availableSmiles.map((s) => {
          const istoBeselected = s.group === props.currentGroup ? true : false;

          if (istoBeselected) return { ...s, selected: true };

          return s;
        });

        window.smiles?.setSmilesList(updatedSmiles);
      },
    },
    {
      name: "Unselect molecules in current group",
      disabled: props.viewMode === "list",
      onClick: () => {
        const updatedSmiles = props.availableSmiles.map((s) => {
          const istoBeselected = s.structureRef
            ? false
            : s.group === props.currentGroup
            ? true
            : false;

          if (istoBeselected) return { ...s, selected: false };

          return s;
        });

        window.smiles?.setSmilesList(updatedSmiles);
      },
    },
    {
      name: "Change group of selection",
      disabled: !window.smiles?.getSelectedSmiles().length,
      onClick: async () => {
        const newGroup = await horusPrompt("Enter new group name");
        if (newGroup) {
          const newSmiles = window.smiles?.getSelectedSmiles().map((s) => {
            return s.id;
          });

          if (!newSmiles) return;

          window.smiles?.setSmilesList(
            window.smiles?.getSmilesList().map((s) => {
              if (newSmiles.includes(s.id) && !s.structureRef) {
                return { ...s, group: newGroup };
              }
              return s;
            })
          );
        }
      },
    },
    {
      name: "Add new property to selected molecules",
      disabled: !window.smiles?.getSelectedSmiles().length,
      onClick: async () => {
        const newProperty = await horusPrompt("Enter new property name");
        if (!newProperty) return;
        const propertyValue = await horusPrompt(
          "Enter new property value (leave blank for none)"
        );
        window.smiles?.addPropertyToSelected(newProperty, propertyValue);
      },
    },
    {
      name: "Duplicate selection",
      disabled: !window.smiles?.getSelectedSmiles().length,
      onClick: async () => {
        setBusy("Duplicating...");
        await new Promise((resolve) => {
          setTimeout(async () => {
            const selectedSmiles = window.smiles?.getSelectedSmiles();

            if (!selectedSmiles) {
              resolve(true);
              return;
            }

            const newSmiles = selectedSmiles.map((s) => {
              return window.smiles!.duplicateSmiles(s);
            });

            if (!newSmiles) {
              resolve(true);
              return;
            }

            window.smiles?.setSmilesList([
              ...window.smiles!.getSmilesList(),
              ...newSmiles,
            ]);

            resolve(true);
          }, 0);
        });

        setBusy(null);
      },
    },
    {
      name: "Remove selected molecules",
      disabled: !window.smiles?.getSelectedSmiles().length,

      onClick: () => {
        window.smiles?.removeSelected();
      },
    },
  ];

  const convertMenu: ToolBarMenuProps[] = [
    {
      name: "Convert to SDF and add to Molstar",
      disabled: !window.smiles?.getSelectedSmiles().length || busy !== null,
      onClick: async () => {
        setBusy("Converting...");

        setTimeout(async () => {
          try {
            const file = await getSDFFile();

            if (!file) return;

            await window.molstar.loadMoleculeFile(file);
          } finally {
            setBusy(null);
          }
        }, 1000);
      },
    },
    {
      name: "Convert to SDF and save",
      disabled: !window.smiles?.getSelectedSmiles().length || busy !== null,
      onClick: () => {
        setBusy("Converting...");

        setTimeout(async () => {
          try {
            const file = await getSDFFile();

            if (!file) return;

            window.horus.saveFile(file);
          } finally {
            setBusy(null);
          }
        }, 1000);
      },
    },
  ];

  const saveMenu: ToolBarMenuProps[] = [
    {
      name: "Save selected as .smi",
      disabled: !window.smiles?.getSelectedSmiles().length,
      onClick: async () => {
        const fileName = await horusPrompt(
          "Enter the name of the file to save the SMILES"
        );
        const selectedSmiles = window.smiles?.getSelectedSmiles();

        if (!selectedSmiles || !fileName) return;

        const smiles = selectedSmiles
          .map((s) => {
            return `${s.smi} ${s.label}`.trim();
          })
          .join("\n");

        const file = new File([smiles], fileName + ".smi", {
          type: "text/plain",
        });

        window.horus.saveFile(file);
      },
    },
    {
      name: "Save selected as .csv",
      disabled: !window.smiles?.getSelectedSmiles().length,
      onClick: async () => {
        const fileName = await horusPrompt(
          "Enter the CSV file name to save the SMILES"
        );
        const selectedSmiles = window.smiles?.getSelectedSmiles();

        if (!selectedSmiles || !fileName) return;

        const properties = Array.from(
          new Set(
            selectedSmiles
              .flatMap((s) => Object.keys(s.properties || {}))
              .filter((p) => p)
          )
        );

        const header = ["SMILES", "label", ...properties];

        const csv = [
          header,
          ...selectedSmiles.map((s) => [
            s.smi,
            s.label,
            ...properties.map((p) => s.properties?.[p] || ""),
          ]),
        ]
          .map((row) => row.join(","))
          .join("\n");

        const file = new File([csv], fileName + ".csv", {
          type: "text/plain",
        });

        window.horus.saveFile(file);
      },
    },
  ];

  const viewMenu: ToolBarMenuProps[] = [
    {
      name: "View as grid",
      onClick: () => {
        props.setViewMode("grid");
      },
      svgPath: <CenterView />,
    },
    {
      name: "View as list",
      onClick: () => {
        props.setViewMode("list");
      },
      svgPath: <LogFile />,
    },
    {
      name: "Toggle SMILES preview",
      onClick: () => {
        props.toggleSMILESPreview();
      },
      svgPath: <EyeIcon />,
    },
  ];

  return (
    <div
      className="flex flex-row w-full justify-between items-center gap-2 flex-wrap z-50"
      style={{
        padding: "5px",
        borderBottom: "1px solid black",
      }}
    >
      <div className="flex flex-row flex-wrap gap-2">
        <ToolbarMenu
          name="New molecule"
          onClick={() => {
            const isGroupEditable = props.availableSmiles.find((s) => {
              return s.group === props.currentGroup;
            })?.structureRef
              ? false
              : true;

            window.smiles?.newEmptyMolecule(
              isGroupEditable ? props.currentGroup : "Horus"
            );
          }}
        />
        <ToolbarMenu name="View" items={viewMenu} />
        <ToolbarMenu name="Selection" items={selectionMenu} />
        <ToolbarMenu name="Convert" items={convertMenu} />
        <ToolbarMenu name="Save" items={saveMenu} />
        <ToolbarMenu name="Clean all" onClick={() => window.smiles?.reset()} />
      </div>
      {busy && (
        <div className="flex flex-row items-center gap-2">
          <RotatingLines size={"25px"} />
          <div className="text-sm">{busy}</div>
        </div>
      )}
      <div className="flex flex-row items-center gap-2 plugin-variable-name">
        Selected {window.smiles?.getSelectedSmiles().length} of{" "}
        {props.availableSmiles.length}
      </div>
    </div>
  );
}

function EditSmilesModal(props: {
  smiles: HorusSmilesType | null;
  onChange: (smiles: HorusSmilesType) => void;
  onClose: () => void;
  isOpen: boolean;
}) {
  const [smilesState, setSmilesState] = useState<HorusSmilesType | null>(
    props.smiles
  );

  useEffect(() => {
    setSmilesState(props.smiles);
  }, [props.smiles]);

  const [currentFocusOn, setCurrentFocusOn] = useState<
    "input" | "jsme" | null
  >();

  const handleNewSmiles = (smiles: HorusSmilesType) => {
    setSmilesState(smiles);
    props.onChange(smiles);
  };

  if (!smilesState) {
    return null;
  }

  return (
    <HorusModal show={props.isOpen} onHide={props.onClose} size="xl">
      <div className="flex flex-row flex-wrap gap-4 p-4 w-full max-h-[70vh] justify-around overflow-y-scroll">
        <div className="flex flex-col gap-2 w-full max-w-[500px]">
          <div>
            <label
              className="block plugin-variable-name"
              htmlFor="smiles-input"
            >
              Label
            </label>
            <input
              id={`${smilesState.id}-label-modal`}
              className="px-2 py-1 plugin-variable-value block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              type="text"
              placeholder="Label"
              value={smilesState.label}
              onChange={(e) => {
                handleNewSmiles({ ...smilesState, label: e.target.value });
              }}
            />
          </div>
          <div>
            <label
              className="block plugin-variable-name"
              htmlFor="smiles-input"
            >
              SMILES
            </label>
            <input
              onBlur={() => setCurrentFocusOn(null)}
              onFocus={() => {
                setCurrentFocusOn("input");
              }}
              id={`${smilesState.id}-smiles-modal`}
              className="px-2 py-1 plugin-variable-value block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              type="text"
              placeholder="SMILES"
              value={smilesState.smi}
              onChange={(e) => {
                if (currentFocusOn === "input") {
                  handleNewSmiles({ ...smilesState, smi: e.target.value });
                }
              }}
            />
          </div>

          <div>
            <label
              className="block plugin-variable-name"
              htmlFor="extra-info-textarea"
            >
              Additional information
            </label>
            <textarea
              style={{
                minHeight: "200px",
              }}
              id="extra-info-textarea"
              className="plugin-variable-value block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm overflow-y-scroll"
              placeholder="Add additional information here"
              value={smilesState.extraInfo ?? ""}
              onChange={(e) => {
                handleNewSmiles({ ...smilesState, extraInfo: e.target.value });
              }}
            />
          </div>
        </div>
        <div className="border">
          <SmilesView
            containerProps={{
              onFocus: () => {
                setCurrentFocusOn("jsme");
              },
              onBlur: () => setCurrentFocusOn(null),
            }}
            options={{
              contextmenu: false,
            }}
            parameters={{
              markerIconColor: "#00cfbf",
              guicolor: "#f8fafa",
              guiAtomColor: "#00a9ae",
            }}
            width={"500px"}
            height={"400px"}
            smiles={smilesState.smi}
            onChange={(newSmiles) => {
              if (currentFocusOn === "jsme") {
                handleNewSmiles({
                  ...smilesState,
                  smi: newSmiles.src.smiles(),
                });
              }
            }}
          />
        </div>
      </div>
    </HorusModal>
  );
}
