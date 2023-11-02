import { useState, useEffect } from "react";
import { Block } from "../flow_builder_types";
import { horusGet } from "../../../Utils/utils";

type BlockRemotesProps = {
  block: Block;
};

export function BlockRemotes(props: BlockRemotesProps) {
  const [availableRemotes, setAvailableRemotes] = useState<Array<string>>([]);
  const [isFetchingRemotes, setIsFetchingRemotes] = useState<boolean>(true);

  const fetchRemotes = async () => {
    setIsFetchingRemotes(true);
    const response = await horusGet("/remotes/names");
    const data = await response.json();

    if (!data.ok) {
      alert(data.error);
      return;
    }

    setAvailableRemotes(data.remotes);

    if (props.block.selectedRemote === null) {
      props.block.setRemoteConnection("Local");
    }

    setIsFetchingRemotes(false);
  };

  useEffect(() => {
    fetchRemotes();
  }, []);

  return isFetchingRemotes ? (
    <div>Loading remotes...</div>
  ) : (
    <div className="remote-block-cloud items-center mt-0">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-9 h-9"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
        />
      </svg>
      Remote:
      <select
        value={props.block.selectedRemote}
        onChange={(e) => {
          props.block.setRemoteConnection(e.target.value);
          props.block?.onChange(props.block.placedID);
        }}
      >
        {availableRemotes.map((remote) => (
          <option key={remote} value={remote}>
            {remote}
          </option>
        ))}
      </select>
    </div>
  );
}
