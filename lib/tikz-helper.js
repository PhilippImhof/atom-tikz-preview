"use babel";
//
// tikz-helper
//
// This module will handle the process of compiling the LaTeX document in order
// to build the preview image
//
const TIMEOUT = 60 * 1000;

export default {
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

        // FIXME: error can also be <*> tikz instead of l.xxx
        // --file-line-error
        exec("echo x | latexmk -pdf \"" + inputFile + "\"", {
            cwd: tempDir,
            timeout: TIMEOUT
          }, (error, stdout, stderr) => {
            if (error) {
              let parseOutput=stdout.match(/(?:!|tikz\.tex:[0-9]+:) ((?:.+)(?:[\s\S]+?))(?:l.([0-9]+)[\s\S]+)?(?:\?|!)/);
              if (parseOutput===null) {
                parseOutput=stdout.match(/(?:!|tikz\.tex:[0-9]+:) ((?:.+)(?:[\s\S]+?))/);
              }
              callback({
                status: "failure",
                step: "compile",
                errorMsg: error.message,
                stdout: stdout,
                stderr: stderr,
                latexError: (parseOutput[1] || "Unknown compilation error"),
                errorLine: parseInt(parseOutput[2] || "0")
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

};
