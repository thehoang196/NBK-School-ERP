import { ASTNode } from './parser';

export interface ValidationError {
  message: string;
  node: string;
}

export interface ValidationContext {
  variableCodes: Set<string>;
  payComponentCodes: Set<string>;
  functionNames: Set<string>;
}

/**
 * Validates AST nodes:
 * - All identifiers must be either variable codes, pay component codes, or function parameters
 * - All function calls must reference existing functions in the function library
 */
export class FormulaValidator {
  private errors: ValidationError[];
  private context: ValidationContext;

  constructor(context: ValidationContext) {
    this.context = context;
    this.errors = [];
  }

  validate(ast: ASTNode): ValidationError[] {
    this.errors = [];
    this.visitNode(ast);
    return this.errors;
  }

  private visitNode(node: ASTNode): void {
    switch (node.type) {
      case 'BinaryExpression':
        this.visitNode(node.left);
        this.visitNode(node.right);
        break;

      case 'UnaryExpression':
        this.visitNode(node.argument);
        break;

      case 'FunctionCall':
        this.validateFunctionCall(node.name, node.arguments);
        break;

      case 'Identifier':
        this.validateIdentifier(node.name);
        break;

      case 'NumberLiteral':
      case 'StringLiteral':
        // Always valid
        break;
    }
  }

  private validateIdentifier(name: string): void {
    if (
      !this.context.variableCodes.has(name) &&
      !this.context.payComponentCodes.has(name)
    ) {
      this.errors.push({
        message: `Unknown identifier: '${name}'. Must be a valid variable or pay component code.`,
        node: name,
      });
    }
  }

  private validateFunctionCall(name: string, args: ASTNode[]): void {
    if (!this.context.functionNames.has(name)) {
      this.errors.push({
        message: `Unknown function: '${name}'. Function does not exist in the function library.`,
        node: name,
      });
    }

    // Validate arguments recursively
    for (const arg of args) {
      this.visitNode(arg);
    }
  }
}
