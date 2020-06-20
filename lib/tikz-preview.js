"use babel";

import {
  CompositeDisposable
} from "atom";
import TikzMarker from "./tikz-marker";
import tikzHelper from "./tikz-helper";

// store markers for each editor tab
// editor#1 -> {id#1: marker#1, id#2: marker#2, ...} etc.
let activeMarkers = new WeakMap();

export default {

  subscriptions: null,

  activate(state) {
    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(atom.commands.add("atom-workspace", {
      "tikz-preview:show": () => this.showPreview()
    }));
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  serialize() {},

  findRootFile(editor) {
    let fs = require("fs");
    let path = require("path");
    let curDoc = editor.getText();

    // first: if current document is usable, it should be the root file
    if (curDoc.includes("\\documentclass") && curDoc.includes("\\begin{document}")) {
      // if the file is unsaved, return the editor instead
      return editor.getPath() || editor;
    }

    // second: try !TEX root setting in current editor
    let regex = /[\s\S]*%\s*!TEX\sroot\s*=\s*(\S+\.tex)[\s\S]*/;
    if (curDoc.match(regex)) {
      let texRootSetting = curDoc.replace(regex, "$1");
      pathToRootFile = path.resolve(path.dirname(editor.getPath()), texRootSetting);
      if (fs.existsSync(pathToRootFile)) {
        return pathToRootFile;
      }
    }

    // third: try atom-latex root file
    let pathToRootFile = (document.getElementById("atom-latex-root-text") || {
      innerText: ""
    }).innerText;
    if (fs.existsSync(pathToRootFile)) {
      return pathToRootFile;
    }

    atom.notifications.addWarning("No valid TeX root file available. Using current file with fingers crossed.");
    return editor.getPath() || editor;
  },

  registerMarker(newMarker) {
    let markersForEditor = {};

    // load markers for this editor tab
    if (activeMarkers.has(this.editor)) {
      markersForEditor = activeMarkers.get(this.editor);
      // check if there is already an active marker for this environment
      // if there is, remove it; the new marker should replace the old one
      for (marker of Object.values(markersForEditor)) {
        if (marker.marker.getBufferRange().containsPoint(newMarker.cursor.getBufferPosition())) {
          marker.destroy();
        }
      }
    }

    // add given marker to list of markers for the current editor tab
    markersForEditor[newMarker.marker.id] = newMarker;

    // update the list of markers; only necessary, if this editor did not have any markerViews
    // but setting it is not expensive, so not worth an if
    activeMarkers.set(this.editor, markersForEditor)
  },

  showPreview() {
    // only proceed if we are in a text editor
    if (!(this.editor = atom.workspace.getActiveTextEditor())) {
      return;
    }

    // only proceed if in latex document
    if (!this.editor.getRootScopeDescriptor().getScopesArray().includes("text.tex.latex")) {
      return;
    }

    let cursor = this.editor.getLastCursor();
    let scope = cursor.getScopeDescriptor();

    if (scope.getScopesArray().includes(tikzHelper.TIKZ_SCOPE)) {
      // create popup and show we're actually working...
      let mark = new TikzMarker(cursor, this.editor);
      this.registerMarker(mark);

      let pathOrEditor = this.findRootFile(this.editor)
      let preamble = tikzHelper.getTikzPreamble(pathOrEditor)

      let tex = preamble +
        "\n\\begin{document}\n" +
        tikzHelper.getTikzBlockAtCursor(cursor, this.editor).text +
        "\n\\end{document}";

      tikzHelper.compileLatex(tex, (response) => {
        if (response.status == "success") {
          mark.view.pdfData = response.pdfData;
        } else {
          switch (response.step) {
            case "tempdir":
              atom.notifications.addError("Compilation failed: Could not create temporary directory.", {
                dismissable: true,
                detail: errorMsg
              });
              break;
            case "write tex file":
              atom.notifications.addError("Compilation failed: Could not write LaTeX file.", {
                dismissable: true,
                detail: errorMsg
              });
              break;
            case "compile":
              atom.notifications.addError("Compilation failed. Possible cause:", {
                dismissable: true,
                detail: response.latexError
              });
              let preambleLines = preamble.split(/\r\n|\r|\n/).length;
              if (response.errorLine >= preambleLines) {
                // lines of preamble + \begin{document}, subtract one more, because index starts with 0
                cursor.setBufferPosition([response.errorLine - preambleLines - 2 + mark.range[0][0], 0]);
              } else {
                // error in preamble: open file (or activate tab) and jump to line that might have caused the problem
                // subtract 2 lines for additional code added before compilation
                // and another one, because index starts with 0
                // if the source was an unsaved file, <pathOrEditor> will not be of type string
                if (typeof pathOrEditor==="string") {
                  atom.workspace.open(pathOrEditor, {
                    initialLine: response.errorLine - 3
                  });
                } else {
                  let pane = atom.workspace.paneForItem(pathOrEditor);
                  pane.activate();
                  if (pane.activeItem!==pathOrEditor) {
                    let items=pane.getItems();
                    for (let i=0;i<items.length;i++) {
                      if (items[i]===pathOrEditor) {
                        pane.activateItemAtIndex(i);
                        break;
                      }
                    }
                  }
                  pathOrEditor.setCursorBufferPosition([response.errorLine - 3,0]);
                }
              }
              break;
            case "read pdf":
              atom.notifications.addError("Compilation failed: Could not read output PDF.", {
                dismissable: true,
                detail: errorMsg
              });
              break;
            default:
              atom.notifications.addError("Compilation failed for unknown reason. This should not happen.", {
                dismissable: true
              });
          }
          mark.destroy();
        }
      });
    } else {
      atom.notifications.addWarning("Could not find any TikZ picture near the cursor");
      return;
    }
  }

};
