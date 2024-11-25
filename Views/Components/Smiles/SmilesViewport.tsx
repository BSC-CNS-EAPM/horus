import { Button as Molstarbutton } from "molstar/lib/mol-plugin-ui/controls/common";
import { ReactNode, useEffect, useState } from "react";
import EyeIcon from "../Toolbar/Icons/Eye";
import EyeDashIcon from "../Toolbar/Icons/EyeDash";
import { SmilesView } from "./SmilesComponent";
import { HorusSmilesType, SmilesEvents } from "./SmilesWrapper/horusSmiles";
import { PANEL_REGISTRY } from "../MainApp/PanelView";

export function Smiles2DMolstarViewportComponent() {
  const [currentSmiles, setCurrentSmiles] = useState<HorusSmilesType | null>(
    null,
  );
  const [availableSmiles, setAvailableSmiles] = useState<HorusSmilesType[]>([]);
  const [hidden, setHidden] = useState<boolean>(false);

  useEffect(() => {
    const updateSmilesEventListener = () => {
      setAvailableSmiles(
        window.smiles?.getSmilesList().filter((s) => s.structureRef) ?? [],
      );
      setCurrentSmiles(window.smiles?.getCurrentSmiles() ?? null);
    };

    window.addEventListener(SmilesEvents.STATE, updateSmilesEventListener);

    return () => {
      window.removeEventListener(SmilesEvents.STATE, updateSmilesEventListener);
    };
  }, [currentSmiles]);

  // Get the initial smiles
  useEffect(() => {
    setCurrentSmiles(window.smiles?.getCurrentSmiles() ?? null);
    setAvailableSmiles(window.smiles?.getSmilesList() ?? []);
  }, []);

  return (
    <>
      {hidden ? (
        <CustomViewportButton
          onClick={() => {
            setHidden(!hidden);
          }}
          title="Show 2D molecules"
        >
          <EyeDashIcon />
        </CustomViewportButton>
      ) : (
        <CustomViewportButton
          visible
          title="Hide 2D molecules"
          onClick={() => {
            setHidden(!hidden);
          }}
        >
          <EyeIcon
            onClick={() => {
              setHidden(!hidden);
            }}
          />
        </CustomViewportButton>
      )}
      {!hidden && (
        <div
          className="flex flex-col gap-1 bg-white"
          style={{
            height: hidden ? "0px" : "auto",
            minWidth: "240px",
          }}
        >
          <div className="border">
            <SmilesView
              containerProps={{
                onClick: () => {
                  // Focus the residue if it comes from a structure
                  if (
                    currentSmiles &&
                    currentSmiles.structureRef &&
                    currentSmiles.structureRef.residue
                  ) {
                    const label = currentSmiles.structureRef.residue.label;
                    const residueNum =
                      currentSmiles.structureRef.residue.residue;
                    const chain = currentSmiles.structureRef.residue.chainID;
                    window?.molstar?.focus(label, residueNum, chain);
                  }
                },
              }}
              removePolygon={true}
              width={"100%"}
              height={"150px"}
              options={{
                depict: true,
                contextmenu: false,
                zoom: false,
                // showdragandDropIconindepictmode: false,
              }}
              smiles={currentSmiles?.smi}
              onClickEdit={() => {
                document.dispatchEvent(
                  new CustomEvent("addPanel", {
                    detail: {
                      component: PANEL_REGISTRY.smiles.component,
                      panelID: PANEL_REGISTRY.smiles.id,
                    },
                  }),
                );
              }}
            />
          </div>
          {availableSmiles && availableSmiles.length > 0 && (
            <select
              id="select-smiles"
              className="w-full h-full border"
              onChange={(e) => {
                const smilesID = e.target.value;

                const wantedSmiles = availableSmiles.find(
                  (smi) => smi.id === smilesID,
                );

                if (!wantedSmiles) return;

                window.smiles?.setCurrentSmiles(wantedSmiles);
              }}
              value={currentSmiles?.id}
            >
              {availableSmiles && availableSmiles.length > 0
                ? availableSmiles.map((smi) => {
                    return (
                      <option key={smi.id} value={smi.id}>
                        {`${smi.label} - ${
                          window.molstar?.getLabelFromStructureRef(
                            smi.structureRef?.id ?? "",
                          ) ?? "Unknown"
                        }` || "Unnamed SMILES"}
                      </option>
                    );
                  })
                : "No molecules"}
            </select>
          )}
        </div>
      )}
    </>
  );
}

function CustomViewportButton({
  children,
  title,
  onClick,
  visible,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
  visible?: boolean;
}) {
  return (
    <Molstarbutton
      className={`z-10 msp-btn msp-bt-icon msp-btn-link-toggle-on msp-semi-transparent-background place-items-center`}
      style={{
        display: "grid",
        position: visible ? "absolute" : "relative",
        width: "32px",
        height: "32px",
        padding: 0,
      }}
      title={title}
      onClick={onClick}
    >
      {children}
    </Molstarbutton>
  );
}
