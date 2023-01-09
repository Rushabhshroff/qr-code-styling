import getMode from "../tools/getMode";
import mergeDeep from "../tools/merge";
import downloadURI from "../tools/downloadURI";
import QRSVG from "./QRSVG";

import defaultOptions, { RequiredOptions } from "./QROptions";
import sanitizeOptions from "../tools/sanitizeOptions";
import { Extension, QRCode, Options, DownloadOptions } from "../types";
import qrcode from "qrcode-generator";

export default class QRCodeStyling {
  _options: RequiredOptions;
  _container?: HTMLElement;
  // _canvas?: QRCanvas;
  _svg!: QRSVG;
  _qr?: QRCode;
  _canvasDrawingPromise?: Promise<void>;
  _svgDrawingPromise?: Promise<void>;

  constructor(options?: Partial<Options>) {
    this._options = options ? sanitizeOptions(mergeDeep(defaultOptions, options) as RequiredOptions) : defaultOptions;
    this.update();
  }

  static _clearContainer(container?: HTMLElement): void {
    if (container) {
      container.innerHTML = "";
    }
  }

  async _getQRStylingElement(): Promise<QRSVG> {
    if (!this._qr) throw "QR code is empty";

    let promise, svg: QRSVG;

    if (this._svg && this._svgDrawingPromise) {
      svg = this._svg;
      promise = this._svgDrawingPromise;
    } else {
      svg = new QRSVG(this._options);
      promise = svg.drawQR(this._qr);
    }

    await promise;

    return svg;
  }

  update(options?: Partial<Options>): void {
    QRCodeStyling._clearContainer(this._container);
    this._options = options ? sanitizeOptions(mergeDeep(this._options, options) as RequiredOptions) : this._options;

    if (!this._options.data) {
      return;
    }

    this._qr = qrcode(this._options.qrOptions.typeNumber, this._options.qrOptions.errorCorrectionLevel);
    this._qr.addData(this._options.data, this._options.qrOptions.mode || getMode(this._options.data));
    this._qr.make();

    this._svg = new QRSVG(this._options);
    this._svgDrawingPromise = this._svg.drawQR(this._qr);
    this._canvasDrawingPromise = undefined;

    this.append(this._container);
  }

  append(container?: HTMLElement): void {
    if (!container) {
      return;
    }

    if (typeof container.appendChild !== "function") {
      throw "Container should be a single DOM node";
    }

    container.appendChild(this._svg.getElement());

    this._container = container;
  }

  async getCanvas() {
    let canvas = document.createElement('canvas')
    canvas.height = this._svg.height
    canvas.width = this._svg.width
    let ctx = canvas.getContext('2d');
    let image = new Image()
    let rawData = await this.getBase64Data()

    image.src = rawData
    await new Promise((resolve, reject) => {
      image.onload = ()=>{
        ctx?.drawImage(image,0,0)
        resolve(null)
      }
      image.onerror = (ev,s,l,n,e)=>{
        reject(e)
      }
    })
    return canvas
  }

  async getBlobData(): Promise<Blob> {
    if (!this._qr) throw "QR code is empty";
    const element = await this._getQRStylingElement();
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString((element as unknown as QRSVG).getElement());

    return new Blob(['<?xml version="1.0" standalone="no"?>\r\n' + source], { type: "image/svg+xml" });
  }

  async getBase64Data(): Promise<string> {
    let blob = await this.getBlobData()
    return new Promise<string>((resolve,reject)=>{
      var reader = new FileReader();
      reader.onloadend = function() {
        resolve(reader.result as string)
      }
      reader.onerror = (e)=>{
        reject("Failed to Read Blob")
      }
      reader.readAsDataURL(blob);
    })
  }

  async download(downloadOptions?: Partial<DownloadOptions> | string): Promise<void> {
    if (!this._qr) throw "QR code is empty";
    let extension = "png" as Extension;
    let name = "qr";

    //TODO remove deprecated code in the v2
    if (typeof downloadOptions === "string") {
      extension = downloadOptions as Extension;
      console.warn(
        "Extension is deprecated as argument for 'download' method, please pass object { name: '...', extension: '...' } as argument"
      );
    } else if (typeof downloadOptions === "object" && downloadOptions !== null) {
      if (downloadOptions.name) {
        name = downloadOptions.name;
      }
      if (downloadOptions.extension) {
        extension = downloadOptions.extension;
      }
    }

    const element = await this._getQRStylingElement();

    if (extension.toLowerCase() === "svg") {
      const serializer = new XMLSerializer();
      let source = serializer.serializeToString((element as unknown as QRSVG).getElement());

      source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
      const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
      downloadURI(url, `${name}.svg`);
    } else {

    }
  }
}
