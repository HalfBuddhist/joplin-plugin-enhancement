// implemented according to https://github.com/ylc395/joplin-plugin-note-link-system/blob/main/src/driver/codeMirror/UrlFolder.ts

import { debounce } from "ts-debounce";
import clickAndClear from "./click-and-clear";
import {isRangeSelected} from "./cm-utils";
import { safeCreateMarker } from "./marker-collision-prevention";

interface MarkerMatch {
    match;
}

export default class CMInlineMarkerHelperV2 {
    renderer: (match, from, to) => any;
    lineFilter: (line: string) => boolean;
    clicked: (match, e: MouseEvent) => void;
    regex;
    MARKER_CLASS_NAME: string;

    constructor(private readonly editor, regex, renderer, MARKER_CLASS_NAME, lineFilter?, clicked?) {
        this.regex = regex;
        this.renderer = renderer;
        this.lineFilter = lineFilter;
        this.clicked = clicked;
        this.MARKER_CLASS_NAME = MARKER_CLASS_NAME;
    }

    /**
     * This function should be in editor.operation()
     */
    public process(afterSetValue: boolean = false) {
        const viewport = this.editor.getViewport()
        const doc = this.editor.getDoc();
        const currentCursor = this.editor.getCursor();

        let fromLine = viewport.from;
        let toLine = viewport.to;

        if (afterSetValue) {
            fromLine = 0;

            // improve user experience;
            // todo: decide whether use smaller number or not
            toLine = this.editor.lineCount();
        }

        for (let lineNo = fromLine; lineNo < toLine; ++lineNo) {
            const line = doc.getLine(lineNo);
            if (!line) {
                continue;
            }

            if (this.lineFilter) {
                if (!this.lineFilter(line)) {
                    continue;
                }
            }

            // to process the situations like ==Hello **World**== correctly
            //   we need to get all match and process with specific orders
            let lineMatches: MarkerMatch[] = [];
            for (const match of line.matchAll(this.regex)) {
                // by default, we ignore inline code between ` and ```
                const tokenType = this.editor.getTokenTypeAt({line: lineNo, ch: match.index});
                if (tokenType && tokenType.includes('jn-monospace')) {
                    continue;
                }
                lineMatches.push({
                    match: match
                });
            }

            // we need to process from inside out, which means we need to process them in reverse order
            for (let currIndex = lineMatches.length - 1; currIndex >= 0; --currIndex) {
                const markerMatch = lineMatches[currIndex];
                this.foldByMatch(doc, lineNo, markerMatch.match);
            }
        }
    }

    private foldByMatch(doc, lineNo, match) {
        if (match) {
            const cursor = this.editor.getCursor();
            const from = {line: lineNo, ch: match.index};
            const to = {line: lineNo, ch: match.index + match[0].length};

            // Clear ALL existing markers in the range, not just ones with matching class names
            const existingMarkers = this.editor.findMarks(from, to);
            existingMarkers.forEach(marker => {
                // Only clear markers that are completely within our range to avoid partial overlaps
                const markerRange = marker.find();
                if (markerRange && 
                    markerRange.from.line >= from.line && markerRange.from.ch >= from.ch &&
                    markerRange.to.line <= to.line && markerRange.to.ch <= to.ch) {
                    marker.clear();
                }
            });

            let selected = isRangeSelected(from, to, this.editor);

            if (!selected) {
                // not fold when the cursor is in the block
                if (!(cursor.line === lineNo && cursor.ch >= from.ch && cursor.ch <= to.ch)) {
                    const element = this.renderer(match, from, to);
                    const textMarker = safeCreateMarker(this.editor, from, to, {
                        replacedWith: element,
                        className: this.MARKER_CLASS_NAME, // class name is not renderer in DOM
                        clearOnEnter: true,
                        inclusiveLeft: false,
                        inclusiveRight: false
                    });

                    if (textMarker) {
                        element.onclick = (e) => {
                            if (e.ctrlKey || e.metaKey) {
                                e.preventDefault();
                                if (this.clicked) {
                                    this.clicked(match, e);
                                }
                            } else {
                                clickAndClear(textMarker, this.editor)(e);
                            }
                        };
                    }
                }
            }
        }
    }
}
