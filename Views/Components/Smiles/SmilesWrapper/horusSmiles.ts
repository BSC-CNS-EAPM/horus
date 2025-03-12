import { PANEL_REGISTRY } from "@/Components/MainApp/PanelView";
import {
  AtomInfo,
  isMolstarLoaded,
  MolInfo,
  MolstarEvents,
} from "../../Molstar/HorusWrapper/horusmolstar";
import { delay } from "@/Utils/utils";

export type HorusSmilesType = {
  id: string;
  label: string;
  smi: string;
  structureRef?: {
    id: string;
    rootRef: string;
    residue?: AtomInfo;
    molecule: _3DMolecule;
  };
  extraInfo?: string;
  selected?: boolean;
  group?: string;
  properties?: Record<string, any>;
};

type _3DMolecule = {
  contents: string;
  format: string;
};

const PROPERTIES_NOT_ALLOWED = [
  "id",
  "label",
  "smi",
  "structureref",
  "selected",
  "group",
  "properties",
];

const TRIM_REGEX = /[\r\n\u2028\u2029]+/g;

// Smiles events
export enum SmilesEvents {
  STATE = "smiles-state-event",
  CONVERSIONS = "smiles-conversions-event",
}

export type HorusSmilesManagerState = {
  smilesList: HorusSmilesType[];
  currentSmiles: HorusSmilesType | null;
  loadedRefs: string[];
};

export default class HorusSmilesManager {
  private _smilesList: HorusSmilesType[];
  private _currentSmiles: HorusSmilesType | null;
  private _convertingMolecules = 0;
  private openBabelWorker: Worker;

  // Define a setter for the convertingMolecules property
  public set convertingMolecules(value: number) {
    this._convertingMolecules = value;

    // Emit the CONVERSIONS event
    window.dispatchEvent(
      new CustomEvent(SmilesEvents.CONVERSIONS, {
        detail: value,
      })
    );
  }

  // Define a getter for the convertingMolecules property
  public get convertingMolecules(): number {
    return this._convertingMolecules;
  }

  smilesID = 0;

  // A copy of the Structure refs of ligands that are loaded in the view
  public loadedRefs: string[];

  /**
   * Initializes the HorusSmilesManager constructor.
   *
   * This constructor initializes the `_smilesList`, `_currentSmiles`, and `loadedRefs` properties.
   * It also initializes the `window.obabel` property with the OpenBabelModule.
   * Finally, it adds an event listener for the `MolstarEvents.STATE` event to update the smiles list.
   */
  constructor() {
    this._smilesList = [];
    this._currentSmiles = null;
    this.loadedRefs = [];

    this.openBabelWorker = new Worker(
      // @ts-ignore
      new URL("./moleculeConverter.worker.js", import.meta.url)
    );

    const constructedSmilesEventUpdater =
      this.updateSmilesFromMolstarEvent.bind(this);

    window.removeEventListener(
      MolstarEvents.STATE,
      constructedSmilesEventUpdater
    );

    // Add an event listener from Mol* state in order to update the smiles list
    window.addEventListener(MolstarEvents.STATE, constructedSmilesEventUpdater);

    // Load the initial molstar state
    this.updateSmilesFromMolstarEvent();
  }

  /**
   * Returns the current state of the HorusSmilesManager.
   *
   * @return {HorusSmilesManagerState} An object containing the current smilesList,
   * currentSmiles, and loadedRefs.
   */
  public saveState(): HorusSmilesManagerState {
    return {
      smilesList: this._smilesList,
      currentSmiles: this._currentSmiles,
      loadedRefs: this.loadedRefs,
    };
  }

  /**
   * Restores the state of the HorusSmilesManager from the provided state object.
   *
   * @param {HorusSmilesManagerState} state - The state object containing the smilesList, currentSmiles, and loadedRefs.
   */
  public restoreState(state: HorusSmilesManagerState) {
    this._smilesList = state.smilesList;
    this._currentSmiles = state.currentSmiles;
    this.loadedRefs = state.loadedRefs;

    window.dispatchEvent(this.getStateEvent());
  }

  /**
   * Updates the smiles list based on the current state of the Molstar viewer.
   *
   * This function retrieves the list of structure refs from the Molstar viewer
   * and filters out the refs that are already loaded. It then adds the new refs
   * to the smiles list and updates the loaded refs array. If any structure refs
   * are removed, it filters them out from the loaded refs array.
   *
   * @return {Promise<void>} A Promise that resolves when the function completes.
   */
  private async updateSmilesFromMolstarEvent() {
    // Gather the new structures
    const structures = isMolstarLoaded(window.molstar)
      ? window?.molstar?.listStructures()
      : [];
    const newStructures = structures.filter(
      (s) => !this.loadedRefs.includes(s.rootRef)
    );

    // If a structure was removed, filter from the loadedRefs
    const refs = structures.map((s) => s.rootRef);
    const removedRefs = this.loadedRefs.filter((ref) => !refs.includes(ref));

    newStructures.forEach((s) => {
      this.addLigandsFromStructure(s);
      this.loadedRefs.push(s.rootRef);
    });

    removedRefs.forEach((ref) => {
      if (this._currentSmiles?.structureRef?.rootRef === ref) {
        this._currentSmiles = null;
      }

      this.removeSmilesFromRef(ref);
    });

    if (!this._currentSmiles && this._smilesList.length > 0) {
      // Set the current smiles to the first smiles in the list
      // Only if comes from a structure
      const firstSmiles = this._smilesList[0]!;
      if (firstSmiles.structureRef) {
        this.setCurrentSmiles(firstSmiles);
      }
    }

    // Update the groups too
    this.updateLabelGroupAfterMolstarState();
  }

  /**
   * Increments the smilesID and generates a new unique ID.
   *
   * @return {string} A new unique ID generated by combining the result of makeid(8) and smilesID.
   */
  private getNewID() {
    this.smilesID += 1;

    return `${makeid(8)}${this.smilesID}`;
  }

  /**
   * Returns a new CustomEvent with the SmilesEvents.STATE type and a detail object
   * containing the current smilesList and currentSmiles.
   *
   * @return {CustomEvent} A new CustomEvent with the SmilesEvents.STATE type and a detail object
   * containing the current smilesList and currentSmiles.
   */
  private getStateEvent() {
    return new CustomEvent(SmilesEvents.STATE, {
      detail: {
        smilesList: this._smilesList,
        currentSmiles: this._currentSmiles,
      },
    });
  }

  /**
   * Sets the smiles list with the provided array of HorusSmilesType.
   *
   * @param {HorusSmilesType[]} smiles - The array of smiles to set.
   */
  public setSmilesList(smiles: HorusSmilesType[]) {
    this._smilesList = smiles;

    // If no smiles are provided, set the current smiles to null
    if (smiles.length === 0) {
      this.setCurrentSmiles(null);
    } else {
      // If a smiles was set to currentSmiles, check that it exists in the new smiles list
      const currentSmilesExistsOnNewList = smiles.find(
        (s) => s.id === this._currentSmiles?.id
      );

      if (currentSmilesExistsOnNewList) {
        // Update the current smiles if it still exists
        this.setCurrentSmiles(currentSmilesExistsOnNewList);
      } else {
        // Otherwise, set the current smiles to the first smiles that has a structureRef
        const smilesWithStructureRef = smiles.find((s) => s.structureRef);
        smilesWithStructureRef && this.setCurrentSmiles(smilesWithStructureRef);
      }
    }

    // Emit an event
    window.dispatchEvent(this.getStateEvent());
  }
  /**
   * Sets the current SMILES representation to the provided SMILES string or null.
   *
   * @param {HorusSmilesType | null} smi - The SMILES string to set as the current SMILES representation.
   * @return {void} This function does not return anything.
   */
  public setCurrentSmiles(smi: HorusSmilesType | null) {
    this._currentSmiles = smi;

    // Emit an event
    window.dispatchEvent(this.getStateEvent());
  }

  /**
   * Returns the list of SMILES structures.
   *
   * @return {HorusSmilesType[]} The list of SMILES structures.
   */
  public getSmilesList() {
    return this._smilesList;
  }

  /**
   * Retrieves the current SMILES representation.
   *
   * @return {HorusSmilesType | null} The current SMILES representation.
   */
  public getCurrentSmiles() {
    return this._currentSmiles;
  }

  /**
   * Resets the SMILES list by setting it to an empty array.
   *
   * @return {void} This function does not return anything.
   */
  public reset() {
    // Keep the Molstar smiles
    const smilesList = this.getSmilesList().filter((smi) => {
      return smi.structureRef;
    });
    this.setSmilesList(smilesList);
  }

  /**
   * Removes the SMILES structures from the list that have the specified structure reference.
   *
   * @param {string} sourceRef - The structure reference to filter the SMILES structures.
   * @return {void}
   */
  private removeSmilesFromRef(sourceRef: string) {
    this.setSmilesList(
      this.getSmilesList().filter((smi) => {
        return smi.structureRef?.rootRef !== sourceRef;
      })
    );
  }

  private updateLabelGroupAfterMolstarState() {
    // Get all the labels from Mol*
    const currentLabels = (
      isMolstarLoaded(window.molstar) ? window?.molstar?.listStructures() : []
    ).map((ref) => {
      return {
        rootRef: ref.rootRef,
        label: ref.label,
      };
    });

    // Now update the groups
    this.setSmilesList(
      this.getSmilesList().map((smi) => {
        return {
          ...smi,
          group:
            currentLabels.find((label) => {
              return label.rootRef === smi.structureRef?.rootRef;
            })?.label ?? smi.group,
        };
      })
    );
  }

  /**
   * Creates a new empty molecule and adds it to the list of SMILES structures.
   *
   * @return {HorusSmilesType} The newly created SMILES structure.
   */
  public newEmptyMolecule(group?: string) {
    const newSmiles: HorusSmilesType = {
      id: this.getNewID(),
      label: "New molecule",
      smi: "[HORUS-]",
      group: group ?? "Horus",
    };

    this.setSmilesList([...this.getSmilesList(), newSmiles]);

    return newSmiles;
  }

  /**
   * Duplicates a SMILES structure with a new ID and a 'copy' label.
   *
   * @param {HorusSmilesType} smi - The SMILES structure to duplicate.
   * @return {object} The duplicated SMILES structure with a new ID and 'copy' label.
   */
  public duplicateSmiles(smi: HorusSmilesType) {
    return {
      ...smi,
      id: this.getNewID(),
      label: smi.label + " copy",
      structureRef: undefined,
    } as HorusSmilesType;
  }

  /**
   * Splits an array of AtomInfo objects into a grouped dictionary based on the combination of auth_comp_id and chainID.
   *
   * @param {AtomInfo[]} atoms - The array of AtomInfo objects to be grouped.
   * @return {{ [id: string]: AtomInfo[] }} - A dictionary where the keys are the labels generated from the combination of auth_comp_id and chainID, and the values are arrays of AtomInfo objects with the same label.
   */
  private splitAtomsByLigand(atoms: AtomInfo[]) {
    const groupedAtoms: { [id: string]: AtomInfo[] } = {};
    for (const at of atoms) {
      const label = at.auth_comp_id + "_" + at.chainID;
      if (!groupedAtoms[label]) {
        groupedAtoms[label] = [at];
      } else {
        groupedAtoms[label]!.push(at);
      }
    }
    return groupedAtoms;
  }

  /**
   * Builds an XYZ file from a list of atom information.
   *
   * @param {AtomInfo[]} atoms - The list of atom information.
   * @return {string} The XYZ file content.
   * @throws {Error} If no atoms are provided.
   */
  public buildXYZFileFromAtomInfoList(atoms: AtomInfo[]) {
    if (atoms.length === 0) {
      throw new Error("No atoms provided");
    }

    const num = atoms.length;
    const name = atoms[0]!.auth_comp_id + "_" + atoms[0]!.chainID;
    let body = "";

    for (const at of atoms) {
      if (at.type.length === 2) {
        body +=
          at.type[0] +
          at.type[1]!.toLowerCase() +
          " " +
          at.x +
          " " +
          at.y +
          " " +
          at.z +
          "\n";
      } else {
        body += at.type + " " + at.x + " " + at.y + " " + at.z + "\n";
      }
    }
    return num + "\n" + name + "\n" + body;
  }

  /**
   * Adds ligands from a given reference.
   *
   * @param {string} ref - The reference to retrieve the atoms from.
   * @return {void}
   */
  private async addLigandsFromStructure(structure: MolInfo) {
    // Get the atoms from the reference
    const structureLabel = structure.label;

    // If the structure is not a SDF, list the hetero atoms
    // If its SDF, split the file and convert it using the OpenBabel module
    if (structure.format === "sdf") {
      this.parseMolstarSDFFileAsSmiles(structure);
    } else {
      const heteroAtomsList = isMolstarLoaded(window.molstar)
        ? window?.molstar?.listHeteroAtoms(structureLabel)[structure.id]
        : [];
      if (!heteroAtomsList) {
        return;
      }

      const groupedAtoms = this.splitAtomsByLigand(heteroAtomsList);

      this.convertingMolecules += Object.keys(groupedAtoms).length;
      for (const key of Object.keys(groupedAtoms)) {
        // Generate a XYZ file
        const atomFile = this.buildXYZFileFromAtomInfoList(groupedAtoms[key]!);

        // First convert to PDB
        const pdbFile = await this.moleculeConverter(atomFile, {
          inputFormat: "xyz",
          outputFormat: "pdb",
        });

        // Then to Mol
        const molFile = await this.moleculeConverter(pdbFile, {
          inputFormat: "pdb",
          outputFormat: "mol",
          generate2D: true,
        });

        // Finally to SMILES
        const smiles = HorusSmilesManager.cleanSmiles(
          await this.moleculeConverter(molFile, {
            inputFormat: "mol",
            outputFormat: "smiles",
            decreaseConvertingMolecules: true,
          })
        );

        // Add the new smiles
        this.setSmilesList([
          ...this.getSmilesList(),
          {
            id: this.getNewID(),
            label: key,
            smi: smiles,
            structureRef: {
              id: structure.id,
              rootRef: structure.rootRef,
              residue: groupedAtoms[key]![0]!,
              molecule: {
                contents: pdbFile,
                format: "pdb",
              },
            },
            group: structureLabel,
          },
        ]);
      }
    }
  }

  private parseSingleSmilesStringAsMolecule(smiles: string, group?: string) {
    // If the string can be splitted bya space, use the second columns as the label
    let label = null;
    if (smiles.split(" ").length > 1) {
      label = smiles.split(" ")[1]!;
      smiles = smiles.split(" ")[0]!;
    }

    if (smiles.split("\t").length > 1) {
      label = smiles.split("\t")[1]!;
      smiles = smiles.split("\t")[0]!;
    }

    return {
      id: this.getNewID(),
      label: label || smiles,
      smi: HorusSmilesManager.cleanSmiles(smiles),
      group: group,
    } as HorusSmilesType;
  }

  /**
   * Loads a SMILES string and adds it to the list of SMILES structures.
   *
   * @param {string} smiles - The SMILES string to load.
   * @param {Object} options - Additional options for the SMILES structure.
   * @param {string} [options.label] - The label for the SMILES structure. If not provided, the SMILES string itself will be used as the label.
   * @param {string} [options.extraInfo] - Additional information for the SMILES structure.
   * @return {HorusSmilesType} The newly created SMILES structure.
   */
  public loadSmilesString(
    smiles: string,
    options?: {
      label?: string;
      extraInfo?: string;
      group?: string;
    }
  ) {
    const newSmiles = this.parseSingleSmilesStringAsMolecule(
      smiles,
      options?.group
    );

    // Otherwise the parseSingleSmilesStringAsMolecule will define the label
    // automatically
    if (options?.label) {
      newSmiles.label = options?.label;
    }

    newSmiles.extraInfo = options?.extraInfo;

    this.setSmilesList([...this.getSmilesList(), newSmiles]);

    return newSmiles;
  }

  private async loadFile(file: File) {
    // Verify that the file is .CSV or .SMI
    if (!HorusSmilesManager.isFileAllowed(file)) {
      console.error(
        "File is not allowed. Allowed filetypes are .smi, .csv and .sdf"
      );

      return;
    }

    if (file.name.endsWith(".sdf")) {
      // Open the molstar panel
      document.dispatchEvent(
        new CustomEvent("addPanel", {
          detail: {
            component: PANEL_REGISTRY.molstar.component,
            panelID: PANEL_REGISTRY.molstar.id,
          },
        })
      );

      while (!isMolstarLoaded(window.molstar)) {
        // Wait for molstar to load
        await delay(100);
      }

      // Load the file in molstar
      return await window.molstar?.loadMoleculeFile(file);
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const contents = (reader.result as string) ?? "";

        let parsedSmiles: HorusSmilesType[] = [];

        // If its a .CSV
        if (file.name.endsWith(".csv")) {
          try {
            parsedSmiles = this.parseCSVSmilesString(contents, file.name);
          } catch (error) {
            reject(error);
          }
        }

        if (file.name.endsWith(".smi")) {
          parsedSmiles = this.parseSMISmilesString(contents, file.name);
        }

        this.setSmilesList([...this.getSmilesList(), ...parsedSmiles]);

        resolve(null);
      };

      reader.readAsText(file);
    });
  }

  public async loadFiles(file: File | FileList) {
    if (file instanceof File) {
      await this.loadFile(file);
    } else if (file instanceof FileList) {
      for (let i = 0; i < file.length; i++) {
        const f = file[i]!;
        await this.loadFile(f);
      }
    }
  }

  private parseVerifyAddSmiles(data: any) {
    const parsedSmiles: HorusSmilesType[] = [];

    // Verify if its an array or a single object
    if (Array.isArray(data)) {
      for (const smiles of data) {
        // Verify wether its an object or a simple string
        if (typeof smiles === "object") {
          parsedSmiles.push({
            id: this.getNewID(),
            label: smiles.label || smiles.smi,
            smi: smiles.smi,
            extraInfo: smiles.extraInfo,
            group: smiles.group,
            properties: smiles.properties,
          });
        } else {
          parsedSmiles.push(this.parseSingleSmilesStringAsMolecule(smiles));
        }
      }
    }

    // If its an object
    if (typeof data === "object") {
      parsedSmiles.push({
        id: this.getNewID(),
        label: data.label || data.smi,
        smi: data.smi,
        extraInfo: data.extraInfo,
        group: data.group,
      });
    }

    // If its just an string, read the single smiles
    if (typeof data === "string") {
      parsedSmiles.push(this.parseSingleSmilesStringAsMolecule(data));
    }

    return parsedSmiles;
  }

  private parseSMISmilesString(fileContents: string, group?: string) {
    const lines = fileContents.split("\n");
    const smilesList: HorusSmilesType[] = [];

    for (const line of lines) {
      // Skip empty lines
      if (line.trim() === "") {
        continue;
      }

      smilesList.push(this.parseSingleSmilesStringAsMolecule(line, group));
    }

    return smilesList;
  }

  /**
   * Parses a CSV string and returns an array of HorusSmilesType objects.
   *
   * @param {string} fileContents - The contents of the CSV file.
   * @return {HorusSmilesType[]} An array of HorusSmilesType objects representing the parsed CSV data.
   * @throws {Error} If the CSV file does not contain at least 2 lines or if it does not have a SMILES or SMI column.
   */
  private parseCSVSmilesString(fileContents: string, group?: string) {
    const lines = fileContents.split("\n");

    if (lines.length < 2) {
      throw new Error("File must contain at least 2 lines. Header and values.");
    }

    const splittedHeader = lines[0]!.split(",");

    // Get the column SMILES or SMI
    const smilesColumn = splittedHeader.findIndex(
      (v) => v.toLowerCase() === "smiles" || v.toLowerCase() === "smi"
    );

    if (smilesColumn === -1) {
      throw new Error("CSV files must contain a SMILES or SMI column.");
    }

    // If the csv has a label or name column, use it as the label
    const labelColumn = splittedHeader.findIndex(
      (v) =>
        v.toLowerCase() === "label" ||
        v.toLowerCase() === "name" ||
        v.toLowerCase() === "id"
    );

    // Extract the other columns
    const properties: Record<string, string> = {};
    for (let i = 0; i < splittedHeader.length; i++) {
      if (i !== smilesColumn && i !== labelColumn) {
        properties[i] = splittedHeader[i]!.trim();
      }
    }

    const smilesList: HorusSmilesType[] = [];
    for (let i = 0; i < lines.length; i++) {
      // Skip the first lin, which is the header
      if (i === 0) {
        continue;
      }

      const line = lines[i]!;
      if (line.length > 0) {
        const splittedLine = line.split(",");
        const smiles = splittedLine[smilesColumn]!.trim();

        if (!smiles) {
          continue;
        }

        const label =
          labelColumn !== -1 ? line.split(",")[labelColumn]!.trim() : smiles;

        const propertiesObj: Record<string, any> = {};
        for (const [key, value] of Object.entries(properties)) {
          const currentValue = splittedLine[Number(key)]!.trim();

          // If the value can be converted to a number
          if (!isNaN(Number(currentValue))) {
            propertiesObj[value] = Number(splittedLine[Number(key)]!.trim());
          } else {
            propertiesObj[value] = splittedLine[Number(key)]!.trim();
          }
        }

        smilesList.push({
          id: this.getNewID(),
          label: label,
          smi: smiles,
          group: group,
          properties: propertiesObj,
        });
      }
    }

    return smilesList;
  }

  /**
   * Parses the SDF file contents into an array of HorusSmilesType objects.
   *
   * @param {string} fileContents - The content of the SDF file to be parsed.
   * @param {string} [group] - Optional group value for the parsed molecules.
   * @return {HorusSmilesType[]} An array of parsed HorusSmilesType objects.
   */
  private async parseMolstarSDFFileAsSmiles(structure: MolInfo) {
    if (!structure.fileContents) {
      return [];
    }

    // Split the SDF by the separator $$$$
    const molecules = structure.fileContents
      .split("$$$$")
      .map((v) => v.trim())
      .filter((v) => !!v);

    this.convertingMolecules += molecules.length;

    // Create an array of promises for converting and parsing molecules concurrently
    return molecules.forEach((m) => {
      this.moleculeConverter(m, {
        inputFormat: "sdf",
        outputFormat: "smi",
        generate2D: true,
        decreaseConvertingMolecules: true,
      }).then((s) => {
        const horusSmiles = this.parseSingleSmilesStringAsMolecule(
          s,
          structure.label
        );

        this.setSmilesList([
          ...this.getSmilesList(),
          {
            ...horusSmiles,
            properties: this.readSDFData(m),
            structureRef: {
              id: structure.id,
              rootRef: structure.rootRef,
              residue: { label: structure.label } as AtomInfo,
              molecule: {
                contents: m,
                format: "sdf",
              },
            },
          } as HorusSmilesType,
        ]);
      });
    });
  }

  private readSDFData(molecule: string) {
    const data: any = {};
    Array.from(molecule.matchAll(/>\s*<([^>]+)>\s*\n([^\n]+)/g)).forEach(
      (match: RegExpMatchArray) => {
        if (!match[1] || !match[2]) {
          return;
        }
        data[match[1]] = match[2];
      }
    );
    return data;
  }

  /**
   * Converts the selected SMILES strings to a single SDF file.
   *
   * @return {string} The SDF file contents.
   */
  public async convertSelectedToSDF() {
    const selectedSmiles = this.getSelectedSmiles();

    // Generate a .smi file
    let sdfContents = "";
    this.convertingMolecules += selectedSmiles.filter(
      (s) => s.structureRef?.molecule.format !== "sdf"
    ).length;
    for (const smiles of selectedSmiles) {
      let currentSDF;
      // If the molecule already has a SDF type, return that
      if (smiles.structureRef?.molecule?.format === "sdf") {
        currentSDF = smiles.structureRef.molecule.contents;
      } else {
        const fileContents = `${smiles.smi} ${smiles.label}\n`;
        currentSDF = await this.moleculeConverter(fileContents, {
          inputFormat: "smiles",
          outputFormat: "sdf",
          generate3D: true,
          decreaseConvertingMolecules: true,
        });
      }

      sdfContents += `${currentSDF} \n\n$$$$\n`;
    }
    return sdfContents;
  }

  public addPropertyToSelected(property: string, value: any) {
    const parsedProperty = property.toLowerCase().replace(" ", "_");

    if (PROPERTIES_NOT_ALLOWED.includes(parsedProperty)) {
      return;
    }

    this.setSmilesList(
      this.getSmilesList().map((s) => {
        if (s.selected) {
          return {
            ...s,
            properties: {
              ...(s.properties ?? {}),
              [parsedProperty]: value,
            },
          };
        }

        return s;
      })
    );
  }

  public static isFileAllowed(file: File) {
    // Allow only .smi or .csv files
    if (
      file.name.endsWith(".smi") ||
      file.name.endsWith(".csv") ||
      file.name.endsWith(".sdf")
    ) {
      return true;
    }

    return false;
  }

  public removeIDs(ids: string[]) {
    this.setSmilesList(this.getSmilesList().filter((s) => !ids.includes(s.id)));
  }

  public removeSelected() {
    // Prevent removing of structureRefs
    this.removeIDs(
      this.getSelectedSmiles()
        .filter((s) => !s.structureRef)
        .map((s) => s.id)
    );
  }

  public getSelectedSmiles() {
    return this.getSmilesList().filter((s) => s.selected);
  }

  /*
  Generate the contents of a .csv file
  Returns a string
  */
  public toCSV() {
    const selectedSmiles = this.getSelectedSmiles();

    if (!selectedSmiles) return "";

    const properties = Array.from(
      new Set(
        selectedSmiles
          .flatMap((s) => Object.keys(s.properties || {}))
          .filter((p) => p)
      )
    );

    const safeProperty = (p: string) =>
      p.replace(/,/g, "_").replace(TRIM_REGEX, "").trim();

    const header = ["SMILES", "label", ...properties];
    const data = [
      ...selectedSmiles.map((s) => [
        s.smi,
        s.label.replace(TRIM_REGEX, "").trim(),
        ...properties.map((p) => safeProperty(s.properties?.[p] || "")),
      ]),
    ];

    const csv = [header, ...data].map((row) => row.join(",")).join("\n");

    return csv;
  }

  actionsQueue: Array<{
    id: string;
    type: string;
    data: any;
  }> = [];
  async applyAction(action: any) {
    const { type, data } = action;

    // Assing an ID to the action
    action.id = Math.random().toString(36);

    this.actionsQueue.push(action);

    // Wait till the action is the first in the queue

    while (this.actionsQueue[0]?.id !== action.id) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    let newSmiles: HorusSmilesType[] = [];
    const group = data.group;
    try {
      switch (type) {
        case "addSmiles":
          const smiles: string = data.smiles;

          if (!smiles) {
            return;
          }

          // Parse the string
          newSmiles = this.parseSMISmilesString(smiles, group);
          this.setSmilesList([...this.getSmilesList(), ...newSmiles]);
          break;
        case "addCSV":
          const fileContents: string = data.fileContents;
          try {
            newSmiles = this.parseCSVSmilesString(fileContents, group);
            this.setSmilesList([...this.getSmilesList(), ...newSmiles]);
          } catch (error) {
            console.error(error);
          }
          break;
        case "addSmilesWithData":
          newSmiles = this.parseVerifyAddSmiles(data);
          this.setSmilesList([...this.getSmilesList(), ...newSmiles]);
          break;
        case "reset":
          this.reset();
          break;
        default:
          alert(`Action '${type}' not implemented`);
          break;
      }
    } catch (error) {
      alert(
        "There was an error applying the following Smiles action: " +
          type +
          "\n\n" +
          error
      );
    } finally {
      // Once the action has been applied, remove it from the pending actions
      this.actionsQueue.shift();
    }
  }

  /**
   * Remove all whitespaces and end-of-line characters
   *
   * @param {string} smiles - The input string to clean
   * @return {string} The cleaned string with whitespaces and end-of-line characters removed
   */
  public static cleanSmiles(smiles: string): string {
    // If \t is in the string, split by \t and take the first part
    if (smiles.includes("\t")) {
      smiles = smiles.split("\t")[0]!;
    }

    // Remove all whitespaces and end-of-line characters
    return smiles.replace(/\s/g, "").replace(/\n/g, "").trim();
  }

  private conversionPromises: Map<
    string,
    {
      resolve: (value: string) => void;
      reject: (reason: any) => void;
    }
  > = new Map();

  private generateConversionId(): string {
    return `conv_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
  }

  private async moleculeConverter(
    molecule: string,
    options: {
      inputFormat: string;
      outputFormat: string;
      generate2D?: boolean;
      generate3D?: boolean;
      decreaseConvertingMolecules?: boolean;
    }
  ): Promise<string> {
    const conversionId = this.generateConversionId();

    const promise = new Promise<string>((resolve, reject) => {
      this.conversionPromises.set(conversionId, { resolve, reject });
    });

    // Set up message handler if not already done
    if (!this.openBabelWorker.onmessage) {
      this.openBabelWorker.onmessage = (event) => {
        const { result, error, conversionId } = event.data;
        const promiseHandlers = this.conversionPromises.get(conversionId);

        if (promiseHandlers) {
          if (error) {
            promiseHandlers.reject(error);
          } else {
            promiseHandlers.resolve(result);
          }
          this.conversionPromises.delete(conversionId);
        }
      };

      this.openBabelWorker.onerror = (error) => {
        // Handle general worker errors
        console.error("Worker error:", error);
      };
    }

    this.openBabelWorker.postMessage({
      molecule,
      options,
      conversionId,
      baseURL: location.origin + window.__HORUS_ROOT__,
    });

    return promise.finally(() => {
      if (options.decreaseConvertingMolecules && this.convertingMolecules > 0) {
        this.convertingMolecules--;
      }
    });
  }
}

function makeid(length: number) {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}
