import { ASTNode } from './parser';

/**
 * Extracts all identifier references from an AST that correspond to PayComponent codes.
 * Used to build the dependency graph between pay components.
 */
export class DependencyExtractor {
  private payComponentCodes: Set<string>;

  constructor(payComponentCodes: Set<string>) {
    this.payComponentCodes = payComponentCodes;
  }

  /**
   * Extract all pay component code references from the AST.
   * Returns a deduplicated array of pay component codes that the formula depends on.
   */
  extract(ast: ASTNode): string[] {
    const deps = new Set<string>();
    this.visitNode(ast, deps);
    return Array.from(deps);
  }

  /**
   * Extract all identifier references (both variables and pay components).
   */
  extractAllIdentifiers(ast: ASTNode): string[] {
    const identifiers = new Set<string>();
    this.visitAllIdentifiers(ast, identifiers);
    return Array.from(identifiers);
  }

  /**
   * Extract only variable references (identifiers that are NOT pay component codes).
   */
  extractVariableRefs(ast: ASTNode, variableCodes: Set<string>): string[] {
    const vars = new Set<string>();
    this.visitVariableRefs(ast, variableCodes, vars);
    return Array.from(vars);
  }

  private visitNode(node: ASTNode, deps: Set<string>): void {
    switch (node.type) {
      case 'Identifier':
        if (this.payComponentCodes.has(node.name)) {
          deps.add(node.name);
        }
        break;
      case 'BinaryExpression':
        this.visitNode(node.left, deps);
        this.visitNode(node.right, deps);
        break;
      case 'UnaryExpression':
        this.visitNode(node.argument, deps);
        break;
      case 'FunctionCall':
        for (const arg of node.arguments) {
          this.visitNode(arg, deps);
        }
        break;
      case 'NumberLiteral':
      case 'StringLiteral':
        break;
    }
  }

  private visitAllIdentifiers(node: ASTNode, identifiers: Set<string>): void {
    switch (node.type) {
      case 'Identifier':
        identifiers.add(node.name);
        break;
      case 'BinaryExpression':
        this.visitAllIdentifiers(node.left, identifiers);
        this.visitAllIdentifiers(node.right, identifiers);
        break;
      case 'UnaryExpression':
        this.visitAllIdentifiers(node.argument, identifiers);
        break;
      case 'FunctionCall':
        for (const arg of node.arguments) {
          this.visitAllIdentifiers(arg, identifiers);
        }
        break;
      case 'NumberLiteral':
      case 'StringLiteral':
        break;
    }
  }

  private visitVariableRefs(
    node: ASTNode,
    variableCodes: Set<string>,
    vars: Set<string>,
  ): void {
    switch (node.type) {
      case 'Identifier':
        if (variableCodes.has(node.name)) {
          vars.add(node.name);
        }
        break;
      case 'BinaryExpression':
        this.visitVariableRefs(node.left, variableCodes, vars);
        this.visitVariableRefs(node.right, variableCodes, vars);
        break;
      case 'UnaryExpression':
        this.visitVariableRefs(node.argument, variableCodes, vars);
        break;
      case 'FunctionCall':
        for (const arg of node.arguments) {
          this.visitVariableRefs(arg, variableCodes, vars);
        }
        break;
      case 'NumberLiteral':
      case 'StringLiteral':
        break;
    }
  }
}
