// Import the image
// @ts-ignore
import horus_god from "../../Resources/horus_god.png";

// Import the css file
import "./error.css";

// Create a component for the error window
function Error() {
  return (
    <div>
      <h1>Error</h1>
      <img src={horus_god} alt="Shemsu Error" className="shemsu-img" />
    </div>
  );
}

// Export the component
export default Error;
