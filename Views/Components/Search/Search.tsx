import { ChangeEvent, KeyboardEvent } from "react";

interface SearchProps {
  placeholder: string;
  value?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  showIcon?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onEnter?: () => void;
  className?: string;
}

export function SearchComponent(props: SearchProps) {
  const {
    placeholder,
    onChange,
    showIcon = true,
    className,
    onEnter,
    value
  } = props;

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      onEnter?.();
    }
  };

  return (
    <div className={`app-button flex flex-row ${className}`}>
      <input
        id="search-input"
        type="text"
        placeholder={placeholder}
        className="w-full outline-none"
        onChange={onChange}
        value={value}
        onFocus={props.onFocus}
        onBlur={props.onBlur}
        onKeyDown={handleKeyDown}
        // Disable browser completion
        autoComplete="off"
      />
      {showIcon && (
        <button onClick={onEnter}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="white"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.774 4.774zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
