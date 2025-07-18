import { useState } from "react";

export interface Tab {
  view: JSX.Element;
  title: string;
  icon?: JSX.Element;
}

interface TabsProps {
  tabs: { [key: string]: Tab };
  disabled?: boolean;
  onTabChange?: (tab: string) => Promise<boolean> | boolean;
}

export function HorusViewTabs({ tabs, disabled, onTabChange }: TabsProps) {
  const tabKeys = Object.keys(tabs);
  const [currentTab, setCurrentTab] = useState<string>(tabKeys[0]!);

  const handleTabChange = async (tab: string) => {
    if (disabled) return;

    if (onTabChange) {
      const canChange = await onTabChange(tab);
      if (!canChange) return;
    }

    setCurrentTab(tab);
  };

  const getCurrentTab = () => {
    let t = tabs[currentTab];

    if (!t) {
      // Default to first tab
      setCurrentTab(tabKeys[0]!);
      t = tabs[tabKeys[0]!]!;
    }

    return t;
  };

  return (
    <div className="overflow-hidden space-y-[-1px] h-full rounded-b-lg">
      <TabSelector
        tabs={tabs}
        currentTab={currentTab}
        setCurrentTab={handleTabChange}
        disabled={disabled}
      />
      <div
        key={currentTab}
        className={`p-4 bg-gray-100 rounded-b-lg rounded-tr-lg ${
          currentTab === tabKeys[0] ? "" : "rounded-tl-lg"
        }`}
        style={{
          height: "calc(100% - 2.5rem)",
        }}
      >
        {getCurrentTab().view}
      </div>
    </div>
  );
}

type TabSelectorProps = TabsProps & {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
};

export function TabSelector({
  tabs,
  currentTab,
  setCurrentTab,
  disabled,
}: TabSelectorProps) {
  const tabKeys = Object.keys(tabs);

  const activeTab =
    "inline-block p-4 text-black bg-gray-100 rounded-t-lg active";
  const inactiveTab =
    "inline-block p-4 rounded-t-lg hover:text-gray-600 hover:bg-gray-50";

  return (
    <ul className="flex flex-row overflow-x-auto text-sm font-medium text-center text-gray-500">
      {tabKeys.map((key) => (
        <li className="me-2" key={key}>
          <button
            aria-current={currentTab === key ? "page" : undefined}
            className={currentTab === key ? activeTab : inactiveTab}
            disabled={disabled}
            onClick={() => setCurrentTab(key)}
          >
            <div className="flex flex-row gap-2 items-center">
              {tabs[key]!.icon}
              {tabs[key]!.title}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
