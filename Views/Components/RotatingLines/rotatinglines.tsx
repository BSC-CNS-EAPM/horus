import rotatinglines from "./rotating.gif";

export default function RotatingLines() {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <img
        src={rotatinglines}
        alt="rotating lines"
        style={{
          height: "50px",
        }}
      />
    </div>
  );
}
