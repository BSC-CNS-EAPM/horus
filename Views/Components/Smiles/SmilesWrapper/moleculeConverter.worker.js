self.baseURL = null;

addEventListener("message", async (event) => {
  const { molecule, options, conversionId, baseURL } = event.data;

  self.baseURL = baseURL;

  importScripts(baseURL + "/Static/obabel/openbabel.js");

  // @ts-ignore
  const obabel = OpenBabelModule();

  // Wait for the obabel module to be loaded
  while (!obabel.ObConversionWrapper) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  try {
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
  } catch (error) {
    postMessage({
      error: error?.message ?? error,
      conversionId
    });
  }
});
