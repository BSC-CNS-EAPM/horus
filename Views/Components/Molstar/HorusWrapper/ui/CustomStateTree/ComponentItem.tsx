import HorusMolstar from "../../horusmolstar";
import EyeIcon from "@/Components/Toolbar/Icons/Eye";
import { ComponentItem as ComponentItemType } from "./types";

interface ComponentItemProps {
  item: ComponentItemType;
  label?: string;
  compact?: boolean;
  onAddRepresentation: (selection: string, loci?: any) => void;
}

export function ComponentItem({
  item,
  onAddRepresentation,
  label,
  compact,
}: ComponentItemProps) {
  const molstar = window.molstar as HorusMolstar;

  const focusComponent = () => {
    molstar.plugin!.managers.camera.focusLoci(item.loci, {
      minRadius: 8,
      extraRadius: 4,
      durationMs: 250,
    });
    molstar.plugin!.managers.structure.focus.setFromLoci(item.loci);
  };

  const handleAddRepresentation = () => {
    onAddRepresentation(item.id, item.loci);
  };

  const highlight = () => {
    molstar.plugin!.managers.interactivity.lociHighlights.highlight({
      loci: item.loci,
    });
  };

  const clearHighlight = () => {
    molstar.plugin!.managers.interactivity.lociHighlights.clearHighlights();
  };

  return (
    <div
      onMouseOver={highlight}
      onMouseLeave={clearHighlight}
      className={`flex items-center flex-grow justify-between py-1 px-2 hover:bg-gray-50 rounded 
      ${compact ? "py-0.5 px-1" : "py-1 px-2 pe-5"} 
      ${compact ? "text-xs" : "text-sm"}
    `}
    >
      <span className={compact ? "" : "font-bold"}>{label ?? item.id}</span>
      <div className="flex items-center space-x-1">
        <button
          onClick={focusComponent}
          className="p-1 text-gray-400 hover:text-gray-600"
          title="Focus on component"
        >
          <EyeIcon className="w-3 h-3" />
        </button>
        <button
          onClick={handleAddRepresentation}
          className="p-1 text-gray-400 hover:text-gray-600"
          title="Add representation"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
