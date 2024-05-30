// Import the css
import "./appbutton.css";

type AppButtonProps = {
  id?: string;
  text?: string;
  action: () => void;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
};

// Create a component called AppButton
function AppButton(props: AppButtonProps) {
  const className = "app-button " + props?.className;

  return (
    <div>
      {/* Create a button with the text and the action */}
      <button
        disabled={props.disabled}
        id={props.id}
        className={className}
        onClick={props.action}
        style={props.style}
      >
        {props?.text}
        {props?.children}
      </button>
    </div>
  );
}

// Export the component
export default AppButton;
