// Mol* imports
import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";
import { Color } from "molstar/lib/mol-util/color";
import { StateObjectSelector } from "molstar/lib/mol-state";
import { addSphere } from "molstar/lib/mol-geo/geometry/mesh/builder/sphere";
import { MeshBuilder } from "molstar/lib/mol-geo/geometry/mesh/mesh-builder";
import { Vec3 } from "molstar/lib/mol-math/linear-algebra";
import { Interval } from "molstar/lib/mol-data/int";
import { Mesh } from "molstar/lib/mol-geo/geometry/mesh/mesh";
import { LocationIterator } from "molstar/lib/mol-geo/util/location-iterator";
import { PickingId } from "molstar/lib/mol-geo/geometry/picking";
import { NullLocation } from "molstar/lib/mol-model/location";
import { EmptyLoci, Loci } from "molstar/lib/mol-model/loci";
import { Structure, Unit } from "molstar/lib/mol-model/structure";
import {
  StructureRepresentation,
  StructureRepresentationProvider,
  StructureRepresentationStateBuilder,
  UnitsRepresentation,
} from "molstar/lib/mol-repr/structure/representation";
import {
  Representation,
  RepresentationContext,
  RepresentationParamsGetter,
} from "molstar/lib/mol-repr/representation";
import {
  UnitsMeshParams,
  UnitsMeshVisual,
  UnitsVisual,
} from "molstar/lib/mol-repr/structure/units-visual";
import { StructureGroup } from "molstar/lib/mol-repr/structure/visual/util/common";
import { VisualUpdateState } from "molstar/lib/mol-repr/util";
import { VisualContext } from "molstar/lib/mol-repr/visual";
import { Theme, ThemeRegistryContext } from "molstar/lib/mol-theme/theme";
import { ParamDefinition as PD } from "molstar/lib/mol-util/param-definition";
import { StructureRepresentationProps } from "molstar/lib/mol-plugin-state/helpers/structure-representation-params";

const DockingSphereVisuals = {
  sphere: (
    ctx: RepresentationContext,
    getParams: RepresentationParamsGetter<Structure, DockingSphereParams>
  ) =>
    UnitsRepresentation(
      "Docking sphere mesh",
      ctx,
      getParams,
      DockingSphereVisual
    ),
};

// Parameters that allow us to control the appearance of the sphere
const DockingSphereParams = {
  ...UnitsMeshParams,
  x: PD.Numeric(0),
  y: PD.Numeric(0),
  z: PD.Numeric(0),
  radius: PD.Numeric(1),
  alpha: PD.Numeric(1, {
    min: 0,
    max: 1,
    step: 0.01,
  }),
};
type DockingSphereParams = typeof DockingSphereParams;

// Factory function that creates our Representation object
function DockingSphereVisual(
  materialId: number
): UnitsVisual<DockingSphereParams> {
  return UnitsMeshVisual<DockingSphereParams>(
    {
      // How to get the default props
      defaultProps: PD.getDefaultValues(DockingSphereParams),

      // Function that actually creates the mesh - in our case the sphere
      createGeometry: createDockingSphereMesh,

      // Iterator function that can retrieve data attached to graphical objects created by this visual.
      //
      // If our visual could draw more than one sphere, we could give each sphere a "groupId" and use it
      // to match the spheres with some data.
      createLocationIterator: (structureGroup: StructureGroup) => {
        return LocationIterator(
          // We draw only a single sphere
          1,

          // The sphere will be drawn multiple times if the structure it is attached to has more biological units.
          // We need to tell this to the iterator.
          structureGroup.group.units.length,

          1,
          () => NullLocation // We do not have any actual information to attach to the sphere
        );
      },

      // Create a Loci that represents the sphere. Locis are Molstar "abstraction" to represent "interactable" objects.
      // Since our docking sphere is not backed by any actual structure, we can create a DataLoci to make Molstar display some dummy data.
      getLoci: (
        pickingId: PickingId,
        structureGroup: StructureGroup,
        id: number
      ) => {
        // const { objectId } = pickingId;
        // if (objectId !== id) return EmptyLoci; // Return EmptyLoci if the call was not for us

        // return DataLoci(
        //     // Identifying tag
        //     'sphere-data-loci',

        //     // Data attached to the Loci
        //     void 0,

        //     // List of element indices. This must not be empty, otherwise Molstar will ignore the DataLoci
        //     // This is just a dummy value because we do not have any real data to attach to the sphere's DataLoci
        //     [0],

        //     // Function to calculate a bounding sphere if the Loci, does not need to be provided
        //     void 0,

        //     // Function that creates a label for the Loci. The label is displayed in the UI when the user hovers over
        //     // the graphical object represented by this Loci.
        //     () => "Yo, I'm a sphere!"
        // );

        // You may also just return EmptyLoci. This will make the sphere non-interactable
        return EmptyLoci;
      },

      // Rather unfortunately named function. Must be implemented if the spheres are supposed to respond to picking.
      eachLocation: (
        loci: Loci,
        structureGroup: StructureGroup,
        apply: (interval: Interval) => boolean
      ) => {
        return false; // You can simply return false, the spheres will then be ignored by picking
      },

      // Utility function to determine if and how to update the mesh
      setUpdateState: (
        state: VisualUpdateState,
        newProps: PD.Values<DockingSphereParams>,
        currentProps: PD.Values<DockingSphereParams>
      ) => {
        state.createGeometry =
          newProps.x !== currentProps.x ||
          newProps.y !== currentProps.y ||
          newProps.z !== currentProps.z ||
          newProps.radius !== currentProps.radius ||
          newProps.alpha !== currentProps.alpha;
      },
    },
    materialId
  );
}

export type DockingSphereRepresentation =
  StructureRepresentation<DockingSphereParams>;
export function ConfalPyramidsRepresentation(
  ctx: RepresentationContext,
  getParams: RepresentationParamsGetter<Structure, DockingSphereParams>
): DockingSphereRepresentation {
  const repr = Representation.createMulti(
    "Confal Pyramids",
    ctx,
    getParams,
    StructureRepresentationStateBuilder,
    DockingSphereVisuals as unknown as Representation.Def<
      Structure,
      DockingSphereParams
    >
  );
  return repr;
}

export const DockingSphereRepresentationProvider =
  StructureRepresentationProvider({
    name: "sphere",
    label: "Sphere",
    description: "Displays a sphere at given coordinates",
    factory: ConfalPyramidsRepresentation,
    getParams: (ctx: ThemeRegistryContext, structure: Structure) =>
      PD.clone(DockingSphereParams),
    defaultValues: PD.getDefaultValues(DockingSphereParams),
    defaultColorTheme: { name: "uniform" },
    defaultSizeTheme: { name: "uniform" },
    isApplicable: (structure: Structure) => true, // Assume that we can always draw a sphere
  });

function createDockingSphereMesh(
  ctx: VisualContext,
  unit: Unit,
  structure: Structure,
  theme: Theme,
  props: PD.Values<DockingSphereParams>,
  mesh?: Mesh
) {
  const mb = MeshBuilder.createState(16, 16, mesh);

  // We will create only one sphere.
  // If we were to create multiple spheres in a single mesh, we could set different "currentGroup" value
  // for each sphere to tell them apart.
  mb.currentGroup = 0;

  const position = Vec3();
  position[0] = props.x;
  position[1] = props.y;
  position[2] = props.z;

  addSphere(mb, position, props.radius, 2);

  return MeshBuilder.getMesh(mb);
}

async function addSphereTo(
  ms: PluginUIContext,
  structure: StateObjectSelector,
  sphere: {
    x: number;
    y: number;
    z: number;
    radius: number;
    color: Color;
    alpha: number;
  }
) {
  const struc = await ms.builders.structure.representation.addRepresentation(
    structure,
    {
      type: "sphere" as any, // Coerce TypeScript into accepting the representation name
      typeParams: sphere,
      colorParams: sphere.color ? { value: sphere.color } : void 0,
    } as StructureRepresentationProps
  );

  return struc.ref;
}

export { addSphereTo };
