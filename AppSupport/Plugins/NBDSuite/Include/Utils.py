"""
Utilities for the NBDSuite plugin.
"""

import typing


def slurmScript(name, cpus, suiteEnvPath="/shared/work/NBDSuite/envs/nbdsuite-0.0.1rc1"):
    """
    Generate the SLURM script for the simulation.
    """
    return f"""#!/bin/bash
#SBATCH -J {name}-horus
#SBATCH --output={name}-horus%j.out
#SBATCH --error={name}-horus%j.err
#SBATCH --ntasks={cpus}
#SBATCH --mem-per-cpu=1000
#SBATCH --nodes=1
#SBATCH --time=01:00:00

## Load user .bashrc
source ~/.bashrc

## Miniconda
ml Miniconda3

## PELE
ml PELE
ml Schrodinger

## Rdock
ml rDock

## NBD Suite
source activate {suiteEnvPath}

python -u -m nbdsuite.main {name}.yaml

"""


class BaseNBDSuiteInput:
    """
    Base class for the NBDSuite inputs (Do not use directly)
    """

    def toYaml(self) -> str:
        """
        Parsed the input to a yaml file (string)
        """
        return "BaseNBDSuiteInput"

    def __str__(self):
        return self.toYaml()


class GeneralInput(BaseNBDSuiteInput):
    """
    The general input block.
    """

    isComplex: bool = False

    systemDataInput = ""
    ligandDataInput = ""
    nameInput = ""
    staticNameInput = ""
    cpusInput = 2
    verbosityInput = ""

    def toYaml(self) -> str:
        return f"""{self._inputsInput()}
name: {self.nameInput}
static_name: {self.staticNameInput}
cpus: {self.cpusInput}
verbosity: {self.verbosityInput}
pipeline:"""

    def _inputsInput(self) -> str:
        if self.isComplex:
            return self._complexInput()
        else:
            return self._systemInput()

    def _systemInput(self) -> str:
        return f"""system_data: {self.systemDataInput}
ligand_data: {self.ligandDataInput}"""

    def _complexInput(self) -> str:
        return f"""complex_data: {self.systemDataInput}
complex_ligand_selection: {self.ligandDataInput}"""


class TopologyExtractorInput(BaseNBDSuiteInput):
    """
    The topology extractor input block.
    """

    checkTopologyInput = ""
    explicitHInSmilesInput = ""
    removeImplicitHydrogenInput = ""
    fixStructuresInput = ""
    assembleConformationsInput = ""

    def toYaml(self) -> str:
        return f"""- block: topology_extractor
  options:
    check_topology: {self.checkTopologyInput}
    explicit_h_in_smiles: {self.explicitHInSmilesInput}
    remove_implicit_hydrogen: {self.removeImplicitHydrogenInput}
    fix_structures: {self.fixStructuresInput}
    assemble_conformations: {self.assembleConformationsInput}"""


class TopologyFixerInput(BaseNBDSuiteInput):
    """
    The topology fixer input block.
    """

    dropWaterInput = ""
    repairHeavyAtomsInput = ""
    protonationPHInput = ""
    hetResiduesToDropInput = ""
    chainIDsToDropInput = ""
    fixSystemsInput = ""
    fixLigandsInput = ""

    def toYaml(self) -> str:
        """
        Parsed the input to a yaml file (string)
        """
        return f"""- block: topology_fixer
  options:
    drop_water: {self.dropWaterInput}
    repair_heavy_atoms: {self.repairHeavyAtomsInput}
    protonation_ph: {self.protonationPHInput}
    het_residues_to_drop: {self.hetResiduesToDropInput}
    chain_ids_to_drop: {self.chainIDsToDropInput}
    fix_systems: {self.fixSystemsInput}
    fix_ligands: {self.fixLigandsInput}"""


class FlowInducedFitDockingInput(BaseNBDSuiteInput):
    """
    The flow induced fit docking input block.
    """

    dropWaterInput = ""
    repairHeavyAtomsInput = ""
    protonationPHInput = ""
    hetResiduesToDropInput = ""
    chainIDsToDropInput = ""
    fixSystemsInput = ""
    fixLigandsInput = ""
    dockingCenterInput = ""
    dockingRadiusInput = ""
    ligandResolutionInput = ""
    sideChainPredictionResolutionInput = ""
    forceFieldInput = ""
    peleSolventInput = ""
    stepsInput = ""
    epochsInput = ""
    flexibleRegionRadiusIFDInput = ""
    frozenRegionRadiusIFDInput = ""
    rdockIterationsInput = 50

    def toYaml(self) -> str:
        """
        Parsed the input to a yaml file (string)
        """
        return f"""- flow: induced_fit_docking
  options:
    rdock_iterations: {self.rdockIterationsInput}
    docking_center: {self.dockingCenterInput}
    docking_radius: {self.dockingRadiusInput}
    max_conformations_to_take: 5
    pele_forcefield: {self.forceFieldInput}
    pele_solvent: {self.peleSolventInput}
    pele_ligand_resolution: {self.ligandResolutionInput}
    pele_minimizer_ediff: 1.0
    pele_minimizer_rmstol: 1.0
    pele_minimizer_maxit: 1
    pele_trajectory_format: xtc
    pele_perturbation_level: 2
    pele_backbone_constraints_level: 3
    pele_steps: {self.stepsInput}
    pele_temperature: 1500
    pele_anm_frequency: 0
    pele_minimization_frequency: 1
    pele_side_chain_prediction_frequency: 2
    pele_side_chain_prediction_region_radius: 6
    pele_activate_proximity_detection: true
    pele_perturbation_COM_constraint_constant: 1.0
    pele_perturbation_type: naive
    pele_perturbation_translation_direction: steered
    pele_perturbation_rotation_angles: nonCoupled
    pele_perturbation_overlap_factor: 0.65
    pele_perturbation_influence_range: 3
    pele_perturbation_perturb_all_at_once: false
    pele_perturbation_box_type: sphericalBox
    pele_perturbation_box_radius: 5.0
    pele_minimizer_algorithm: TruncatedNewton
    pele_minimizer_non_bonding_list_updated_each_min_step: true
    pele_minimizer_alpha_updated: false
    activate_pele_minimum_steps: true
    disable_pele_minimization: false
    disable_pele_anm: false
    combine_pele_results_across_blocks: false
    pele_representatives_criterion: interaction_min
    pele_side_chain_prediction_resolution: {self.sideChainPredictionResolutionInput}
    pele_charge_method: opls2005
    set_unique_pdb_atom_names: true
    fix_side_chains: true
    mutable_residues: false
    disable_failed_topologies: false
    adaptive_epochs: {self.epochsInput}
    flexible_region_radius: {self.flexibleRegionRadiusIFDInput}
    frozen_region_radius: {self.frozenRegionRadiusIFDInput}
    only_enabled_topologies: true
"""


class FlowInducedFitRefinementInput(BaseNBDSuiteInput):
    """
    PELE refinement of the structures obtained with the previous dockin.
    """

    forceFieldInput = ""
    peleSolventInput = ""
    stepsInput = ""
    epochsInput = ""
    flexibleRegionRadiusInput = ""
    frozenRegionRadiusInput = ""

    def toYaml(self) -> str:
        return f"""- flow: induced_fit_refinement
  options:
    pele_forcefield: {self.forceFieldInput}
    pele_solvent: {self.peleSolventInput}
    pele_steps: {self.stepsInput}
    adaptive_epochs: {self.epochsInput}
    flexible_region_radius: {self.flexibleRegionRadiusInput}
    frozen_region_radius: {self.frozenRegionRadiusInput}"""


class RDockDockingBlockInput(BaseNBDSuiteInput):
    """
    The RDock docking block input.
    """

    x = 0.0
    y = 0.0
    z = 0.0
    docking_radius = 0.0
    rdock_iterations = 50

    def toYaml(self) -> str:
        return f"""- block: rdock_docking
  options:
    docking_center: [{self.x}, {self.y}, {self.z}]
    docking_radius: {self.docking_radius}"""


class NBDSuiteInputMerger:
    """
    Merge the input of the different blocks into a single input file.
    """

    blocks = []
    """
    The blocks to be merged. The first one must be the GeneralInput block.
    """

    def __init__(self, blocks: typing.List[BaseNBDSuiteInput]):
        self.blocks = blocks

    def toYaml(self) -> str:
        """
        Parsed the input to a yaml file (string)
        """
        return "\n".join([str(block) for block in self.blocks])

    def __str__(self):
        return self.toYaml()
