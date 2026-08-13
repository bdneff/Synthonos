/**
 * Undo/redo over immutable snapshots. Pure logic, no React, no DOM.
 *
 * Semantics: the stack always holds the committed history, with `index`
 * pointing at the current state. Every completed user gesture (knob
 * release, macro release, preset load, natural language edit) commits
 * exactly one snapshot via push(). Undoing then pushing a new state
 * discards the redo tail, like every editor the user has ever used.
 */

export class UndoStack<T> {
  private entries: T[];
  private index: number;
  private readonly capacity: number;

  constructor(initial: T, capacity = 100) {
    this.entries = [initial];
    this.index = 0;
    this.capacity = Math.max(2, capacity);
  }

  /** The state the stack currently points at. */
  get current(): T {
    return this.entries[this.index];
  }

  canUndo(): boolean {
    return this.index > 0;
  }

  canRedo(): boolean {
    return this.index < this.entries.length - 1;
  }

  /**
   * Commit a new state. Discards any redo tail. When capacity is
   * exceeded the oldest entry falls off the bottom.
   */
  push(state: T): void {
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push(state);
    if (this.entries.length > this.capacity) {
      this.entries.shift();
    }
    this.index = this.entries.length - 1;
  }

  /** Step back. Returns the restored state, or null at the bottom. */
  undo(): T | null {
    if (!this.canUndo()) return null;
    this.index -= 1;
    return this.entries[this.index];
  }

  /** Step forward. Returns the restored state, or null at the top. */
  redo(): T | null {
    if (!this.canRedo()) return null;
    this.index += 1;
    return this.entries[this.index];
  }

  /** Number of committed entries (including the initial state). */
  get size(): number {
    return this.entries.length;
  }
}
