// React
import { useState } from "react";

// Import the core component
import { Switch } from "@headlessui/react";

// Import the custom styling
import "./switch.css";

type HorusSwitchProps = {
  enabled?: boolean;
  setEnabled?: (enabled: boolean) => void;
  children?: React.ReactNode;
  disabled?: boolean;
};

export default function HorusSwitch(props: HorusSwitchProps) {
  const [enabled, setEnabled] = useState<boolean>(props.enabled ?? false);

  // Handle the change in the input so that it waits for the animation to finish
  const handleChange = async (enabled: boolean) => {
    setEnabled(enabled);
    await new Promise((resolve) => setTimeout(resolve, 200));
    props.setEnabled && props.setEnabled(enabled);
  };

  return (
    <Switch
      disabled={props.disabled ?? false}
      checked={enabled}
      onChange={handleChange}
      className="horus-switch"
      style={{
        background: enabled ? "var(--vintage-code)" : "var(--grey-bsc)",
      }}
    >
      {/* {children && <span className="sr-only">{children}</span>} */}
      <span
        aria-hidden="true"
        className={`${enabled ? "translate-x-5" : "translate-x-0"}
              pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out`}
      />
    </Switch>
  );
}
