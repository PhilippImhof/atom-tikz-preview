"use babel";
//
// tikz-helper
//
// This module will handle the process of compiling the LaTeX document in order
// to build the preview image
//

const TIKZ_SCOPE = "meta.function.environment.latex.tikz";
const TIMEOUT = 60 * 1000;

export default {
  TIKZ_SCOPE,

  compileLatex(tex, callback) {
    let temp = require("@atom/temp");
    let fs = require("fs");
    let path = require("path");
    let exec = require("child_process").exec;

    // Automatically track and cleanup files at exit
    temp.track();

    let tempDir;
    try {
      tempDir = temp.mkdirSync("tikzpreview");
    } catch (error) {
      return {
        status: "failure",
        step: "tempdir",
        errorMsg: error.message,
        pdfData: null
      };
    }

    let inputFile = path.join(tempDir, "tikz.tex");
    fs.writeFile(inputFile, tex, (error) => {
        if (error) {
          return {
            status: "failure",
            step: "write tex file",
            errorMsg: error.message,
            pdfData: null
          };
        }

        // --file-line-error
        exec("latexmk -pdf -latexoption=\"-interaction=nonstopmode\" \"" + inputFile + "\"", {
            cwd: tempDir,
            timeout: TIMEOUT
          }, (error, stdout, stderr) => {
            if (error) {
              let parseOutput= stdout.match(/(?:!|tikz\.tex:[0-9]+:) ((?:.+)(?:(?:[\s\S])+?l.([0-9]+).+))?/);
              callback({
                status: "failure",
                step: "compile",
                errorMsg: error.message,
                stdout: stdout,
                stderr: stderr,
                latexError: parseOutput[1].replace(/^l.[0-9]+ /m, ""),
                errorLine: parseInt(parseOutput[2])
              });
              return;
            }
            let outputFile = path.join(tempDir, "tikz.pdf");
            fs.readFile(outputFile, (error, data) => {
                if (error) {
                  return {
                    status: "failure",
                    step: "read pdf",
                    errorMsg: error.message,
                    pdfData: null
                  };
                }
                callback({
                    status: "success",
                    pdfData: String.fromCharCode(...data)
                });
            });
        });
    });
},

getTikzPreamble(file) {
    let fs = require("fs");
    let path = require("path");

    let preamble = "";
    try {
      preamble = fs.readFileSync(file, "utf8");
    } catch (error) {
      atom.notifications.addWarning(error.message);
      return "";
    }

    // remove everything after the preamble
    preamble = preamble.replace(/\\begin{document}[\s\S]*$/, "");

    // add commands for preview
    let previewCommands = "\\PassOptionsToPackage{active,tightpage}{preview}\n" +
      "\\AtBeginDocument{\\ifx\\ifPreview\\undefined\\RequirePackage{preview}" +
      "\\PreviewEnvironment{tikzpicture}\\fi}\n";

    // for input commands: translate path
    preamble = preamble.replace(/\\input{([^}]+)}/, (match, p1, offset, str) => {
      return "\\input{" + path.resolve(path.dirname(file), p1) + "}"
    });

    return previewCommands + preamble;
  },

  getTikzBlockAtCursor(cursor, editor) {
    // if not in a TikZ picture, return with empty text
    if (!cursor.getScopeDescriptor().getScopesArray().includes(TIKZ_SCOPE)) {
      return {
        text: "",
        range: [
          [0, 0],
          [0, 0]
        ]
      };
    }

    // still here? find complete TikZ picture environment
    let range = editor.bufferRangeForScopeAtCursor(TIKZ_SCOPE);
    let start = range.start.row;
    let end = range.end.row;

    // move start up until the end of the tikz scope
    do {
      start--;
    } while (editor.scopeDescriptorForBufferPosition([start, 0]).getScopesArray().includes(TIKZ_SCOPE))

    // move end down until the end of the tikz scope
    do {
      end++;
    } while (editor.scopeDescriptorForBufferPosition([end, 0]).getScopesArray().includes(TIKZ_SCOPE))

    range = [
      [start + 1, 0],
      [end - 1, 9999]
    ];
    let text = editor.getTextInBufferRange(range);

    return {
      text,
      range
    };
  },

};
