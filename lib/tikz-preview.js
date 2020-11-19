"use babel";

import {
  CompositeDisposable,
  Range
} from "atom";
import TikzMarker from "./tikz-marker";
import tikzHelper from "./tikz-helper";

// store markers for each editor tab
// editor#1 -> {id#1: marker#1, id#2: marker#2, ...} etc.
let activeMarkers = new WeakMap();

export default {

  subscriptions: null,
  editor: null,
  marker: null,

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

    this.marker = newMarker;
  },

  // fetch text to be rendered as a preview
  // also returns the range of the selection / environment
  // returning null, if no selection is given and auto-detect fails
  fetchText() {
    // if the user has selected some text, proceed with that, no matter what
    if (this.editor.getSelectedText() !== "") {
      return {
        text: this.editor.getSelectedText(),
        range: this.editor.getSelectedBufferRange()
      }
    }

    // no selection, trying to detect boundaries of tikzpicture
    // no longer using grammars for this, because they are not smarter than a simple regex
    // e.g. \begin%\n{tikzpicture} would be valid, but is not recognized by grammars
    let start = this.editor.getLastCursor().getBufferRow();
    let end = start;
    let lineCount = this.editor.getLineCount();

    // move start up until the end of the tikzpicture
    // if we reach the end of another tikzpicture or the beginning of the document, this is bad
    let curLine = "";
    for (let i = start; i >= 0; i--) {
      curLine = this.editor.lineTextForBufferRow(i);
      if (curLine.includes("\\begin{tikzpicture}")) {
        start = i;
        break;
      } else if ((curLine.includes("\\end{tikzpicture}") || curLine.includes("\\begin{document}")) && i!=start) {
        return null;
        break;
      }
    }

    // move end down until the end of the tikz scope
    for (let i = end; i < lineCount; i++) {
      curLine = this.editor.lineTextForBufferRow(i);
      if (curLine.includes("\\end{tikzpicture}")) {
        end = i;
        break;
      } else if ((curLine.includes("\\begin{tikzpicture}") || curLine.includes("\\end{document}")) && i!=end) {
        return null;
        break;
      }
    }

    let range = new Range([start, 0], [end, 9999]);
    let text = this.editor.getTextInBufferRange(range);
    return {
      text,
      range
    };
  },

  showCompilationError(response, sourceFileOrEditor, preamble) {
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
        // in case of unkonwn compilation error (e.g. no output was made, but no particular error)
        // we stop here, it makes no sense to jump anywhere
        if (isNaN(response.errorLine)) {
          break;
        }
        if (response.errorLine >= preambleLines) {
          // lines of preamble + \begin{document}, subtract one more, because index starts with 0
          this.marker.cursor.setBufferPosition([response.errorLine - preambleLines - 2 + this.marker.range.start.row, 0]);
        } else {
          // error in preamble: open file (or activate tab) and jump to line that might have caused the problem
          // subtract 2 lines for additional code added before compilation
          // and another one, because index starts with 0
          // if the source was an unsaved file, <pathOrEditor> will not be of type string
          if (typeof sourceFileOrEditor === "string") {
            atom.workspace.open(sourceFileOrEditor, {
              initialLine: response.errorLine - 3
            });
          } else {
            let pane = atom.workspace.paneForItem(sourceFileOrEditor);
            pane.activate();
            if (pane.activeItem !== sourceFileOrEditor) {
              let items = pane.getItems();
              for (let i = 0; i < items.length; i++) {
                if (items[i] === sourceFileOrEditor) {
                  pane.activateItemAtIndex(i);
                  break;
                }
              }
            }
            sourceFileOrEditor.setCursorBufferPosition([response.errorLine - 3, 0]);
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
  },

  fetchPreamble(pathOrEditor) {
    let fs = require("fs");
    let path = require("path");

    let preamble = "";
    // unsaved file -> use editor contents
    if (typeof pathOrEditor !== "string") {
      preamble = pathOrEditor.getText();
    } else {
      try {
        preamble = fs.readFileSync(pathOrEditor, "utf8");
      } catch (error) {
        atom.notifications.addWarning(error.message);
        return "";
      }
    }

    // remove everything after the preamble
    preamble = preamble.replace(/\\begin{document}[\s\S]*$/, "");

    // add commands for preview
    let previewCommands = "\\PassOptionsToPackage{active,tightpage}{preview}\n" +
      "\\AtBeginDocument{\\ifx\\ifPreview\\undefined\\RequirePackage{preview}" +
      "\\PreviewEnvironment{tikzpicture}\\fi}\n";

    // for input commands: translate path
    preamble = preamble.replace(/\\input{([^}]+)}/, (match, p1, offset, str) => {
      return "\\input{" + path.resolve(path.dirname(pathOrEditor), p1) + "}"
    });

    return previewCommands + preamble;
  },

  showPreview() {
    // only proceed if we are in a text editor
    if (!(this.editor = atom.workspace.getActiveTextEditor())) {
      return;
    }

    let stuffToRender = this.fetchText();
    if (!stuffToRender) {
      atom.notifications.addWarning("Could not locate your TikZ picture near the cursor. Please select the part you want to preview.");
      return;
    }

    // create popup and show we're actually working...
    let marker = new TikzMarker(this.editor.getLastCursor(), stuffToRender.range);
    this.registerMarker(marker);

    // get the preamble and prepare TeX to be rendered
    let pathOrEditor = this.findRootFile(this.editor)
    let preamble = this.fetchPreamble(pathOrEditor)
    let tex = preamble + "\n\\begin{document}\n" + stuffToRender.text + "\n\\end{document}";

    tikzHelper.compileLatex(tex, (response) => {
      if (response.status == "success") {
        this.marker.view.pdfData = response.pdfData;
      } else {
        this.showCompilationError(response, pathOrEditor, preamble);
        this.marker.destroy();
      }
    });
  }

};
