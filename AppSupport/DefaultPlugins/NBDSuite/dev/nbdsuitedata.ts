import { horusPost } from "../../../../Views/Utils/utils";

class NBDSuiteData {
  /**
   * @description - path to the NBDSuite folder
   * @type {string}
   */
  path: string;

  /**
   * @description - The list of data to plot
   * @type {any}
   */
  plotData: any;

  /**
   * @description - The list of complexes in the opened NBDSuite folder
   * @type {Array<string>}
   */
  complexes: Array<string>;

  /**
   * @description - The name of the opened NBDSuite simulation
   * @type {any}
   * @memberof NBDSuiteData
   */
  inputInfo: any;

  /**
   *
   * @param path - path to the NBDSuite folder
   */
  constructor(path: string) {
    this.path = path;
  }

  async getInputInfo() {
    const body = JSON.stringify({ path: this.path });

    const header = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const href = window.location.href;

    const postTo = href + "getInputInfo";

    const request = await horusPost(postTo, header, body);

    const data = await request.json();

    if (!data.ok) {
      throw new Error("Error getting input info");
    }

    this.inputInfo = data.data;
  }

  async getComplexes() {
    const body = JSON.stringify({ path: this.path });

    const header = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const postTo = window.location.href + "loadComplexes";

    const request = await horusPost(postTo, header, body);

    const data = await request.json();

    // Check the response data
    if (!data.ok) {
      throw new Error("Error getting plot data");
    }

    this.complexes = data.complexes;
  }

  async getPlotData(complex: string) {
    // The POST request url
    const url = window.location.href + "getPlotData";

    // The POST request body
    const body = JSON.stringify({
      path: this.path,
      complex: complex,
    });

    // The POST request header
    const header = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // The POST request options
    const response = await horusPost(url, header, body);

    // Check the response status
    if (response.status != 200) {
      throw new Error("Error getting plot data");
    }

    // Get the response data
    const data = await response.json();

    // Check the response data
    if (!data.ok) {
      throw new Error(data.msg);
    }

    // Set the plot data
    this.plotData = data.plotdata;
  }

  /**
   * @description - Returns the possible x/y-axis options based on the plot data
   * @returns {Array<string>}
   * @memberof NBDSuiteData
   */
  axisOptions() {
    const options: Array<string> = [];

    // Get one of the plot data objects
    const someData = this.plotData[Object.keys(this.plotData)[0]];

    if (!someData) {
      throw new Error("No plot data");
    }

    // Loop through the plot data
    for (const key in someData) {
      // Add the key to the options
      options.push(key);
    }

    return options;
  }

  /**
   * @description - Returns the string of the PDB file used in the input
   * @returns {string}
   * @memberof NBDSuiteData
   */
  async getInputPDB() {
    const body = JSON.stringify({ path: this.path });

    const header = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const href = window.location.href;

    const postTo = href + "loadPDB";

    const request = await horusPost(postTo, header, body);

    const data = await request.json();

    if (!data.ok) {
      throw new Error("Error getting input PDB");
    }

    const pdb = data.data.pdb;
    const name = data.data.name;

    // Retrive the molstar object from the window
    window.parent.molstar?.loadPDBString(pdb, name);
  }
}

export default NBDSuiteData;
