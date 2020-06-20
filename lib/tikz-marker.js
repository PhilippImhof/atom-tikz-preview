"use babel";
import TikzView from "./tikz-view";
import tikzHelper from "./tikz-helper";

export default class TikzMarker {
  constructor(cursor, editor) {
    this.editor = editor;

    let result = tikzHelper.getTikzBlockAtCursor(cursor, editor);
    if (!result) {
      throw new Error("Could not find TikZ picture at cursor");
    }
    this.range = result.range;
    this.cursor = cursor;

    this.marker = null;
    this.addTikzView();
  }

  addTikzView() {
    this.view = new TikzView();

    this.marker = this.editor.markBufferRange(this.range, {
      invalidate: "surround"
    });

    this.editor.decorateMarker(this.marker, {
      type: "block",
      item: this.view,
      position: "after"
    });

    this.view.onClose((event) => {
      this.marker.destroy();
    });
  }

  destroy() {
    this.marker.destroy();
  }

}
