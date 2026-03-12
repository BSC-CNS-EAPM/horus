import { useEffect, useState } from "react";
import {
  CustomBlockEditor,
  BlockTypes,
  PluginVariable,
  PluginVariableTypes
} from "../flow.types";
import { HorusViewTabs, Tab } from "@/Components/Tabs";
import { Editor } from "@monaco-editor/react";
import AppButton from "@/Components/appbutton";
import { horusDelete, horusPost } from "@/Utils/utils";
import RotatingLines from "@/Components/RotatingLines/rotatinglines";
import { queryClient } from "@/Main";
import { BlurredModal } from "@/Components/reusable";
import { socket } from "@/Utils/socket";
import { HorusLazyLog } from "@/Components/HorusLazyLog/HorusLazyLog";

const NEW_BLOCK: CustomBlockEditor = {
  id: "new_block",
  name: "New Block",
  description: "A new block to be defined",
  type: BlockTypes.ACTION,
  category: null,
  variables: [],
  outputs: [],
  inputs: [],
  action:
    'from HorusAPI import PluginBlock\n\ndef blockAction(block: PluginBlock):\n    print("A custom block")',
  finalAction: "def finalAction(block: SlurmBlock):\n    print('Final action')",
  dependencies: [],
  isCustom: true
};

export function BlockEditor({
  block,
  onBlockChange
}: {
  block?: CustomBlockEditor;
  onBlockChange?: (block: CustomBlockEditor) => void;
}) {
  const [editingBlock, setEditingBlock] = useState<CustomBlockEditor>(
    block || NEW_BLOCK
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleBlockChange = (block: CustomBlockEditor) => {
    setEditingBlock(block);
    onBlockChange?.(block);
  };

  const handleAddBlock = async () => {
    setIsSaving(true);
    const response = await horusPost(
      "/api/plugins/custom-block",
      null,
      JSON.stringify({
        block: editingBlock
      })
    )
      .then((res) => res.json())

      .finally(() => setIsSaving(false));

    if (response.ok) {
      alert("Block saved successfully");

      // Invalidate the cahe for the "blicklist" query
      queryClient.invalidateQueries({ queryKey: ["blocklist"] });
    } else {
      alert(`Failed to save block: ${response.msg}`);
    }
  };

  const handleBlockExport = async () => {
    // Generate a .json file with the block data content for download
    const blob = new Blob([JSON.stringify(editingBlock, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${editingBlock.id || "block"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBlockRemove = async () => {
    setIsRemoving(true);
    const response = await horusDelete({
      url: `/api/plugins/custom-block`,
      body: { blockId: editingBlock.id }
    })
      .then((res) => res.json())
      .finally(() => setIsRemoving(false));

    if (response.ok) {
      alert("Block removed successfully. Switching to new block.");
      setEditingBlock(NEW_BLOCK); // Reset to new block

      queryClient.invalidateQueries({ queryKey: ["blocklist"] });
    } else {
      alert(`Failed to remove block: ${response.msg}`);
    }
  };

  const EDITOR_TABS: Record<string, Tab> = {
    "block-editor": {
      title: "Visual Editor",
      view: (
        <VisualBlockEditor
          block={editingBlock}
          onBlockChange={handleBlockChange}
        />
      )
    },
    "block-json": {
      title: "JSON Editor",
      view: (
        <JSONBlockEditor
          block={editingBlock}
          onBlockChange={handleBlockChange}
        />
      )
    }
  };

  const isSavingOrRemoving = isSaving || isRemoving;

  return (
    <div className="flex flex-col w-full h-full bg-white">
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Block Editor</h1>
            <p className="text-gray-600 mt-1">
              Create and customize your workflow blocks
            </p>
          </div>
          <div className="flex space-x-2">
            <AppButton action={handleBlockExport} disabled={isSavingOrRemoving}>
              Export
            </AppButton>
            <AppButton action={handleBlockRemove} disabled={isSavingOrRemoving}>
              Remove
            </AppButton>
            <AppButton action={handleAddBlock} disabled={isSavingOrRemoving}>
              Save
            </AppButton>
          </div>
        </div>
      </div>
      <div className="p-2 overflow-y-auto flex-1">
        {isSavingOrRemoving ? (
          <div className="grid place-items-center">
            <RotatingLines />
          </div>
        ) : (
          <HorusViewTabs tabs={EDITOR_TABS} />
        )}
      </div>

      <BlockDepsLog
        key={editingBlock.dependencies?.toString()}
        show={
          !!(
            isSaving &&
            editingBlock.dependencies &&
            editingBlock?.dependencies?.length > 0
          )
        }
      />
    </div>
  );
}

function VisualBlockEditor({
  block,
  onBlockChange
}: {
  block: CustomBlockEditor;
  onBlockChange: (block: CustomBlockEditor) => void;
}) {
  const [action, setAction] = useState(block.action || "");
  const [finalAction, setFinalAction] = useState(block.finalAction || "");
  const [editingPipDependencies, setEditingPipDependencies] = useState(
    block.dependencies?.join(", ") || ""
  );

  const updateBlock = (updates: Partial<CustomBlockEditor>) => {
    onBlockChange({ ...block, ...updates });
  };

  const handleActionChange = (value: string | undefined) => {
    const newCode = value || "";
    setAction(newCode);
    updateBlock({ action: newCode });
  };

  const handleFinalActionChange = (value: string | undefined) => {
    const newCode = value || "";
    setFinalAction(newCode);
    updateBlock({ finalAction: newCode });
  };

  return (
    <div className="flex h-full">
      {/* Left Panel - Configuration */}
      <div className="w-1/2 border-r border-gray-200 p-6 overflow-y-auto">
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Basic Information
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Block ID
                </label>
                <p className="text-sm text-gray-500">
                  Can only contain letters, numbers, and underscores
                </p>
                <input
                  type="text"
                  value={block.id}
                  onChange={(e) => {
                    // Filter spaces, special characters
                    const filtered = e.target.value.replace(
                      /[^a-zA-Z0-9-_]/g,
                      ""
                    );
                    updateBlock({ id: filtered });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Unique ID..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Block Name
                </label>
                <input
                  type="text"
                  value={block.name}
                  onChange={(e) => updateBlock({ name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Enter block name..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={block.description}
                  onChange={(e) => updateBlock({ description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                  placeholder="Describe what this block does..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <input
                  type="text"
                  value={block.category || ""}
                  onChange={(e) => updateBlock({ category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Enter block category..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Block Type
                </label>
                <select
                  value={block.type}
                  onChange={(e) =>
                    updateBlock({ type: e.target.value as BlockTypes })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value={BlockTypes.ACTION}>Action</option>
                  <option value={BlockTypes.SLURM}>Slurm</option>
                  <option value={BlockTypes.INPUT}>Input</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PIP Dependencies
                </label>
                <input
                  type="text"
                  value={editingPipDependencies}
                  onChange={(e) => {
                    setEditingPipDependencies(e.target.value);
                    updateBlock({
                      dependencies: e.target.value
                        .split(",")
                        .map((dep) => dep.trim())
                        .filter((dep) => dep)
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Enter PIP dependencies, comma-separated..."
                />
              </div>
            </div>
          </div>

          {/* Block Configuration */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Variables, inputs & outputs
            </h3>

            <div className="space-y-4">
              {/* Variables Section */}
              <VariableListEditor
                title="Variables"
                items={block.variables || []}
                onItemsChange={(variables) => updateBlock({ variables })}
              />

              {/* Inputs Section - Only for non-input blocks */}
              {block.type !== BlockTypes.INPUT && (
                <VariableListEditor
                  title="Inputs"
                  items={block.inputs || []}
                  onItemsChange={(inputs) => updateBlock({ inputs })}
                />
              )}

              {/* Outputs Section */}
              <VariableListEditor
                title="Outputs"
                items={block.outputs || []}
                onItemsChange={(outputs) => updateBlock({ outputs })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Code Editor */}
      <div className="w-1/2 flex flex-col">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Block action</h3>
          <p className="text-sm text-gray-600 mt-1">
            The action that the block will perform when executed. A Python
            function with the name <code>blockAction</code> is required.
          </p>
        </div>
        <div className="flex-1">
          <Editor
            height={block.type === BlockTypes.SLURM ? "45%" : "100%"}
            language={"python"}
            value={action}
            onChange={handleActionChange}
          />
          {block.type === BlockTypes.SLURM && (
            <>
              <p className="text-sm text-gray-500 my-2 px-6">
                After the SLURM job finishes, the following action will execute.
              </p>
              <Editor
                height="45%"
                language="python"
                value={finalAction}
                onChange={handleFinalActionChange}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function VariableListEditor({
  title,
  items,
  onItemsChange
}: {
  title: string;
  items: PluginVariable[];
  onItemsChange: (items: PluginVariable[]) => void;
}) {
  const createNewItem = () => {
    // Full variable structure
    return {
      name: "",
      id: "unique_variable_id",
      description: "",
      type: "string",
      defaultValue: "",
      category: "",
      disabled: false,
      required: false,
      placeholder: "",
      showInCanvas: false
    } as PluginVariable;
  };

  const updateItem = (index: number, updates: Partial<PluginVariable>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates } as PluginVariable;
    onItemsChange(newItems);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onItemsChange(newItems);
  };

  const addItem = () => {
    onItemsChange([...items, createNewItem()]);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">
          {title}
        </label>
        <button
          onClick={addItem}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          + Add {title.slice(0, -1)}
        </button>
      </div>
      <div className={`space-y-3 max-h-64 overflow-y-auto`}>
        {items.map((item, index) => (
          <div
            key={index}
            className="p-3 bg-gray-50 rounded border border-gray-200"
          >
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input
                type="text"
                placeholder="Name"
                value={item.name || ""}
                onChange={(e) => updateItem(index, { name: e.target.value })}
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="ID"
                value={item.id || ""}
                onChange={(e) => {
                  // Filter spaces, special characters
                  const filteredValue = e.target.value.replace(
                    /[^a-zA-Z0-9_]/g,
                    ""
                  );
                  updateItem(index, { id: filteredValue });
                }}
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="mb-2">
              <textarea
                placeholder="Description"
                value={item.description || ""}
                rows={2}
                onChange={(e) =>
                  updateItem(index, { description: e.target.value })
                }
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2">
              <select
                value={item.type || "string"}
                onChange={(e) =>
                  updateItem(index, {
                    type: e.target.value as PluginVariableTypes
                  })
                }
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
              >
                {Object.keys(PluginVariableTypes).map((type) => {
                  if (type === "_LIST") return null; // Skip _LIST type for now
                  return (
                    <option
                      key={
                        PluginVariableTypes[
                          type as keyof typeof PluginVariableTypes
                        ]
                      }
                      value={
                        PluginVariableTypes[
                          type as keyof typeof PluginVariableTypes
                        ]
                      }
                    >
                      {type}
                    </option>
                  );
                })}
              </select>

              <input
                type="text"
                placeholder="Category"
                value={item.category || ""}
                onChange={(e) =>
                  updateItem(index, { category: e.target.value })
                }
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2">
              <input
                type="text"
                placeholder="Default value"
                value={item.defaultValue || ""}
                onChange={(e) =>
                  updateItem(index, { defaultValue: e.target.value })
                }
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
              />

              <input
                type="text"
                placeholder="Placeholder text"
                value={item.placeholder || ""}
                onChange={(e) =>
                  updateItem(index, { placeholder: e.target.value })
                }
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Allowed Values for radio types */}
            {item.type === "radio" && (
              <div className="mb-2">
                <input
                  type="text"
                  placeholder="Allowed values (comma-separated)"
                  value={(item.allowedValues || []).join(", ")}
                  onChange={(e) =>
                    updateItem(index, {
                      allowedValues: e.target.value
                        .split(",")
                        .map((v) => v.trim())
                        .filter((v) => v)
                    })
                  }
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={item.required || false}
                    onChange={(e) =>
                      updateItem(index, { required: e.target.checked })
                    }
                    className="mr-1"
                  />
                  Required
                </label>

                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={item.disabled || false}
                    onChange={(e) =>
                      updateItem(index, { disabled: e.target.checked })
                    }
                    className="mr-1"
                  />
                  Disabled
                </label>
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={item.showInCanvas || false}
                    onChange={(e) =>
                      updateItem(index, { showInCanvas: e.target.checked })
                    }
                    className="mr-1"
                  />
                  Show in Canvas
                </label>
              </div>

              <button
                onClick={() => removeItem(index)}
                className="text-red-600 hover:text-red-700 text-sm px-2 py-1"
              >
                ✕ Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function JSONBlockEditor({
  block,
  onBlockChange
}: {
  block: CustomBlockEditor;
  onBlockChange: (block: CustomBlockEditor) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [block]);

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-gray-200 px-6 py-4">
        <h3 className="text-lg font-semibold text-gray-900">JSON Editor</h3>
        <p className="text-sm text-gray-600 mt-1">
          Edit the block configuration directly as JSON. Drag & Drop is
          supported.
        </p>
        {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
      </div>
      <div
        className="flex-1"
        onDrop={(e) => {
          e.preventDefault();
          const data = e.dataTransfer.files[0];
          if (data) {
            const reader = new FileReader();
            reader.onload = (event) => {
              try {
                const parsedBlock = JSON.parse(
                  event.target?.result?.toString() || "{}"
                );
                onBlockChange(parsedBlock);
              } catch (error) {
                console.error("Invalid JSON", error);
                setError("Invalid JSON");
              }
            };
            reader.readAsText(data);
          }
        }}
      >
        <Editor
          height="100%"
          language="json"
          value={JSON.stringify(block, null, 2)}
          onChange={(value) => {
            if (value) {
              try {
                const parsedBlock = JSON.parse(value);
                onBlockChange(parsedBlock);
              } catch (error) {
                setError("Invalid JSON");
              }
            }
          }}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: "on",
            wordWrap: "on",
            automaticLayout: true,
            scrollBeyondLastLine: false,
            padding: { top: 16, bottom: 16 }
          }}
        />
      </div>
    </div>
  );
}

function BlockDepsLog({ show }: { show: boolean }) {
  const [logs, setLogs] = useState<string>("");

  useEffect(() => {
    const updateText = (text: string) => {
      setLogs((prevLogs) => prevLogs + text);
    };

    // When recieving a message from the server, log it to the console
    socket.on("installPluginDep", updateText);

    return () => {
      socket.off("installPluginDep", updateText);
    };
  }, []);
  return (
    <BlurredModal
      show={show}
      onHide={() => {}}
      overRoot
      maxContentSize={{
        height: "80vh",
        width: "80vw"
      }}
    >
      <div className="p-4 flex flex-col h-full">
        <h3 className="text-lg font-semibold">Installing Block Dependencies</h3>
        <HorusLazyLog logText={logs || "No logs available"} />
      </div>
    </BlurredModal>
  );
}
