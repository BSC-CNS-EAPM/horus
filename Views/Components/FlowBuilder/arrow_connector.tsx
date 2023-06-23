import { useEffect, useRef } from "react";
import Xarrow, { refType, useXarrow, Xwrapper } from "react-xarrows";
import { BlockProps } from "./flow_builder_interfaces";
import { useDraggable } from "@dnd-kit/core";

interface ArrowConnectorProps {
  // The block that the arrow is coming from (html ref)
  from: React.MutableRefObject<any> | string;
  block: BlockProps;
}

function ArrowBlockConnector(props: ArrowConnectorProps) {
  const { from, block } = props;

  const ref = useRef<HTMLDivElement>(null);

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `${block.placedID}-${block.id}-connector`,
    data: {
      type: "connector",
      block: block,
    },
  });

  useEffect(() => {
    setNodeRef(ref.current);
  }, [ref]);

  var style = {
    transform: null,
  };

  if (transform) {
    style.transform = `translate(${transform.x}px, ${transform.y}px)`;
  }

  return (
    <div
      className={transform ? "connecting-blocks" : "connect-blocks"}
      ref={ref}
      style={style}
      {...listeners}
      {...attributes}
    >
      {transform && <Xarrow start={from} end={ref} />}
    </div>
  );
}

export { ArrowBlockConnector };
