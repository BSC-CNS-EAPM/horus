// Mol* imports
import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";
import { Color } from "molstar/lib/mol-util/color";
import { StateObjectSelector } from "molstar/lib/mol-state";
import { addOrientedBox } from "molstar/lib/mol-geo/geometry/mesh/builder/box";
import { MeshBuilder } from "molstar/lib/mol-geo/geometry/mesh/mesh-builder";
import { Vec3 } from "molstar/lib/mol-math/linear-algebra";
import { Interval } from "molstar/lib/mol-data/int";
import { Mesh } from "molstar/lib/mol-geo/geometry/mesh/mesh";
import { LocationIterator } from "molstar/lib/mol-geo/util/location-iterator";
import { PickingId } from "molstar/lib/mol-geo/geometry/picking";
import { NullLocation } from "molstar/lib/mol-model/location";
import { EmptyLoci, Loci, DataLoci } from "molstar/lib/mol-model/loci";
import { Structure, Unit } from "molstar/lib/mol-model/structure";
import {
  StructureRepresentation,
  StructureRepresentationProvider,
  StructureRepresentationStateBuilder,
  UnitsRepresentation
} from "molstar/lib/mol-repr/structure/representation";
import {
  Representation,
  RepresentationContext,
  RepresentationParamsGetter
} from "molstar/lib/mol-repr/representation";
import {
  UnitsMeshParams,
  UnitsMeshVisual,
  UnitsVisual
} from "molstar/lib/mol-repr/structure/units-visual";
import { StructureGroup } from "molstar/lib/mol-repr/structure/visual/util/common";
import { VisualUpdateState } from "molstar/lib/mol-repr/util";
import { VisualContext } from "molstar/lib/mol-repr/visual";
import { Theme, ThemeRegistryContext } from "molstar/lib/mol-theme/theme";
import { ParamDefinition as PD } from "molstar/lib/mol-util/param-definition";
import { StructureRepresentationProps } from "molstar/lib/mol-plugin-state/helpers/structure-representation-params";
import { Axes3D } from "molstar/lib/mol-math/geometry";

const DockingBoxVisuals = {
  box: (
    ctx: RepresentationContext,
    getParams: RepresentationParamsGetter<Structure, DockingBoxParams>
  ) => UnitsRepresentation("Docking box mesh", ctx, getParams, DockingBoxVisual)
};

// Parameters that allow us to control the appearance of the box
// addOrientedBox uses the following params:
/*
 *  Axes3D

    origin: Vec3 (center of the cube);
    dirA: Vec3;
    dirB: Vec3;
    dirC: Vec3;
 *  radiusScale
  Numeric (Radious of the vertex that build the box)
 * radialSegments
 Numeric (Number of segments used to build the vertex)

 * 
 */

const DockingBoxParams = {
  ...UnitsMeshParams,
  // Default build parameters

  x0: PD.Numeric(0),
  y0: PD.Numeric(0),
  z0: PD.Numeric(0),
  x1: PD.Numeric(1),
  y1: PD.Numeric(0),
  z1: PD.Numeric(0),
  x2: PD.Numeric(0),
  y2: PD.Numeric(1),
  z2: PD.Numeric(0),
  x3: PD.Numeric(0),
  y3: PD.Numeric(0),
  z3: PD.Numeric(1),
  radiusScale: PD.Numeric(1),
  alpha: PD.Numeric(1, {
    min: 0,
    max: 1,
    step: 0.01
  }),
  radialSegments: PD.Numeric(1)
};

type DockingBoxParams = typeof DockingBoxParams;

// Factory function that creates our Representation object
function DockingBoxVisual(materialId: number): UnitsVisual<DockingBoxParams> {
  return UnitsMeshVisual<DockingBoxParams>(
    {
      // How to get the default props
      defaultProps: PD.getDefaultValues(DockingBoxParams),

      // Function that actually creates the mesh - in our case the box
      createGeometry: createDockingBoxMesh,

      // Iterator function that can retrieve data attached to graphical objects created by this visual.
      //
      // If our visual could draw more than one box, we could give each box a "groupId" and use it
      // to match the boxs with some data.
      createLocationIterator: (structureGroup: StructureGroup) => {
        return LocationIterator(
          // We draw only a single box
          1,

          // The box will be drawn multiple times if the structure it is attached to has more biological units.
          // We need to tell this to the iterator.
          structureGroup.group.units.length,

          1,
          () => NullLocation // We do not have any actual information to attach to the box
        );
      },

      // Create a Loci that represents the box. Locis are Molstar "abstraction" to represent "interactable" objects.
      // Since our docking box is not backed by any actual structure, we can create a DataLoci to make Molstar display some dummy data.
      getLoci: (
        pickingId: PickingId,
        structureGroup: StructureGroup,
        id: number
      ) => {
        const { objectId } = pickingId;
        if (objectId !== id) return EmptyLoci; // Return EmptyLoci if the call was not for us

        return DataLoci(
          // Identifying tag
          "box-data-loci",

          // Data attached to the Loci
          void 0,

          // List of element indices. This must not be empty, otherwise Molstar will ignore the DataLoci
          // This is just a dummy value because we do not have any real data to attach to the box's DataLoci
          [0],

          // Function to calculate a bounding box if the Loci, does not need to be provided
          void 0,

          // Function that creates a label for the Loci. The label is displayed in the UI when the user hovers over
          // the graphical object represented by this Loci.
          () => "Box"
        );

        // You may also just return EmptyLoci. This will make the box non-interactable
        // return EmptyLoci;
      },

      // Rather unfortunately named function. Must be implemented if the boxs are supposed to respond to picking.
      eachLocation: (
        loci: Loci,
        structureGroup: StructureGroup,
        apply: (interval: Interval) => boolean
      ) => {
        if (loci.kind === "data-loci" && loci.tag === "box-data-loci") {
          // This is a nasty hack that will highlight all boxs just to demonstrate what happens
          return apply(Interval.ofBounds(0, 1));
        }
        return false; // You can simply return false, the boxs will then be ignored by picking
      },

      // Utility function to determine if and how to update the mesh
      setUpdateState: (
        state: VisualUpdateState,
        newProps: PD.Values<DockingBoxParams>,
        currentProps: PD.Values<DockingBoxParams>
      ) => {
        state.createGeometry =
          newProps.x0 !== currentProps.x0 ||
          newProps.y0 !== currentProps.y0 ||
          newProps.z0 !== currentProps.z0 ||
          newProps.x1 !== currentProps.x1 ||
          newProps.y1 !== currentProps.y1 ||
          newProps.z1 !== currentProps.z1 ||
          newProps.x2 !== currentProps.x2 ||
          newProps.y2 !== currentProps.y2 ||
          newProps.z2 !== currentProps.z2 ||
          newProps.x3 !== currentProps.x3 ||
          newProps.y3 !== currentProps.y3 ||
          newProps.z3 !== currentProps.z3 ||
          newProps.radiusScale !== currentProps.radiusScale ||
          newProps.alpha !== currentProps.alpha ||
          newProps.radialSegments !== currentProps.radialSegments;
      }
    },
    materialId
  );
}

export type DockingBoxRepresentation =
  StructureRepresentation<DockingBoxParams>;
export function ConfalPyramidsRepresentation(
  ctx: RepresentationContext,
  getParams: RepresentationParamsGetter<Structure, DockingBoxParams>
): DockingBoxRepresentation {
  const repr = Representation.createMulti(
    "Confal Pyramids",
    ctx,
    getParams,
    StructureRepresentationStateBuilder,
    DockingBoxVisuals as unknown as Representation.Def<
      Structure,
      DockingBoxParams
    >
  );
  return repr;
}

export const DockingBoxRepresentationProvider = StructureRepresentationProvider(
  {
    name: "box",
    label: "Box",
    description: "Displays a box at given coordinates",
    factory: ConfalPyramidsRepresentation,
    getParams: (ctx: ThemeRegistryContext, structure: Structure) =>
      PD.clone(DockingBoxParams),
    defaultValues: PD.getDefaultValues(DockingBoxParams),
    defaultColorTheme: { name: "uniform" },
    defaultSizeTheme: { name: "uniform" },
    isApplicable: (structure: Structure) => true // Assume that we can always draw a box
  }
);

function createDockingBoxMesh(
  ctx: VisualContext,
  unit: Unit,
  structure: Structure,
  theme: Theme,
  props: PD.Values<DockingBoxParams>,
  mesh?: Mesh
) {
  const mb = MeshBuilder.createState(16, 16, mesh);

  // We will create only one box.
  // If we were to create multiple boxs in a single mesh, we could set different "currentGroup" value
  // for each box to tell them apart.
  mb.currentGroup = 0;
  const origin = Vec3.create(props.x0, props.y0, props.z0);
  const vec1 = Vec3.create(props.x1, props.y1, props.z1);
  const vec2 = Vec3.create(props.x2, props.y2, props.z2);
  const vec3 = Vec3.create(props.x3, props.y3, props.z3);
  const position = Axes3D.create(origin, vec1, vec2, vec3);

  // Call to addOrientedBox from molstar
  addOrientedBox(mb, position, props.radiusScale, 2, props.radialSegments);

  return MeshBuilder.getMesh(mb);
}

async function addBoxTo(
  ms: PluginUIContext,
  structure: StateObjectSelector,
  box: {
    x0: number;
    y0: number;
    z0: number;
    x1: number;
    y1: number;
    z1: number;
    x2: number;
    y2: number;
    z2: number;
    x3: number;
    y3: number;
    z3: number;
    radiusScale: number;
    color: Color;
    alpha: number;
    radialSegments: number;
  }
) {
  const struc = await ms.builders.structure.representation.addRepresentation(
    structure,
    {
      type: "box" as any, // Coerce TypeScript into accepting the representation name
      typeParams: box,
      colorParams: box.color ? { value: box.color } : void 0
    } as StructureRepresentationProps
  );

  return struc.ref;
}

export { addBoxTo };
