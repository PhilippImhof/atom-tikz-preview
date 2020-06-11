# tikz-preview package

TikZ-Preview is an extension for [Atom.io](https://atom.io/), providing support for inline previewing of TikZ drawings in a LaTeX document.

## Features

- Preview TikZ drawings inside your document
- In case of compilation errors: jump to line that (probably) caused the error
- Use preamble from a root file configured using the magic comment `% !TEX root = /path/to/file.tex`
- Use preamble from a root file set via [atom-latex](https://atom.io/packages/atom-latex)

## Requirements

- LaTeX installation (obviously)
- having [atom-latex](https://atom.io/packages/atom-latex) installed is recommended

## Usage

- Preview can be invoked from  the command palette: `Tikz Preview: Show`
- Default keybinding for `tikz-preview:show` is <kbd>ctrl</kbd>+<kbd>alt</kbd>+<kbd>O</kbd>

## Screenshot

![Screenshot](https://user-images.githubusercontent.com/52650214/84370996-50331780-abd9-11ea-859c-7ad0a5a2ceeb.png)
