import type { SyntaxNode } from "@keqingmoe/tree-sitter";
import {
    ASTNodeTypes,
    type TxtDocumentNode,
    type TxtParagraphNode,
    type TxtStrNode,
} from "@textlint/ast-node-types";

/**
 * Rustdocコメントの種類
 */
type RustdocType = "outer_line" | "inner_line" | "outer_block" | "inner_block";

/**
 * Rustdocコメントのプレフィックスを判定して種類を返す
 *
 * @param text - コメントの生テキスト
 * @returns Rustdocの種類、またはnull（Rustdocでない場合）
 */
function getRustdocType(text: string): RustdocType | null {
    if (text.startsWith("///")) {
        return "outer_line";
    }
    if (text.startsWith("//!")) {
        return "inner_line";
    }
    if (text.startsWith("/**") && !text.startsWith("/***")) {
        return "outer_block";
    }
    if (text.startsWith("/*!")) {
        return "inner_block";
    }
    return null;
}

/**
 * Rustdocコメントからプレフィックスを除去してコンテンツを抽出
 *
 * @param text - コメントの生テキスト
 * @param docType - Rustdocの種類
 * @returns プレフィックス除去後のコンテンツとオフセット情報
 */
function extractContent(
    text: string,
    docType: RustdocType,
): { content: string; prefixLength: number } {
    switch (docType) {
        case "outer_line": {
            // `/// ` または `///` を除去
            const match = text.match(/^\/\/\/\s?/);
            const prefixLength = match ? match[0].length : 3;
            return {
                content: text.slice(prefixLength),
                prefixLength,
            };
        }
        case "inner_line": {
            // `//! ` または `//!` を除去
            const match = text.match(/^\/\/!\s?/);
            const prefixLength = match ? match[0].length : 3;
            return {
                content: text.slice(prefixLength),
                prefixLength,
            };
        }
        case "outer_block": {
            // `/** */` を除去し、各行の先頭の ` * ` も除去
            const inner = text.slice(3, -2); // `/**` と `*/` を除去
            return {
                content: processBlockContent(inner),
                prefixLength: 3,
            };
        }
        case "inner_block": {
            // `/*! */` を除去し、各行の先頭の ` * ` も除去
            const inner = text.slice(3, -2); // `/*!` と `*/` を除去
            return {
                content: processBlockContent(inner),
                prefixLength: 3,
            };
        }
    }
}

/**
 * ブロックコメントの内容を処理
 * 各行の先頭の ` * ` パターンを除去
 *
 * @param content - ブロックコメントの内部コンテンツ
 * @returns 処理後のコンテンツ
 */
function processBlockContent(content: string): string {
    const lines = content.split("\n");
    return lines
        .map((line) => {
            // 行頭の空白と `*` を除去
            return line.replace(/^\s*\*\s?/, "");
        })
        .join("\n")
        .trim();
}

/**
 * tree-sitterのSyntaxNodeからtextlintのTxtStrNodeを生成
 *
 * @param node - tree-sitterのSyntaxNode
 * @param docType - Rustdocの種類
 * @returns TxtStrNode
 */
function createStrNode(node: SyntaxNode, docType: RustdocType): TxtStrNode {
    const { content, prefixLength } = extractContent(node.text, docType);

    // 行コメントの場合、プレフィックス分だけ開始位置をずらす
    const startColumn = node.startPosition.column + prefixLength;
    const startIndex = node.startIndex + prefixLength;

    return {
        type: ASTNodeTypes.Str,
        raw: content,
        value: content,
        range: [startIndex, node.endIndex],
        loc: {
            start: {
                line: node.startPosition.row + 1, // textlintは1-indexed
                column: startColumn,
            },
            end: {
                line: node.endPosition.row + 1,
                column: node.endPosition.column,
            },
        },
    };
}

/**
 * 連続するRustdocコメントノードからParagraphノードを生成
 *
 * @param nodes - 連続するSyntaxNodeの配列
 * @returns TxtParagraphNode
 */
function createParagraphNode(nodes: SyntaxNode[]): TxtParagraphNode | null {
    if (nodes.length === 0) return null;

    const children: TxtStrNode[] = [];

    for (const node of nodes) {
        const docType = getRustdocType(node.text);
        if (docType === null) continue;

        children.push(createStrNode(node, docType));
    }

    if (children.length === 0) return null;

    const firstChild = children.at(0);
    const lastChild = children.at(-1);

    if (firstChild === undefined || lastChild === undefined) return null;

    return {
        type: ASTNodeTypes.Paragraph,
        raw: nodes.map((n) => n.text).join("\n"),
        range: [firstChild.range[0], lastChild.range[1]],
        loc: {
            start: firstChild.loc.start,
            end: lastChild.loc.end,
        },
        children,
    };
}

/**
 * Rustdocコメントノードの配列をグループ化
 * 連続する行のコメントを1つのグループにまとめる
 *
 * @param nodes - SyntaxNodeの配列
 * @returns グループ化されたノードの配列
 */
function groupConsecutiveNodes(nodes: SyntaxNode[]): SyntaxNode[][] {
    if (nodes.length === 0) return [];

    const firstNode = nodes[0];
    if (firstNode === undefined) return [];

    const groups: SyntaxNode[][] = [];
    let currentGroup: SyntaxNode[] = [firstNode];

    for (let i = 1; i < nodes.length; i++) {
        const prevNode = nodes.at(i - 1);
        const currentNode = nodes.at(i);

        if (prevNode === undefined || currentNode === undefined) continue;

        // 前のコメントの開始行の直後にあるかチェック
        // tree-sitterのendPosition.rowは改行を含むため、startPositionで比較する
        const isConsecutive =
            currentNode.startPosition.row === prevNode.startPosition.row + 1;

        if (isConsecutive) {
            currentGroup.push(currentNode);
        } else {
            groups.push(currentGroup);
            currentGroup = [currentNode];
        }
    }

    groups.push(currentGroup);
    return groups;
}

/**
 * tree-sitterのRustdocコメントノード配列をtextlint ASTのDocumentノードに変換
 *
 * @param docNodes - Rustdocコメントを含むSyntaxNodeの配列
 * @param rawText - 元のソースコード全体
 * @returns TxtDocumentNode
 */
export function convertToTextlintAst(
    docNodes: SyntaxNode[],
    rawText: string,
): TxtDocumentNode {
    // Rustdocコメントのみをフィルタリング
    const rustdocNodes = docNodes.filter((node) => {
        return getRustdocType(node.text) !== null;
    });

    // 連続するコメントをグループ化
    const groups = groupConsecutiveNodes(rustdocNodes);

    // 各グループをParagraphノードに変換
    const children: TxtParagraphNode[] = [];
    for (const group of groups) {
        const paragraph = createParagraphNode(group);
        if (paragraph) {
            children.push(paragraph);
        }
    }

    // Documentノードを生成
    const firstChild = children.at(0);
    const lastChild = children.at(-1);

    if (firstChild === undefined || lastChild === undefined) {
        return {
            type: ASTNodeTypes.Document,
            raw: rawText,
            range: [0, rawText.length],
            loc: {
                start: { line: 1, column: 0 },
                end: { line: 1, column: 0 },
            },
            children: [],
        };
    }

    return {
        type: ASTNodeTypes.Document,
        raw: rawText,
        range: [firstChild.range[0], lastChild.range[1]],
        loc: {
            start: firstChild.loc.start,
            end: lastChild.loc.end,
        },
        children,
    };
}

/**
 * 単一のRustdocコメントノードをtextlint ASTに変換（後方互換性のため残す）
 *
 * @param docNode - tree-sitterのSyntaxNode
 * @returns TxtStrNode または null
 */
export function traverse(docNode: SyntaxNode): TxtStrNode | null {
    const docType = getRustdocType(docNode.text);
    if (docType === null) return null;

    return createStrNode(docNode, docType);
}

// 型とユーティリティ関数をエクスポート
export { getRustdocType, extractContent, groupConsecutiveNodes };
export type { RustdocType };
