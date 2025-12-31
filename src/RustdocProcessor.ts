import Parser, { Query } from "@keqingmoe/tree-sitter";
import type {
  TextlintMessage,
  TextlintPluginOptions,
  TextlintPluginPostProcessResult,
  TextlintPluginPreProcessResult,
  TextlintPluginProcessor,
} from "@textlint/types";
import RustLanguage from "tree-sitter-rust";
import { convertToTextlintAst } from "./comment.js";

// Rustdocコメントを抽出するクエリ
// 行コメントとブロックコメントを全て取得し、後でフィルタリング
const RUSTDOC_QUERY = `
; 行コメント（/// と //! を含む）
(line_comment) @comment

; ブロックコメント（/** */ と /*! */ を含む）
(block_comment) @comment
`;

export class RustdocProcessor implements TextlintPluginProcessor {
  options: TextlintPluginOptions;
  private readonly parser: Parser;
  private readonly query: Query;

  constructor(options: TextlintPluginOptions = {}) {
    this.options = options;
    this.parser = new Parser();
    this.parser.setLanguage(RustLanguage);
    this.query = new Query(RustLanguage, RUSTDOC_QUERY);
  }

  availableExtensions(): Array<string> {
    return [".rs"];
  }

  processor(_extension: string): {
    preProcess(
      text: string,
      filePath?: string,
    ): TextlintPluginPreProcessResult | Promise<TextlintPluginPreProcessResult>;
    postProcess(
      messages: Array<TextlintMessage>,
      filePath?: string,
    ):
      | TextlintPluginPostProcessResult
      | Promise<TextlintPluginPostProcessResult>;
  } {
    const parser = this.parser;
    const query = this.query;

    return {
      preProcess(
        text: string,
        _filePath?: string,
      ): TextlintPluginPreProcessResult {
        // Rustソースコードをパース
        const tree = parser.parse(text);
        const rootNode = tree.rootNode;

        // クエリを実行してコメントノードを取得
        const captures = query.captures(rootNode);

        // キャプチャされたノードを抽出（重複を除去）
        const seenNodes = new Set<number>();
        const commentNodes = captures
          .map((capture) => capture.node)
          .filter((node) => {
            // startIndexで重複をチェック
            if (seenNodes.has(node.startIndex)) {
              return false;
            }
            seenNodes.add(node.startIndex);
            return true;
          })
          // 出現順にソート
          .sort((a, b) => a.startIndex - b.startIndex);

        // textlint ASTに変換
        const ast = convertToTextlintAst(commentNodes, text);
        return ast;
      },

      postProcess(
        messages: Array<TextlintMessage>,
        filePath?: string,
      ): TextlintPluginPostProcessResult {
        return {
          messages,
          filePath: filePath ?? "<rust>",
        };
      },
    };
  }
}
