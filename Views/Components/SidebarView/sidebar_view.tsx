import { useState } from "react";

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
    <div className="h-full w-full overflow-hidden overflow-y-scroll">
      <div className="flex flex-row w-full h-full overflow-y-scroll">
        <SidebarLeft
          selectedCategory={currentCategory}
          categories={Object.keys(props.views)}
          setCurrentCategory={setCurrentCategory}
        />
        <div className="w-full p-2 overflow-y-scroll">
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
      className="p-2 flex flex-col gap-1 overflow-y-scroll"
      style={{
        width: "15rem",
      }}
    >
      {categories.map((category) => (
        <div
          className={`sidebar-item animated-gradient ${
            props.selectedCategory === category
              ? "sidebar-selected"
              : "sidebar-unselected"
          }`}
          onClick={() => handleClick(category)}
          key={category}
        >
          {category}
        </div>
      ))}
    </div>
  );
}
