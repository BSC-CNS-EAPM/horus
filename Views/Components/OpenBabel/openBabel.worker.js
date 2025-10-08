self.baseURL = null;

addEventListener("message", async (event) => {
  const { molecule, options, conversionId, baseURL, task } = event.data;

  self.baseURL = baseURL;

  importScripts(baseURL + "/Static/obabel/openbabel.js");

  // @ts-ignore
  const obabel = OpenBabelModule();

  // Wait for the obabel module to be loaded
  while (!obabel.ObConversionWrapper) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  try {
    // Handle different tasks
    switch (task) {
      case "optimize":
        await optimizeMolecule(obabel, molecule, options, conversionId);
        break;
      case "convert":
        // Default conversion task
        await convertMolecule(obabel, molecule, options, conversionId);
        break;
      default:
        throw new Error(`Unknown task: ${task}`);
    }
  } catch (error) {
    postMessage({
      error: error?.message ?? error,
      conversionId
    });
  }
});

async function convertMolecule(obabel, molecule, options, conversionId) {
  const conversion = new obabel.ObConversionWrapper();

  conversion.setInFormat("", options.inputFormat);
  const mol = new obabel.OBMol();
  conversion.readString(mol, molecule);
  conversion.setOutFormat("", options.outputFormat);

  if (options.generate2D) {
    const gen2d = obabel.OBOp.FindType("gen2d");
    gen2d.Do(mol, "");
  }

  if (options.generate3D) {
    const gen3d = obabel.OBOp.FindType("gen3d");
    gen3d.Do(mol, "");
  }

  const result = conversion.writeString(mol, false);
  postMessage({ result, conversionId });
}

async function optimizeMolecule(obabel, molecule, options, conversionId) {
  const {
    inputFormat = "pdb",
    outputFormat = "pdb",
    constraints = { mode: "flexible", atoms: [] },
    steps = 200,
    chunk = 10,
    forceField = "uff",
    steepestDescent = true,
    conjugateGradients = true,
    steepestDescentThreshold = 1.0e-4,
    conjugateGradientsThreshold = 1.0e-6
  } = options;

  // Parse the molecule
  const conversion = new obabel.ObConversionWrapper();
  conversion.setInFormat("", inputFormat);
  const mol = new obabel.OBMol();
  conversion.readString(mol, molecule);

  let addedConstraints = 0;
  let processedAtoms = 0;
  const oconstraints = new obabel.OBFFConstraints();

  // Process constraints based on mode
  const { mode, atoms } = constraints;

  // First, identify atoms that match the constraints
  const matchingAtoms = new Set();

  for (const constraint of atoms) {
    const { chain: targetChain, residue: targetResidue, atom: targetAtom } = constraint;

    for (let i = 1; i <= mol.NumAtoms(); i++) {
      const atom = mol.GetAtom(i);
      const residue = atom.GetResidue();

      if (residue) {
        const resNum = residue.GetNum();
        const chain = String.fromCharCode(residue.GetChain());

        // Apply hierarchical matching logic
        let matches = false;

        if (targetChain && targetResidue && targetAtom !== undefined) {
          // Most specific: chain + residue + atom
          const atomIdx = atom.GetIdx();
          matches = (targetChain === chain && resNum === targetResidue && atomIdx === targetAtom);
        } else if (targetChain && targetResidue && targetAtom === undefined) {
          // Medium specific: chain + residue (all atoms in this residue)
          matches = (targetChain === chain && resNum === targetResidue);
        } else if (targetChain && targetResidue === undefined && targetAtom === undefined) {
          // Least specific: chain only (all atoms in this chain)
          matches = (targetChain === chain);
        }

        if (matches) {
          matchingAtoms.add(i);
        }
      }
    }
  }

  // Apply constraints based on mode
  if (mode === "flexible") {
    // In flexible mode: constrain all atoms EXCEPT those in the atoms list (atoms list are free to move)
    for (let i = 1; i <= mol.NumAtoms(); i++) {
      if (!matchingAtoms.has(i)) {
        const atom = mol.GetAtom(i);
        oconstraints.AddAtomConstraint(atom.GetIdx());
        addedConstraints += 1;
      }
    }
    processedAtoms = matchingAtoms.size;
  } else if (mode === "freeze") {
    // In freeze mode: constrain only the atoms in the atoms list (atoms list are frozen)
    for (const atomIdx of matchingAtoms) {
      const atom = mol.GetAtom(atomIdx);
      oconstraints.AddAtomConstraint(atom.GetIdx());
      addedConstraints += 1;
    }
    processedAtoms = matchingAtoms.size;
  } else {
    throw new Error(`Unknown constraint mode: ${mode}. Use 'flexible' or 'freeze'.`);
  }

  if (processedAtoms === 0) {
    throw new Error("No atoms found matching the specified constraints. Check chain ID and residue number.");
  }

  if (addedConstraints === 0) {
    throw new Error("No constraints were added. Check constraint mode and parameters.");
  }

  // Set up force field
  const ff = obabel.OBForceField.FindForceField(forceField);
  if (!ff) {
    throw new Error(`Force field '${forceField}' not found`);
  }

  ff.SetupWithConstraints(mol, oconstraints);

  const trajectory = [];
  const nChunks = Math.floor(steps / chunk);

  // Send initial progress
  postMessage({
    conversionId,
    progress: {
      step: 0,
      totalSteps: nChunks,
      message: "Starting optimization..."
    }
  });

  // Optimization loop with progress updates
  for (let i = 0; i < nChunks; i++) {
    // Perform steepest descent optimization if enabled
    if (steepestDescent) {
      ff.SteepestDescent(chunk, steepestDescentThreshold, false);
      ff.GetCoordinates(mol);
    }

    // Store coordinates for trajectory
    const coords = [];
    for (let atomIdx = 1; atomIdx <= mol.NumAtoms(); atomIdx++) {
      const atom = mol.GetAtom(atomIdx);
      coords.push([atom.GetX(), atom.GetY(), atom.GetZ()]);
    }
    trajectory.push(coords);

    // Get intermediate PDB for visualization
    conversion.setOutFormat("", "pdb");
    const intermediatePdb = conversion.writeString(mol, false);

    // Send progress update
    postMessage({
      conversionId,
      progress: {
        step: i + 1,
        totalSteps: nChunks,
        message: `Optimization step ${i + 1}/${nChunks}`,
        intermediatePdb: intermediatePdb,
        newCoords: { frame: i + 1, coords: coords }
      }
    });
  }

  // Final conjugate gradient optimization if enabled
  if (conjugateGradients) {
    postMessage({
      conversionId,
      progress: {
        step: nChunks,
        totalSteps: nChunks,
        message: "Performing final conjugate gradient optimization..."
      }
    });

    ff.ConjugateGradients(steps, conjugateGradientsThreshold, false);
    ff.GetCoordinates(mol);
  }

  // Get final optimized structure
  conversion.setOutFormat("", outputFormat);
  const result = conversion.writeString(mol, false);

  // Get final coordinates
  const finalCoords = [];
  for (let atomIdx = 1; atomIdx <= mol.NumAtoms(); atomIdx++) {
    const atom = mol.GetAtom(atomIdx);
    finalCoords.push([atom.GetX(), atom.GetY(), atom.GetZ()]);
  }
  trajectory.push(finalCoords);

  postMessage({
    result,
    conversionId,
    trajectory,
    progress: {
      newCoords: { frame: nChunks + 1, coords: finalCoords },
      step: nChunks,
      totalSteps: nChunks,
      message: "Optimization completed!",
      completed: true
    }
  });
}
