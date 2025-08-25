/**
 * Utility functions to prevent CodeMirror marker collisions
 * This addresses the "Inserting collapsed marker partially overlapping an existing one" error
 */

import { Editor, Position, TextMarker } from 'codemirror';

/**
 * Safely clear all markers in a given range to prevent overlaps
 * @param editor CodeMirror editor instance
 * @param from Start position
 * @param to End position
 * @param className Optional class name to filter markers (if not provided, clears all markers in range)
 */
export function clearMarkersInRange(editor: Editor, from: Position, to: Position, className?: string): void {
    const existingMarkers = editor.findMarks(from, to);
    
    existingMarkers.forEach(marker => {
        // If className is specified, only clear markers with that class
        if (className && marker.className !== className) {
            return;
        }
        
        const markerRange = marker.find();
        if (markerRange && 'from' in markerRange && 'to' in markerRange) {
            // Only clear markers that are completely within our range to avoid partial overlaps
            if (markerRange.from.line >= from.line && markerRange.from.ch >= from.ch &&
                markerRange.to.line <= to.line && markerRange.to.ch <= to.ch) {
                marker.clear();
            }
        }
    });
}

/**
 * Check if it's safe to create a marker in the given range
 * @param editor CodeMirror editor instance
 * @param from Start position
 * @param to End position
 * @returns true if safe to create marker, false otherwise
 */
export function canCreateMarker(editor: Editor, from: Position, to: Position): boolean {
    const existingMarkers = editor.findMarks(from, to);
    return existingMarkers.length === 0;
}

/**
 * Safely create a text marker with collision prevention
 * @param editor CodeMirror editor instance
 * @param from Start position
 * @param to End position
 * @param options Marker options
 * @returns TextMarker if created successfully, null if collision prevented creation
 */
export function safeCreateMarker(editor: Editor, from: Position, to: Position, options: any): TextMarker | null {
    // First clear any existing markers in the range
    clearMarkersInRange(editor, from, to);
    
    // Double-check that no markers exist before creating
    if (canCreateMarker(editor, from, to)) {
        return editor.getDoc().markText(from, to, options);
    }
    
    return null;
}