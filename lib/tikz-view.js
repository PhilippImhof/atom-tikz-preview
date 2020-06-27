"use babel";

import {
  Emitter
} from "atom";

const DEFAULT_SCALE = 2;

class _TikzView extends HTMLElement {
  createdCallback() {
    // Date.now() is not guaranteed to be unique, but only Chuck Norris
    // is able to preview more than one TikZ picture in a millisecond
    this.pdfCanvasId = "pdf-" + Date.now();

    this.scale = DEFAULT_SCALE;
    this.emitter = new Emitter();

    this.pdfjsLib = require('pdfjs-dist/es5/build/pdf.js');
    this.pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/es5/build/pdf.worker.js');

    this.onClose = this.onClose.bind(this);
    this.destroy = this.destroy.bind(this);
    this.zoomOrig = this.zoomOrig.bind(this);
    this.zoomIn = this.zoomIn.bind(this);
    this.zoomOut = this.zoomOut.bind(this);

    this.classList.add('tikz-preview');

    this.element = createElement('div', {
      class: 'tikz-preview ready'
    });

    let closeBtn = createElement('div', {
      class: 'btn btn-tikz-preview btn-close icon icon-x'
    });
    closeBtn.addEventListener('click', this.destroy);

    let zoomInBtn = createElement('div', {
      class: 'btn btn-tikz-preview icon icon-plus'
    });
    zoomInBtn.addEventListener('click', this.zoomIn);

    let zoomOutBtn = createElement('div', {
      class: 'btn btn-tikz-preview icon icon-dash'
    });
    zoomOutBtn.addEventListener('click', this.zoomOut);

    let zoomOrigBtn = createElement('div', {
      class: 'btn btn-tikz-preview btn-zoom-orig icon'
    });
    zoomOrigBtn.addEventListener('click', this.zoomOrig);

    let toolbar = createElement('div', {
      class: 'toolbar',
      children: [closeBtn, zoomInBtn, zoomOrigBtn, zoomOutBtn]
    });

    this.contents = createElement('div', {
      class: 'contents'
    });
    this.contents.appendChild(createElement('div', {
      class: 'loading loading-spinner-medium inline-block'
    }));

    this.appendChild(toolbar);
    this.appendChild(this.contents);
  }

  set pdfData(data) {
    if (data == null) {
      return;
    }
    this.scale = DEFAULT_SCALE;
    this._pdfData = data;
    this.classList.add("ready");
    this.contents.innerHTML = '';
    this.contents.appendChild(createElement("canvas", {
      id: this.pdfCanvasId
    }));
    this.preview();
  }

  preview() {
    let scale = this.scale;
    let pdfCanvasId = this.pdfCanvasId;
    let loadingTask = this.pdfjsLib.getDocument({
      data: this._pdfData
    });
    loadingTask.promise.then((pdf) => {
      let pageNumber = 1;
      pdf.getPage(pageNumber).then((page) => {
        var viewport = page.getViewport({
          scale: scale
        });

        // Prepare canvas using PDF page dimensions
        let canvas = this.querySelector("#"+pdfCanvasId);
        let context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render PDF page into canvas context
        let renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        let renderTask = page.render(renderContext);
        renderTask.promise.then(() => {
          // page rendering complete
        });
      });
    }, (reason) => {
      // PDF loading error
      console.error(reason);
    });
  }

  get pdfdata() {
    return this._pdfData;
  }

  onClose(callback) {
    return this.emitter.on("was-closed", callback);
  }

  destroy() {
    return this.emitter.emit("was-closed");
  }

  getElement() {
    return this;
  }

  zoomOrig() {
    this.scale = DEFAULT_SCALE;
    this.preview();
  }

  zoomIn() {
    this.scale = this.scale * 1.5;
    this.preview();
  }

  zoomOut() {
    this.scale = this.scale / 1.5;
    this.preview();
  }

}

function createElement(tag, attr = {}, textContent = "") {
  let el = document.createElement(tag);
  el.textContent = textContent;

  if (attr.hasOwnProperty("children")) {
    for (const child of attr.children) {
      el.appendChild(child);
    }
    delete attr.children;
  }

  for (const key of Object.keys(attr)) {
    const val = attr[key];
    el.setAttribute(key, val);
  }

  return el;
}


let TikzView = document.registerElement("tikz-view", _TikzView);

export default TikzView;
