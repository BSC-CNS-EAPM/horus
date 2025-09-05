import { useCallback, useMemo, useRef, useState } from "react";
import { HorusSmilesType } from "../Smiles/SmilesWrapper/horusSmiles";
import "./MoleculePlotter.css";
import HorusContainer from "../HorusContainer/horus_container";
import SettingsIcon from "../Toolbar/Icons/Settings";
import {
  getDataColor,
  HorusPlotly,
  HorusPlotData,
  HorusPlotlyAPI
} from "./HorusPlot";
import AppButton from "../appbutton";

import { EditSmilesModal } from "../Smiles/SmilesGrid";

function getAxisValues(smiles: HorusSmilesType[], axis: string) {
  if (axis === "smiles") {
    return smiles.map((s) => s.smi);
  }

  if (axis === "label") {
    return smiles.map((s) => s.label);
  }

  if (axis === "group") {
    return smiles.map((s) => s.group);
  }

  return smiles.map((s) => s.properties?.[axis]);
}

export function MoleculePlotter({
  smilesToPlot
}: {
  smilesToPlot?: HorusSmilesType[];
}) {
  const [xAxis, setXAxis] = useState<string>("smiles");
  const [yAxis, setYAxis] = useState<string>("label");
  const [colorBy, setColorBy] = useState<string>("");
  const [plotType, setPlotType] = useState<
    "scatter" | "bar" | "lines" | "lines+markers"
  >("scatter");
  const plotRef = useRef<HorusPlotlyAPI | null>(null);

  const x = useMemo(
    () => getAxisValues(smilesToPlot ?? [], xAxis),
    [smilesToPlot, xAxis]
  );

  const y = useMemo(
    () => getAxisValues(smilesToPlot ?? [], yAxis),
    [smilesToPlot, yAxis]
  );

  const plotData = useMemo(() => {
    // If no colorBy is selected, return a single trace
    if (!colorBy || !smilesToPlot) {
      return [
        {
          x,
          y,
          mode:
            plotType === "lines"
              ? "lines"
              : plotType === "lines+markers"
                ? "lines+markers"
                : "markers",
          showlegend: false,
          type: plotType,
          marker: {
            size: 10,
            color: "rgba(75, 192, 192, 0.7)",
            linewidth: 2,
            line: { width: 2, color: "rgba(75, 192, 192, 1)" },
            symbol: "circle"
          },
          name: "All Data" // Add a name for the legend
        }
      ] as HorusPlotData[];
    }

    // Get unique values for color grouping
    const colorValues = getAxisValues(smilesToPlot, colorBy);
    const uniqueColorValues = [...new Set(colorValues)];

    // Create a trace for each unique color value
    return uniqueColorValues.map((colorValue, index) => {
      // Filter data points for this specific color value
      const filteredIndices: number[] = colorValues.reduce((acc, val, idx) => {
        if (val === colorValue) acc.push(idx);
        return acc;
      }, [] as number[]);

      return {
        x: filteredIndices.map((i) => x[i]),
        y: filteredIndices.map((i) => y[i]),
        mode: "markers",
        type: plotType,

        legendgroup: colorValue,
        name: String(colorValue), // Use the color value as the legend name
        marker: {
          size: 10,
          color: getDataColor(index), // Use a consistent color for each unique value
          linewidth: 2,
          line: { width: 2, color: getDataColor(index) },
          symbol: "circle"
        }
      } as HorusPlotData;
    });
  }, [smilesToPlot, colorBy, x, y, plotType]);

  const availableAxes = useMemo(() => {
    const axes = new Set(["smiles", "label", "group"]);
    for (const smiles of smilesToPlot ?? []) {
      for (const prop in smiles.properties) {
        axes.add(prop);
      }
    }
    return Array.from(axes);
  }, [smilesToPlot]);

  const [clickedSmiles, setClickedSmiles] = useState<HorusSmilesType | null>(
    null
  );

  const onPointClick = useCallback(
    (data: any) => {
      const smiles = smilesToPlot?.[data.points[0].pointNumber];
      if (smiles) {
        setClickedSmiles(smiles);
      }
    },
    [smilesToPlot]
  );

  if (!smilesToPlot) {
    return "No smiles to plot";
  }

  return (
    <div className="h-full">
      <EditSmilesModal
        smiles={clickedSmiles}
        onChange={() => {}}
        onClose={() => setClickedSmiles(null)}
        isOpen={!!clickedSmiles}
        isShowingList={true}
      />
      <PlotSettings>
        <div className="flex-group">
          <span className="font-bold mr-2">Color by</span>
          <select value={colorBy} onChange={(e) => setColorBy(e.target.value)}>
            <option value="">None</option>
            {availableAxes.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-group">
          <span className="font-bold mr-2">Plot type</span>
          <select
            value={plotType}
            onChange={(e) => setPlotType(e.target.value as any)}
          >
            <option value="scatter">Scatter</option>
            <option value="bar">Bar</option>
            <option value="lines">Line</option>
            <option value="lines+markers">Line and markers</option>
          </select>
        </div>
        <div className="flex-group">
          <span className="font-bold mr-2">Y axis</span>
          <select value={yAxis} onChange={(e) => setYAxis(e.target.value)}>
            {availableAxes.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-group">
          <span className="font-bold mr-2">X axis</span>
          <select value={xAxis} onChange={(e) => setXAxis(e.target.value)}>
            {availableAxes.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </div>
        <div className="grid place-items-center w-full justify-center items-center mt-2 mb-2">
          <AppButton
            action={async () => {
              // const width = Number(
              //   await prompt("Enter image width (in pixels):")
              // );

              // if (isNaN(width)) {
              //   return;
              // }

              // const height = Number(
              //   await prompt("Enter image height (in pixels):")
              // );

              // if (isNaN(height)) {
              //   return;
              // }

              const width = 1200;
              const height = 800;

              const filename = `${(await prompt("Enter image filename:")) ?? "plot"}.png`;
              if (!isNaN(width) && !isNaN(height)) {
                plotRef.current
                  ?.toImage({
                    format: "png",
                    width,
                    height,
                    filename
                  })
                  .then((base64: string) => {
                    parent.horus.saveFile(base64ToFile(base64, filename));
                  });
              }
            }}
          >
            Save image
          </AppButton>
        </div>
      </PlotSettings>
      <HorusPlotly
        ref={plotRef}
        container={{
          style: {
            height: "calc(100% - 85px)"
          }
        }}
        xAxisTitle={xAxis}
        yAxisTitle={yAxis}
        data={plotData}
        legendTitle={colorBy}
        onDataClick={onPointClick}
      />
    </div>
  );
}

function PlotSettings({ children }: { children: React.ReactNode }) {
  const [isHovered, setIsHovered] = useState(false);

  const timeout = useRef<Timer | null>(null);

  const onMouseEnter = () => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
    setIsHovered(true);
  };

  const onMouseLeave = () => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }

    timeout.current = setTimeout(() => setIsHovered(false), 500);
  };

  return (
    <div
      className={`relative z-10 flex flex-col pt-2 items-center`}
      style={{
        transform: "translateY(10px)"
      }}
    >
      <HorusContainer
        className={`z-10 ${isHovered ? "plot-settings-shown" : ""}`}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div className="flex flex-row gap-2 items-center justify-center px-4">
          <SettingsIcon
            className={`settings-plot-icon ${isHovered ? "plot-icon-hover" : ""}`}
          />
          <span className="text-xl font-bold">Plot settings</span>
        </div>
      </HorusContainer>
      <HorusContainer
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          transform: "translateY(45px)",
          maxWidth: "500px",
          paddingInline: "0.5rem"
        }}
        className={`fixed z-10 settings-children mt-2 ${isHovered ? "settings-children-shown plot-settings-shown" : ""}`}
      >
        {children}
      </HorusContainer>
    </div>
  );
}

function base64ToFile(base64String: string, fileName: string) {
  // Split the base64 string to get the base64 content
  const byteString = atob(base64String.split(",")[1]!);

  // Create an ArrayBuffer and view for the binary data
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  // Create a Blob with the PNG MIME type
  const blob = new Blob([ab], { type: "image/png" });

  // Create a File object from the Blob
  return new File([blob], fileName, { type: "image/png" });
}
