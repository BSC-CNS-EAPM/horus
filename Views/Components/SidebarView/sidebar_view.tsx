// React
import { useEffect, useMemo, useState } from "react";

// Components
import { BreakLongUnderscoreNames } from "../FlowBuilder/Blocks/block.view";
import { Tab } from "../Tabs";

// Styles
import "./sidebar.css";

type SidebarViewProps = {
  views?: {
    [key: string]: JSX.Element[] | React.ReactNode[];
  };
  tabs?: {
    [key: string]: Tab;
  };
};

export default function SidebarView(props: SidebarViewProps) {
  const { views, tabs } = props;

  const parsedViews = useMemo(() => {
    if (tabs) {
      return tabs;
    }

    // Convert views to tabs
    const newTabs: {
      [key: string]: Tab;
    } = {};

    for (const k in views) {
      newTabs[k] = {
        view: views[k]![0]! as JSX.Element,
        title: k
      };
    }

    return newTabs;
  }, [views, tabs]);

  const [currentCategory, setCurrentCategory] = useState(
    Object.keys(parsedViews)[0]!
  );

  useEffect(() => {
    const viewKeys = Object.keys(parsedViews);

    if (!viewKeys.includes(currentCategory) && viewKeys.length) {
      setCurrentCategory(Object.keys(parsedViews)[0]!);
    }
  }, [parsedViews, currentCategory]);

  return (
    <div className="h-full w-full overflow-hidden">
      <div className="flex flex-row w-full h-full">
        <SidebarLeft
          selectedCategory={currentCategory}
          categories={parsedViews}
          setCurrentCategory={setCurrentCategory}
        />
        <div className="w-full overflow-y-auto">
          {parsedViews[currentCategory]?.view ?? (
            <div className="grid place-items-center h-full">Empty view</div>
          )}
        </div>
      </div>
    </div>
  );
}

function SidebarLeft(props: {
  categories: {
    [key: string]: Tab;
  };
  selectedCategory: string;
  setCurrentCategory: React.Dispatch<React.SetStateAction<string>>;
}) {
  const { selectedCategory, categories, setCurrentCategory } = props;

  return (
    <div className="min-w-[200px] p-2 flex flex-col gap-1 overflow-y-auto">
      {Object.keys(categories).map((category) => (
        <div
          className={`break-word sidebar-item animated-gradient flex flex-row gap-2 ${
            selectedCategory === category
              ? "sidebar-selected"
              : "sidebar-unselected"
          }`}
          onClick={() => {
            setCurrentCategory(category);
          }}
          key={category}
        >
          {categories[category]?.icon}
          <BreakLongUnderscoreNames
            name={categories[category]?.title ?? "Unnamed"}
          />
        </div>
      ))}
    </div>
  );
}
