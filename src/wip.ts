import Parser, {Query} from '@keqingmoe/tree-sitter';
import RustLanguage from 'tree-sitter-rust';

const parser = new Parser();
parser.setLanguage(RustLanguage);

const tree = parser.parse(`
/// This is a rustdoc comment.
/// next line.
fn main() {
    // some comment.
    println!("Hello World!");
}
`);

const query = new Query(RustLanguage, `
; Rustdocコメントを抽出するクエリ

; 行ドキュメントコメント（/// と //!）
(line_comment) @doc.line
(#match? @doc.line "^///|^//!")

; ブロックドキュメントコメント（/** */ と /*! */）
(block_comment) @doc.block
(#match? @doc.block "^/\\\\*\\\\*|^/\\\\*!")

; 特定のアイテムに紐づくドキュメントコメントを取得する場合
; 関数のドキュメント
(
  (line_comment)+ @doc.function
  .
  (function_item
    name: (identifier) @function.name)
  (#match? @doc.function "^///")
)

; 構造体のドキュメント
(
  (line_comment)+ @doc.struct
  .
  (struct_item
    name: (type_identifier) @struct.name)
  (#match? @doc.struct "^///")
)

; 列挙型のドキュメント
(
  (line_comment)+ @doc.enum
  .
  (enum_item
    name: (type_identifier) @enum.name)
  (#match? @doc.enum "^///")
)

; トレイトのドキュメント
(
  (line_comment)+ @doc.trait
  .
  (trait_item
    name: (type_identifier) @trait.name)
  (#match? @doc.trait "^///")
)

; implブロックのドキュメント
(
  (line_comment)+ @doc.impl
  .
  (impl_item)
  (#match? @doc.impl "^///")
)

; モジュールのドキュメント
(
  (line_comment)+ @doc.module
  .
  (mod_item
    name: (identifier) @module.name)
  (#match? @doc.module "^///")
)

; 内部ドキュメントコメント（//! クレート/モジュールレベル）
(line_comment) @doc.inner
(#match? @doc.inner "^//!")
`);

const root = tree.rootNode;
const captures = query.captures(root);
console.log(captures);