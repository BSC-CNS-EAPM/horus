import { StructureElement } from "molstar/lib/mol-model/structure";
import { StructureRepresentationRef } from "molstar/lib/mol-plugin-state/manager/structure/hierarchy-state";
import { StructureRepresentationRegistry } from "molstar/lib/mol-repr/structure/registry";
import { ColorTheme } from "molstar/lib/mol-theme/color";
import {
  MolInfoWithRef,
  RepresentationThemeOptions,
  SelectionLanguage
} from "../../horusmolstar";
import { SizeTheme } from "molstar/lib/mol-theme/size";

export interface RepresentationInfo {
  ref: StructureRepresentationRef;
  type: string;
  label: string;
  componentLabel?: string;
}

export interface StructureViewerProps {
  structure: MolInfoWithRef;
}

export type ComponentItem = {
  id: string;
  loci: StructureElement.Loci;
};

export interface AddComponentParams extends RepresentationThemeOptions {
  label: string;
  script?: string;
  language?: SelectionLanguage;
  loci?: StructureElement.Loci;
  opacity?: number;
}

export const REPRESENTATIONS: {
  id: StructureRepresentationRegistry.BuiltIn;
  label: string;
  description: string;
}[] = [
  { id: "cartoon", label: "Cartoon", description: "Cartoon representation" },
  { id: "backbone", label: "Backbone", description: "Backbone trace" },
  {
    id: "ball-and-stick",
    label: "Ball & Stick",
    description: "Ball and stick model"
  },
  {
    id: "carbohydrate",
    label: "Carbohydrate",
    description: "Carbohydrate representation"
  },
  {
    id: "ellipsoid",
    label: "Ellipsoid",
    description: "Ellipsoid representation"
  },
  {
    id: "gaussian-surface",
    label: "Gaussian Surface",
    description: "Gaussian surface"
  },
  {
    id: "gaussian-volume",
    label: "Gaussian Volume",
    description: "Gaussian volume"
  },
  { id: "label", label: "Label", description: "Text labels" },
  { id: "line", label: "Line", description: "Line representation" },
  {
    id: "molecular-surface",
    label: "Molecular Surface",
    description: "Molecular surface"
  },
  {
    id: "orientation",
    label: "Orientation",
    description: "Orientation representation"
  },
  { id: "plane", label: "Plane", description: "Plane representation" },
  { id: "point", label: "Point", description: "Point representation" },
  { id: "putty", label: "Putty", description: "Putty representation" },
  { id: "spacefill", label: "Spacefill", description: "Space-filling model" }
];

export const SELECTION_LANGUAGES: { id: SelectionLanguage; label: string }[] = [
  { id: "vmd", label: "VMD" },
  { id: "pymol", label: "PyMOL" },
  { id: "mol-script", label: "Mol*" }
];

export const COLOR_TYPES: { id: ColorTheme.BuiltIn; label: string }[] = [
  { id: "uniform", label: "Uniform" },
  { id: "element-symbol", label: "Element Symbol" },
  { id: "residue-name", label: "Residue Name" },
  { id: "chain-id", label: "Chain ID" },
  { id: "uncertainty", label: "B-Factor" }
];

export const SIZE_THEME_OPTIONS: { value: SizeTheme.BuiltIn; label: string }[] =
  [
    { value: "uniform", label: "Uniform Size" },
    { value: "physical", label: "Physical Size" },
    { value: "uncertainty", label: "Uncertainty" },
    { value: "volume-value", label: "Volume Value" },
    { value: "shape-group", label: "Shape Group" }
  ];

export type OnChangeRepresentationParams = {
  repRef: StructureRepresentationRef;
  repId: string;
  colorTheme: any;
  sizeTheme: any;
  opacity: number;
};
