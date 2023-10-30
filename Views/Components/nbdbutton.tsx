// Import the css
import "./nbdbutton.css";

type NBDButtonProps = {
  text?: string;
  action: () => void;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  className?: string;
};

// Create a component called NBDButton
function NBDButton(props: NBDButtonProps) {
  const className = "app-button " + props?.className;

  return (
    <div>
      {/* Create a button with the text and the action */}
      <button className={className} onClick={props.action} style={props.style}>
        {props?.text}
        {props?.children}
      </button>
    </div>
  );
}

// Export the component
export default NBDButton;
