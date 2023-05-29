// Import the css
import "./nbdbutton.css";

// Create a component called NBDButton
function NBDButton(props) {

    return (
        <div>
            {/* Create a button with the text and the action */}
            <button className="nbd-btn" onClick={props.action}>{props.text}</button>
        </div>
    );
}

// Export the component
export default NBDButton;