import assert from "node:assert";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type {
  TxtDocumentNode,
  TxtParagraphNode,
} from "@textlint/ast-node-types";
import { test as testAst } from "@textlint/ast-tester";
import { RustdocProcessor } from "./RustdocProcessor.js";

const __filename = fileURLToPath(import.meta.url);

describe(__filename, () => {
  describe("RustdocProcessor", () => {
    describe("availableExtensions", () => {
      it("returns .rs extension", () => {
        const processor = new RustdocProcessor();
        assert.deepStrictEqual(processor.availableExtensions(), [".rs"]);
      });
    });

    describe("processor", () => {
      describe("preProcess", () => {
        it("returns valid textlint AST for line doc comments", () => {
          const processor = new RustdocProcessor();
          const { preProcess } = processor.processor(".rs");

          const result = preProcess(
            `/// This is a rustdoc comment.
/// next line.
fn main() {
    // some comment.
    println!("Hello World!");
}`,
          ) as TxtDocumentNode;

          assert.strictEqual(result.type, "Document");
          assert.strictEqual(result.children.length, 1);

          const firstChild = result.children[0] as TxtParagraphNode;
          assert.strictEqual(firstChild.type, "Paragraph");
          assert.strictEqual(firstChild.children.length, 2);

          assert.doesNotThrow(() => {
            testAst(result as unknown as Record<string, unknown>);
          });
        });

        it("returns valid textlint AST for inner doc comments", () => {
          const processor = new RustdocProcessor();
          const { preProcess } = processor.processor(".rs");

          const result = preProcess(
            `//! Crate-level documentation.
//! This describes the crate.

fn main() {}`,
          ) as TxtDocumentNode;

          assert.strictEqual(result.type, "Document");
          assert.strictEqual(result.children.length, 1);

          const firstChild = result.children[0] as TxtParagraphNode;
          assert.strictEqual(firstChild.children.length, 2);

          assert.doesNotThrow(() => {
            testAst(result as unknown as Record<string, unknown>);
          });
        });

        it("groups non-consecutive comments into separate paragraphs", () => {
          const processor = new RustdocProcessor();
          const { preProcess } = processor.processor(".rs");

          const result = preProcess(
            `/// First function doc.
fn first() {}

/// Second function doc.
fn second() {}`,
          ) as TxtDocumentNode;

          assert.strictEqual(result.type, "Document");
          // 2つの別々のParagraphになるはず
          assert.strictEqual(result.children.length, 2);

          assert.doesNotThrow(() => {
            testAst(result as unknown as Record<string, unknown>);
          });
        });

        it("ignores regular comments", () => {
          const processor = new RustdocProcessor();
          const { preProcess } = processor.processor(".rs");

          const result = preProcess(
            `// This is a regular comment.
fn main() {
    // Another regular comment.
}`,
          ) as TxtDocumentNode;

          assert.strictEqual(result.type, "Document");
          // 通常コメントは除外されるので、childrenは空
          assert.strictEqual(result.children.length, 0);

          assert.doesNotThrow(() => {
            testAst(result as unknown as Record<string, unknown>);
          });
        });

        it("handles block doc comments", () => {
          const processor = new RustdocProcessor();
          const { preProcess } = processor.processor(".rs");

          const result = preProcess(
            `/**
 * Block doc comment.
 * Multiple lines.
 */
fn main() {}`,
          ) as TxtDocumentNode;

          assert.strictEqual(result.type, "Document");
          assert.strictEqual(result.children.length, 1);

          assert.doesNotThrow(() => {
            testAst(result as unknown as Record<string, unknown>);
          });
        });
      });

      describe("postProcess", () => {
        it("returns messages and filePath", () => {
          const processor = new RustdocProcessor();
          const { postProcess } = processor.processor(".rs");

          const result = postProcess([], "test.rs") as {
            messages: unknown[];
            filePath: string;
          };

          assert.deepStrictEqual(result.messages, []);
          assert.strictEqual(result.filePath, "test.rs");
        });

        it("uses default filePath when not provided", () => {
          const processor = new RustdocProcessor();
          const { postProcess } = processor.processor(".rs");

          const result = postProcess([]) as {
            messages: unknown[];
            filePath: string;
          };

          assert.strictEqual(result.filePath, "<rust>");
        });
      });
    });
  });
});
