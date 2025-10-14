import RotatingLines from "@/Components/RotatingLines/rotatinglines";

export function OptimizationProgress({
  currentStep,
  totalSteps
}: {
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <div className="msp-flex-row gap-2 p-2 justify-between">
      <div className="flex flex-row gap-2">
        <RotatingLines size="18px" />
        <span className="text-gray-400 italic">Optimizing selection...</span>
      </div>
      {totalSteps > 0 && (
        <div
          className="flex flex-row gap-2"
          style={{ alignItems: "center", fontSize: "12px" }}
        >
          <span className="text-gray-300">
            Step {currentStep} / {totalSteps}
          </span>
          <span className="text-gray-400">
            ({Math.round((currentStep / totalSteps) * 100)}%)
          </span>
        </div>
      )}
    </div>
  );
}
