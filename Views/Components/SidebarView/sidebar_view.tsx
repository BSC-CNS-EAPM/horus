// React
import { useState } from "react";

// Components
import { BreakLongUnderscoreNames } from "../FlowBuilder/Blocks/block.view";

// Styles
import "./sidebar.css";

type SidebarViewProps = {
  views: {
    [key: string]: React.ReactNode[];
  };
};

export default function SidebarView(props: SidebarViewProps) {
  const [currentCategory, setCurrentCategory] = useState<string>(
    Object.keys(props.views)[0]!
  );

  return (
    <div className="h-full w-full overflow-hidden">
      <div className="flex flex-row w-full h-full">
        <SidebarLeft
          selectedCategory={currentCategory}
          categories={Object.keys(props.views)}
          setCurrentCategory={setCurrentCategory}
        />
        <div className="w-full p-2 overflow-y-auto">
          {props.views[currentCategory]}
        </div>
      </div>
    </div>
  );
}

function SidebarLeft(props: {
  categories: string[];
  selectedCategory: string;
  setCurrentCategory: React.Dispatch<React.SetStateAction<string>>;
}) {
  const { categories } = props;

  const handleClick = (category: string) => {
    props.setCurrentCategory(category);
  };

  return (
    <div
      className="p-2 flex flex-col gap-1 overflow-y-auto"
      style={{
        width: "15rem",
      }}
    >
      {categories.map((category) => (
        <div
          className={`break-word sidebar-item animated-gradient ${
            props.selectedCategory === category
              ? "sidebar-selected"
              : "sidebar-unselected"
          }`}
          onClick={() => handleClick(category)}
          key={category}
        >
          <BreakLongUnderscoreNames name={category} />
        </div>
      ))}
    </div>
  );
}
