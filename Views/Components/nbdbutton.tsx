// Import the css
import "./nbdbutton.css";

type NBDButtonProps = {
  text?: string;
  action: () => void;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

// Create a component called NBDButton
function NBDButton(props: NBDButtonProps) {
  return (
    <div>
      {/* Create a button with the text and the action */}
      <button className="app-button" onClick={props.action} style={props.style}>
        {props?.text}
        {props?.children}
      </button>
    </div>
  );
}

// Export the component
export default NBDButton;
