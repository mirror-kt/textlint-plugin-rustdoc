import { ASTNodeTypes } from "@textlint/ast-node-types";

export const mappings = {
  line_comment: ASTNodeTypes.Document,
  doc_comment: ASTNodeTypes.Str,
};
