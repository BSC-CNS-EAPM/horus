import { useState, useRef } from "react";
import HorusMolstar, { MolInfoWithRef } from "../../horusmolstar";
import { MovingChevron } from "@/Components/reusable";
import { ComponentItem } from "./ComponentItem";
import { RepresentationForm } from "./RepresentationForm";
import { AddComponentParams } from "./types";

interface ComponentsSectionProps {
  structure: MolInfoWithRef;
  onAddComponent: (params: AddComponentParams) => void;
}

export function ComponentsSection({
  structure,
  onAddComponent
}: ComponentsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formSelection, setFormSelection] = useState("");
  const [formLoci, setFormLoci] = useState<any>(null);
  const [expandedChains, setExpandedChains] = useState<Set<string>>(new Set());
  const [expandedResidueGroups, setExpandedResidueGroups] = useState<
    Set<string>
  >(new Set());
  const [expandedHeteroGroups, setExpandedHeteroGroups] = useState<Set<string>>(
    new Set()
  );

  const dropdownRef = useRef<HTMLDivElement>(null);
  const molstar = window.molstar as HorusMolstar;
  const components = molstar.getStructureInfo(structure.structureRef);

  // useClickOutside(dropdownRef, () => {
  //   if (isExpanded && !showForm) {
  //     setIsExpanded(false);
  //   }
  // });

  const handleAddRepresentation = (selection: string, loci?: any) => {
    setFormSelection(selection);
    setFormLoci(loci);
    setShowForm(true);
  };

  const handleFormSubmit = (params: AddComponentParams) => {
    onAddComponent(params);
    setShowForm(false);
    setFormSelection("");
    setFormLoci(null);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setFormSelection("");
    setFormLoci(null);
  };

  const toggleChainExpansion = (chainId: string) => {
    const newExpanded = new Set(expandedChains);
    if (newExpanded.has(chainId)) {
      newExpanded.delete(chainId);
    } else {
      newExpanded.add(chainId);
    }
    setExpandedChains(newExpanded);
  };

  const toggleResidueGroupExpansion = (chainId: string) => {
    const key = `${chainId}_residues`;
    const newExpanded = new Set(expandedResidueGroups);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedResidueGroups(newExpanded);
  };

  const toggleHeteroGroupExpansion = (chainId: string) => {
    const key = `${chainId}_hetero`;
    const newExpanded = new Set(expandedHeteroGroups);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedHeteroGroups(newExpanded);
  };

  const totalComponents =
    (components?.chains?.length || 0) +
    (components?.chains.reduce(
      (acc, c) => acc + c.residues.length + c.hetero.length,
      0
    ) || 0);

  return (
    <div className="space-y-2" ref={dropdownRef}>
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-1 text-sm font-medium text-gray-600 hover:text-gray-800"
        >
          <MovingChevron down={isExpanded} />
          <span>Components ({totalComponents})</span>
        </button>
      </div>

      {isExpanded && (
        <div className="pl-4 space-y-3">
          {showForm && (
            <RepresentationForm
              onAddComponent={handleFormSubmit}
              onCancel={handleFormCancel}
              initialSelection={formSelection}
              initialLoci={formLoci}
            />
          )}

          {!showForm && (
            <>
              {components?.chains && components.chains.length > 0 && (
                <div className="space-y-1">
                  {components.chains.map((chain) => (
                    <div key={chain.id} className="border-l-2 border-gray-200">
                      {/* Chain Level */}
                      <div className="flex items-center space-x-1 pl-2">
                        <button
                          onClick={() => toggleChainExpansion(chain.id)}
                          className="flex items-center space-x-1"
                        >
                          <MovingChevron down={expandedChains.has(chain.id)} />
                        </button>
                        <ComponentItem
                          item={chain}
                          onAddRepresentation={handleAddRepresentation}
                          label={`Chain ${chain.id}`}
                        />
                      </div>

                      {/* Chain Contents */}
                      {expandedChains.has(chain.id) && (
                        <div className="ml-6 space-y-1 border-l-2 border-gray-100">
                          {/* Residues Section */}
                          {chain.residues && chain.residues.length > 0 && (
                            <div>
                              <div className="flex items-center space-x-1 pl-2">
                                <button
                                  onClick={() =>
                                    toggleResidueGroupExpansion(chain.id)
                                  }
                                  className="flex items-center space-x-1 text-xs text-gray-500 hover:text-gray-700"
                                >
                                  <MovingChevron
                                    down={expandedResidueGroups.has(
                                      `${chain.id}_residues`
                                    )}
                                  />
                                  <span className="font-bold">
                                    Residues ({chain.residues.length})
                                  </span>
                                </button>
                              </div>

                              {expandedResidueGroups.has(
                                `${chain.id}_residues`
                              ) && (
                                <div className="ml-4 space-y-1 max-h-32 overflow-y-auto border-l-2 border-blue-100">
                                  {chain.residues.map((residue) => (
                                    <div key={residue.id} className="pl-2">
                                      <ComponentItem
                                        item={residue}
                                        onAddRepresentation={
                                          handleAddRepresentation
                                        }
                                        compact={true}
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Hetero Residues Section */}
                          {chain.hetero && chain.hetero.length > 0 && (
                            <div>
                              <div className="flex items-center space-x-1 pl-2">
                                <button
                                  onClick={() =>
                                    toggleHeteroGroupExpansion(chain.id)
                                  }
                                  className="flex items-center space-x-1 text-xs text-gray-500 hover:text-gray-700"
                                >
                                  <MovingChevron
                                    down={expandedHeteroGroups.has(
                                      `${chain.id}_hetero`
                                    )}
                                  />
                                  <span className="font-bold">
                                    Ligands ({chain.hetero.length})
                                  </span>
                                </button>
                              </div>

                              {expandedHeteroGroups.has(
                                `${chain.id}_hetero`
                              ) && (
                                <div className="ml-4 space-y-1 max-h-32 overflow-y-auto border-l-2 border-orange-100">
                                  {chain.hetero.map((hetero) => (
                                    <div key={hetero.id} className="pl-2">
                                      <ComponentItem
                                        item={hetero}
                                        onAddRepresentation={
                                          handleAddRepresentation
                                        }
                                        compact={true}
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
