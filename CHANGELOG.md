## 0.2.7 - Bugfix and improvement
* Automatic detection of the `tikzpicture` environment now also works when the cursor is on the same line as `\begin{tikzpicture}` or `\end{tikzpicture}`.
* Parsing of compilation output improved for cases where LaTeX outputs `<*>` instead of `l.xxx` (line number), e.g. with certain errors in `pgfplots`.
* Bugfix: preview of PDF was not rendered if preview bubble was off screen when compilation ended.

## 0.2.6 - Improvement, Refactoring
* If there is an active selection, we try to preview that text, even if no `\begin{tikzpicture}` and `\end{tikzpicture}` is present. This is for people who use custom macros or environments to create their pictures
* No longer relying on grammar files

## 0.2.5 - Bugfix
* Missed a mistake in the code.

## 0.2.4 - Bugfix and improvement
## 0.2.3 - Bugfix and improvement
* If document starts or ends with the `tikzpicture` environment, we could get trapped in an endless loop while finding the limits of the environment.
* Improved handling in cases compilation won't stop because of certain errors in a `tikzpicture` (e.g. missing semicolon)
* Improved handling of newly created and unsaved documents

## 0.2.2 - Bugfix
* In documents with soft-wrapped lines, the preview sometimes appeared at the wrong position.

## 0.2.1 - Bufgix
* Style definitions messed up buttons in Atom

## 0.2.0 - Minor update to files, no new functionality

## 0.1.0 - First Release
* Basic functionality
