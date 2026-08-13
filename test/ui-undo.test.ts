/**
 * Undo stack semantics: one entry per gesture, redo tail discarded on new
 * commits, bounded capacity. Pure logic, no DOM.
 */

import { describe, expect, it } from "vitest";
import { UndoStack } from "../src/ui/undo";

describe("UndoStack", () => {
  it("starts at the initial state with nothing to undo or redo", () => {
    const stack = new UndoStack("a");
    expect(stack.current).toBe("a");
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);
    expect(stack.undo()).toBeNull();
    expect(stack.redo()).toBeNull();
  });

  it("undoes and redoes through a linear history", () => {
    const stack = new UndoStack("a");
    stack.push("b");
    stack.push("c");
    expect(stack.current).toBe("c");
    expect(stack.undo()).toBe("b");
    expect(stack.undo()).toBe("a");
    expect(stack.undo()).toBeNull();
    expect(stack.redo()).toBe("b");
    expect(stack.redo()).toBe("c");
    expect(stack.redo()).toBeNull();
  });

  it("discards the redo tail when a new state is pushed after undo", () => {
    const stack = new UndoStack("a");
    stack.push("b");
    stack.push("c");
    stack.undo(); // at b
    stack.push("d");
    expect(stack.current).toBe("d");
    expect(stack.canRedo()).toBe(false);
    expect(stack.undo()).toBe("b");
    expect(stack.redo()).toBe("d");
  });

  it("drops the oldest entry when capacity is exceeded", () => {
    const stack = new UndoStack(0, 3);
    stack.push(1);
    stack.push(2);
    stack.push(3); // 0 falls off: [1, 2, 3]
    expect(stack.size).toBe(3);
    expect(stack.undo()).toBe(2);
    expect(stack.undo()).toBe(1);
    expect(stack.undo()).toBeNull();
  });

  it("treats snapshots as opaque values (object identity preserved)", () => {
    const a = { params: { x: 1 } };
    const b = { params: { x: 2 } };
    const stack = new UndoStack(a);
    stack.push(b);
    expect(stack.undo()).toBe(a);
    expect(stack.redo()).toBe(b);
  });

  it("reports current correctly while stepping around", () => {
    const stack = new UndoStack("a");
    stack.push("b");
    stack.undo();
    expect(stack.current).toBe("a");
    expect(stack.canRedo()).toBe(true);
    stack.redo();
    expect(stack.current).toBe("b");
  });
});
