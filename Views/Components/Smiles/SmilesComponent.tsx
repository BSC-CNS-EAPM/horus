import {
  CSSProperties,
  DetailedHTMLProps,
  HTMLAttributes,
  PureComponent
} from "react";
import HorusSmilesManager from "./SmilesWrapper/horusSmiles";

function getRandomInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
}

type JsClosureJsme = any; // Define as needed
type JavaScriptObject = any; // Define as needed
type JsArrayString = string[]; // Define as needed
type JSMEatom = any; // Define as needed
type JSMEBond = any; // Define as needed
type JsArrayInteger = number[]; // Define as needed
type Element = HTMLElement; // Adjust if needed
type JsClosure = any; // Define as needed
type ColorSpec = any; // Define as needed
type JSMEmolecule = any; // Define as needed

type JSMEAPI = {
  activateMarkerColor(colorIndex: number): void;
  addClickHandler(jsEventHandler: JsClosureJsme): void;
  addMouseDownHandler(jsEventHandler: JsClosureJsme): void;
  addMouseOutHandler(jsEventHandler: JsClosureJsme): void;
  addMouseOverHandler(jsEventHandler: JsClosureJsme): void;
  alert(message: string): void;
  clear(): void;
  clearFontCache(): void;
  deferredRepaint(): void;
  getAlldefinedCallBackNames(): string[];
  getAllGraphicsString(): JsArrayString;
  getAtom(molIndex: number, atomIndex: number): JSMEatom;
  getAtomAdditionalData(atomE: number): JavaScriptObject;
  getBackGroundColorPalette(): string[];
  getBond(molIndex: number, bondIndex: number): JSMEBond;
  getBondAdditionalData(bondE: number): JavaScriptObject;
  getCallBack(callbackName: string): JavaScriptObject;
  getCopyToClipboardFormat(): string;
  getCreationIndex(): number;
  getHelpURL(): string;
  getMenuScale(): number;
  getMenuXShortcuts(): string;
  getMolecularAreaAntiAlias(): boolean;
  getMolecularAreaGraphicsString(): string;
  getMolecularAreaLineWidth(): number;
  getMolecularAreaScale(): number;
  getMolecule(molIndex: number): JSMEmolecule;
  getMultiSDFstack(): string[];
  getNewButtonStatus(): boolean;
  getNotifyStructuralChangeJSfunction(): string;
  getNumberOfColorsForBackGroundPalette(): number;
  getOffsetHeight(): number;
  getOffsetSize(): JsArrayInteger;
  getOffsetWidth(): number;
  getParentContainer(): Element;
  getPasteLabel(): string;
  getPrePasteJSfunction(): string;
  getSupportedFileFormats(): JsArrayString;
  getWebSearchInchiKeyBaseUrl(): string;
  hasMarkedAtom(): boolean;
  hasMolecule(): boolean;
  initializationError(message: string): void;
  isDepictMode(): boolean;
  isVisible(): boolean;
  jmeFile(): string;
  molFile(): string;
  molFile(isV3000: boolean): string;
  nonisomericSmiles(): string;
  numberOfMolecules(): number;
  options(options: string): void;
  read_MOL_SDF_RXN(s: string): boolean;
  readGenericMolecularInput(s: string): void;
  readGenericMolecularInput(s: string, fireReadEvent: boolean): void;
  readMolecule(s: string): void;
  readMolFile(s: string): void;
  repaint(): void;
  replaceAllAppletsByJSME(): number;
  replaceAllAppletsByJSME(jsFunctionWithJsmeInstanceArg: JsClosure): number;
  reset(): void;
  resetAtomColors(molIndex: number): void;
  resetAtomMaps(molIndex: number): void;
  resetAtomMarks(molIndex: number): void;
  resetBondColors(molIndex: number): void;
  resetBondMarks(molIndex: number): void;
  setAction(action: number): void;
  setAfterDepictEditToggleEventHandler(jsEventHandler: JsClosureJsme): void;
  setAfterPasteCallback(callbackFunction: JavaScriptObject): void;
  setAfterStructureModifiedCallback(callbackFunction: JavaScriptObject): void;
  setAntialias(onOff: boolean): void;
  setAtomAdditionalData(
    atomE: number,
    data: JavaScriptObject,
    pushOnUndoStack: boolean,
    emitJSMEEvent: boolean
  ): void;
  setAtomBackgroundColors(molIndex: number, atomAndColorCSV: string): void;
  setAtomMolecularAreaFontSize(fs: number): void;
  setAtomToHighLight(molIndex: number, atomIndex: number): void;
  setBackGroundColorPalette(palette: string[]): void;
  setBeforePasteCallback(callbackFunction: JavaScriptObject): void;
  setBondAdditionalData(
    bondE: number,
    data: JavaScriptObject,
    pushOnUndoStack: boolean,
    emitJSMEEvent: boolean
  ): void;
  setBondBackgroundColors(molIndex: number, bondAndColorCSV: string): void;
  setBondToHighLight(molIndex: number, bondIndex: number): void;
  setCallBack(callbackName: string, callbackFunction: JavaScriptObject): void;
  setCopyToClipboardFormat(format: string): void;
  setHeight(height: string): void;
  setHelpURL(url: string): void;
  setMarkerColor(hexColor: string): void;
  setMarkerMenuBackGroundColorPalette(palette: Array<ColorSpec>): void;
  setMenuScale(scale: number): void;
  setMenuXShortcuts(shortcuts: string): void;
  setMolecularAreaAntiAlias(molecularAreaAntiAlias: boolean): void;
  setMolecularAreaLineWidth(molecularAreaLineWidth: number): void;
  setMolecularAreaScale(scale: number): void;
  setNewButtonStatus(newStatus: boolean): void;
  setNotifyAtomHighLightChangeJSfunction(
    notifyAtomHighLightJSfunction: string
  ): void;
  setNotifyStructuralChangeJSfunction(
    notifyStructuralChangeJSfunction: string
  ): void;
  setPasteLabel(pasteLabel: string): void;
  setPrePasteJSfunction(prePasteJSfunction: string): void;
  setSize(width: number, height: number): void;
  setSize(width: number, height: number, resizeParent: boolean): void;
  setSize(width: string, height: string): void;
  setSize(width: string, height: string, resizeParent: boolean): void;
  setStarColor(hexColor: string): void;
  setSubstituent(s: string): void;
  setTemplate(templateAsJmeMol: string, templateName: string): void;
  setUserInterfaceBackgroundColor(bgColor: string): void;
  setVisible(visible: boolean): void;
  setWebSearchInchiKeyBaseUrl(webSearchInchiKeyBaseUrl: string): void;
  setWidth(width: string): void;
  showInfo(message: string): void;
  smiles(): string;
  totalNumberOfAtoms(): number;
  totalNumberOfBonds(): number;
};

type JSMEEvent = {
  action: string;
  src: JSMEAPI;
};

type JSMEOptions = {
  xbutton?: boolean;
  rbutton?: boolean;
  atommovebutton?: boolean;
  hydrogens?: boolean;
  keephs?: boolean;
  removehs?: boolean;
  removehsc?: boolean;
  query?: boolean;
  autoez?: boolean;
  canonize?: boolean;
  stereo?: boolean;
  reaction?: boolean;
  multipart?: boolean;
  addnewpart?: boolean;
  valenceState?: boolean;
  polarnitro?: boolean;
  number?: boolean;
  marker?: boolean;
  marker1?: boolean;
  markAtomOnly?: boolean;
  markBondOnly?: boolean;
  markNothing?: boolean;
  pseudoMark?: boolean;
  showAtomMapNumberWithBackgroundColor?: boolean;
  depict?: boolean;
  depictaction?: boolean;
  toggle?: boolean;
  fullScreenIcon?: boolean;
  showFullScreenIconInDepictMode?: boolean;
  paste?: boolean;
  border?: boolean;
  newlook?: boolean;
  exportinchi?: boolean;
  exportinchikey?: boolean;
  exportinchiauxinfo?: boolean;
  searchinchiKey?: boolean;
  useopenchemlib?: boolean;
  exportSVG?: boolean;
  useOclidcode?: boolean;
  fgmenu?: boolean;
  zoom?: boolean;
  zoomgui?: boolean;
  showdragandDropIconindepictmode?: boolean;
  contextmenu?: boolean;
};

type JSMEParameters = {
  jme?: string; // structure in JME format
  smiles?: string; // structure in SMILES format
  mol?: string; // structure in MOL format
  depictcgi?: string; // ??
  depictbg?: string; // background color in depict mode in RGB hex format (e.g. #FFFFFF)
  guicolor?: string; // background color of the GUI elements in RGB hex format (e.g. #FFFFFF) (see also method setUserInterfaceBackgroundColor())
  guiAtomColor?: string; // set atom symbol color in the GUI to the same color in RGB hex format (e.g. #000000 for black)
  atombg?: string; // atom background colors - see the demo JSME_atom_highlight_demo.html for an example
  atombgsize?: string; // relative size of the atom background circle, default is "1.0"
  bondbgsize?: string; // relative size of the bond background rectangle, default is "1.0"
  markerIconColor?: string; // background color of the GUI element circle used for the marker action in RGB hex format(e.g. #FFFFFF)
  notify_structural_change_js_function?: string; // deprecated
};

type SmilesViewProps = {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  options?: JSMEOptions;
  parameters?: JSMEParameters;
  smiles?: string;
  removePolygon?: boolean;
  onChange?: (jsmeEvent: JSMEEvent) => void;
  onClickEdit?: () => void;
  containerProps?: DetailedHTMLProps<
    HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  >;
};

type JSMEApplet = {
  readGenericMolecularInput: (smiles: string) => void;
  options: (options: any) => void;
  setCallBack: (event: string, callback: any) => void;
  setSize: (
    width: CSSProperties["width"],
    height: CSSProperties["height"]
  ) => void;
  reset: () => void;
};

export class SmilesView extends PureComponent {
  jsmeApplet: JSMEApplet | null = null;
  id: string;

  drawnSmiles: string | null = null;

  override props: SmilesViewProps;

  private generateOptionsString(options: JSMEOptions): string {
    const entries = Object.entries(options || {}).map(
      ([key, value]) => `${value ? "" : "no"}${key}`
    );
    return entries.join(",");
  }

  constructor(props: SmilesViewProps) {
    super(props);

    // If a smiles is provided, clean it
    if (props.parameters?.smiles) {
      props.parameters.smiles = HorusSmilesManager.cleanSmiles(
        props.parameters?.smiles
      );
    }

    this.props = props;
    this.id = "horus-jsme" + getRandomInt(1, 100000);
  }

  handleJsmeLoad = async () => {
    // Parse the options parameters,
    // should be an object with "options": "key1,key2,key3" and the
    // rest of the JSMEParameters
    const optionParameters: { ["options"]?: string } & JSMEParameters = {};

    if (this.props.options) {
      optionParameters["options"] = this.generateOptionsString(
        this.props.options
      );
    }

    Object.entries(this.props.parameters || {}).forEach(([key, value]) => {
      // If any of the props belongs to the JSMEParameters, use the value
      optionParameters[key as keyof JSMEParameters] = value;
    });

    // If the applet was already loaded, reset it

    if (!this.jsmeApplet) {
      if (!window.JSApplet || !window.JSApplet.JSME) {
        console.error("JSME not loaded");
        return;
      }

      this.jsmeApplet = new window.JSApplet.JSME(
        this.id,
        this.props.width,
        this.props.height,
        optionParameters
      );
    }

    this.jsmeApplet!.setCallBack(
      "AfterStructureModified",
      (jsmeEvent: JSMEEvent) => {
        this.drawnSmiles = jsmeEvent.src.smiles();

        if (this.props.onChange) {
          this.props.onChange(jsmeEvent);
        }
      }
    );

    if (this.props.smiles) {
      await this.jsmeApplet!.readGenericMolecularInput(
        HorusSmilesManager.cleanSmiles(this.props.smiles || "")
      );
    }

    // Remove the blue "drag and drop" icon that appears by default
    if (this.props.removePolygon !== false) {
      this.removePolygon();
    }
  };

  private async removePolygon() {
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Remove the blue "drag and drop" icon that appears by default
    const elements = document.querySelectorAll(
      'div[title="drag out molecule file (MOL format)"], img[title="drag out molecule file (MOL format)"], polygon[fill="blue"]'
    );

    if (elements) {
      elements.forEach((el) => {
        el.remove();
      });
    }
  }

  override componentDidMount() {
    this.handleJsmeLoad();
  }

  override componentWillUnmount() {}

  override async componentDidUpdate(prevProps: SmilesViewProps) {
    if (!this.jsmeApplet) {
      return;
    }

    // Height changed
    if (
      this.props.height !== prevProps.height ||
      this.props.width !== prevProps.width
    ) {
      this.jsmeApplet.setSize(this.props.width, this.props.height);
    }

    // Options changed
    if (this.props.options !== prevProps.options) {
      this.jsmeApplet.options({
        options: this.generateOptionsString(this.props.options ?? {}),
        ...prevProps.parameters
      });
    }

    // Smiles changed
    if (
      this.props.smiles !== prevProps.smiles &&
      this.props.smiles !== this.drawnSmiles
    ) {
      // Check that the smiles string exists, is not empty...
      if (this.props.smiles) {
        await this.jsmeApplet.readGenericMolecularInput(
          HorusSmilesManager.cleanSmiles(this.props.smiles)
        );
      } else {
        // Clean the view
        this.jsmeApplet.reset();
      }
    }

    if (this.props.removePolygon !== false) {
      this.removePolygon();
    }
  }

  override render() {
    return (
      <div
        {...this.props.containerProps}
        style={{
          ...(this.props.containerProps?.style || {}),
          position: "relative",
          width: this.props.width,
          height: this.props.height
        }}
      >
        <div
          id={this.id}
          style={{
            pointerEvents: this.props.options?.zoom === false ? "none" : "auto"
          }}
        />
        {this.props.onClickEdit && (
          <button
            style={{
              background: "white",
              position: "absolute",
              paddingInline: "5px",
              paddingBlock: "2px",
              bottom: "0px",
              right: "0px",
              zIndex: 10,
              borderTop: "1px solid lightgray",
              borderLeft: "1px solid lightgray"
            }}
            onClick={this.props.onClickEdit}
          >
            Edit
          </button>
        )}
      </div>
    );
  }
}
