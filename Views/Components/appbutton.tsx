// Import the css
import "./appbutton.css";

type AppButtonProps = {
  id?: string;
  text?: string;
  action?: () => void;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  type?: HTMLButtonElement["type"];
  title?: string;
};

// Create a component called AppButton
function AppButton(props: AppButtonProps) {
  const className = "app-button text-black" + props?.className;

  // First div necessary for padding
  return (
    <div>
      <button
        title={props?.title}
        type={props.type}
        disabled={props.disabled}
        id={props.id}
        className={className}
        onClick={() => props.action && props.action()}
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
