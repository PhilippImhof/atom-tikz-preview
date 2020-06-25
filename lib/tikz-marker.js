"use babel";
import TikzView from "./tikz-view";

export default class TikzMarker {
  constructor(cursor,range) {
    this.cursor = cursor;
    this.range=range;
    this.marker = null;
    this.addTikzView();
  }

  addTikzView() {
    this.view = new TikzView();

    this.marker = this.cursor.editor.markBufferRange(this.range, {
      invalidate: "surround"
    });

    this.cursor.editor.decorateMarker(this.marker, {
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
