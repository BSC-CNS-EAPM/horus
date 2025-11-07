import { IconCheck, IconX, IconDeviceFloppy } from "@tabler/icons-react";
import RotatingLines from "../RotatingLines/rotatinglines";
import { SaveStatus } from "../FlowBuilder/flow.hooks";

interface SaveIndicatorProps {
  status: SaveStatus;
  className?: string;
}

export function SaveIndicator({ status, className = "" }: SaveIndicatorProps) {
  const getStatusIcon = () => {
    switch (status) {
      case "saving":
        return <RotatingLines size="16px" />;
      case "saved":
        return <IconCheck size={16} className="text-green-500" />;
      case "error":
        return <IconX size={16} className="text-red-500" />;
      case "idle":
      default:
        return <IconDeviceFloppy size={16} className="text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "saving":
        return "Auto-saving...";
      case "saved":
        return "Auto-saved";
      case "error":
        return "Auto-save failed";
      case "idle":
      default:
        return "Idle";
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "saving":
        return "text-blue-500";
      case "saved":
        return "text-green-500";
      case "error":
        return "text-red-500";
      case "idle":
      default:
        return "text-gray-500";
    }
  };

  if (status === "idle") {
    return null;
  }

  return (
    <div
      className={`flex items-center gap-1 px-2 py-1 text-sm transition-all duration-200 ${getStatusColor()} ${className}`}
      title={getStatusText()}
    >
      {getStatusIcon()}
      <span className="hidden sm:inline">{getStatusText()}</span>
    </div>
  );
}
