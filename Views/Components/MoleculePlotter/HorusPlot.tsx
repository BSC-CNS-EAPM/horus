import {
  ForwardedRef,
  forwardRef,
  HTMLAttributes,
  RefObject,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";
// @ts-ignore
import Plotly from "plotly.js-dist";
import RotatingLines from "../RotatingLines/rotatinglines";
import { useContainerSize } from "@/Utils/CustomHooks/useContainerSize";

const defaultColors: string[] = [
  "#636EFA",
  "#EF553B",
  "#00CC96",
  "#AB63FA",
  "#FFA15A",
  "#19D3F3",
  "#FF6692",
  "#B6E880",
  "#FF97FF",
  "#FECB52",
  "#909091"
];

export const getDataColor = (index: number) => {
  // If the color already exists, return it
  if (defaultColors[index]) {
    return defaultColors[index];
  }

  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }

  // Add the color to the array
  defaultColors.push(color);

  return color;
};

export const getUnitsForAxis = (axis: string) => {
  const energies = ["energy", "energies"];

  for (let i = 0; i < energies.length; i++) {
    if (axis.toLowerCase().includes(energies[i]!)) {
      return "kcal/mol";
    }
  }

  const rmsd = ["rmsd", "distance"];

  for (let i = 0; i < rmsd.length; i++) {
    if (axis.toLowerCase().includes(rmsd[i]!)) {
      return "Å";
    }
  }

  return "";
};

export function prettifyColumnName(name: string) {
  const specialWords = ["id", "mcs", "pdb"];

  return name.replace(/_/g, " ").replace(/\w\S*/g, (w: string) => {
    if (specialWords.includes(w.toLowerCase())) {
      return w.toUpperCase();
    }
    return w.replace(/^\w/, (c) => c.toUpperCase()); // Capitalize the first letter of each word
  });
}

export type HorusPlotData = {
  x: any[];
  y: any[];
  mode: "markers" | "lines" | "lines+markers";
  type: "scatter" | "lines" | "bar";
  marker?: {
    size?: number;
    color?: string[] | string;
    linewidth?: number;
    line?: { width: number; color: string };
    symbol: "circle" | "square" | "diamond" | "cross" | "x" | "star";
  };
  name?: string;
  legendgroup?: string;
  showlegend?: boolean;
  hoverinfo?: string;
  hovertext?: string[];
  data?: any[];
};
export type HorusPlotProps = {
  data: HorusPlotData[];
  xAxisTitle: string;
  yAxisTitle: string;
  legendTitle?: string;
  onDataClick?: (event: any) => void;
  container?: HTMLAttributes<HTMLDivElement>;
};

function usePlotlyPlot({
  ref,
  data,
  xAxisTitle,
  yAxisTitle,
  legendTitle,
  onDataClick,
  api
}: HorusPlotProps & {
  ref: RefObject<HTMLDivElement>;
  api: ForwardedRef<HorusPlotlyAPI>;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const plotLoaded = useRef(false);

  const { width, height } = useContainerSize(ref?.current);

  const updatePlot = useCallback(async () => {
    if (!plotLoaded.current || !ref.current) return;

    const plot = ref.current;

    if (!document.getElementById(plot.id)) return;

    const xAxisUnits = getUnitsForAxis(xAxisTitle);
    let prettifiedXAxisTitle = prettifyColumnName(xAxisTitle);
    if (xAxisUnits) {
      prettifiedXAxisTitle += ` (${xAxisUnits})`;
    }

    const yAxisUnits = getUnitsForAxis(yAxisTitle);
    let prettifiedYAxisTitle = prettifyColumnName(yAxisTitle);
    if (yAxisUnits) {
      prettifiedYAxisTitle += ` (${yAxisUnits})`;
    }

    const layout = {
      title: null,
      xaxis: { title: prettifiedXAxisTitle, autorange: true },
      yaxis: { title: prettifiedYAxisTitle, autorange: true },
      height: height,
      width: width,
      margin: {
        t: 30,
        b: 30
      },
      hovermode: "closest",
      showlegend: true,
      legend: {
        title: {
          text: legendTitle ?? "Legend"
        }
      }
    };

    const config = {
      responsive: true,
      displaylogo: false,
      displayModeBar: false,
      showLegend: true
    };

    Plotly.react(plot.id, data, layout, config).then(() => setIsLoading(false));

    // @ts-ignore
    plot.on("plotly_click", onDataClick);
  }, [
    ref,
    data,
    xAxisTitle,
    yAxisTitle,
    plotLoaded,
    width,
    height,
    legendTitle,
    onDataClick
  ]);

  useImperativeHandle(
    api,
    () => ({
      toImage: (options) => Plotly.toImage(ref.current?.id, options)
    }),
    [ref]
  );

  useEffect(() => {
    updatePlot();
  }, [updatePlot]);

  useEffect(() => {
    const createPlot = async () => {
      if (!ref.current || plotLoaded.current || !ref.current?.id) {
        return;
      }

      while (!document.getElementById(ref.current.id)) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      Plotly.newPlot(ref.current.id)
        .then(() => {
          plotLoaded.current = true;
        })
        .then(() => {
          setTimeout(() => {
            updatePlot();
          }, 500);
        });
    };

    createPlot();
  }, [ref, updatePlot]);

  return { isLoading };
}

export type HorusPlotlyAPI = {
  toImage: (options: {
    format: string;
    width: number;
    height: number;
    filename: string;
  }) => Promise<string>;
};

export const HorusPlotly = forwardRef<HorusPlotlyAPI, HorusPlotProps>(
  _HorusPlot
);

function _HorusPlot(props: HorusPlotProps, api: ForwardedRef<HorusPlotlyAPI>) {
  const idRef = useRef("plot" + Math.random());
  const localRef = useRef<HTMLDivElement>(null); // Create a local ref

  const { isLoading } = usePlotlyPlot({
    ref: localRef as RefObject<HTMLDivElement>,
    api,
    ...props
  });

  return (
    <div {...props.container}>
      {isLoading && (
        <div className="w-full h-full flex justify-center items-center">
          <RotatingLines />
        </div>
      )}
      <div id={idRef.current} ref={localRef} />;
    </div>
  );
}
