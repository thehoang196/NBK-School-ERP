import { ASTNode } from './parser';

/**
 * Converts an AST back to a formatted string representation.
 * Ensures consistent formatting of formulas.
 */
export class PrettyPrinter {
  print(node: ASTNode): string {
    return this.visitNode(node);
  }

  private visitNode(node: ASTNode): string {
    switch (node.type) {
      case 'NumberLiteral':
        return this.formatNumber(node.value);

      case 'StringLiteral':
        return `"${this.escapeString(node.value)}"`;

      case 'Identifier':
        return node.name;

      case 'UnaryExpression':
        return this.printUnary(node.operator, node.argument);

      case 'BinaryExpression':
        return this.printBinary(node.operator, node.left, node.right);

      case 'FunctionCall':
        return this.printFunctionCall(node.name, node.arguments);

      default:
        return '';
    }
  }

  private formatNumber(value: number): string {
    // Remove trailing zeros for decimals
    if (Number.isInteger(value)) {
      return value.toString();
    }
    return value.toString();
  }

  private escapeString(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private printUnary(operator: string, argument: ASTNode): string {
    const argStr = this.visitNode(argument);
    // Wrap in parentheses if argument is a binary expression
    if (argument.type === 'BinaryExpression') {
      return `${operator}(${argStr})`;
    }
    return `${operator}${argStr}`;
  }

  private printBinary(operator: string, left: ASTNode, right: ASTNode): string {
    const leftStr = this.wrapIfNeeded(left, operator, 'left');
    const rightStr = this.wrapIfNeeded(right, operator, 'right');
    return `${leftStr} ${operator} ${rightStr}`;
  }

  private printFunctionCall(name: string, args: ASTNode[]): string {
    const argStrings = args.map((arg) => this.visitNode(arg));
    return `${name}(${argStrings.join(', ')})`;
  }

  private wrapIfNeeded(node: ASTNode, parentOp: string, side: 'left' | 'right'): string {
    const str = this.visitNode(node);

    if (node.type === 'BinaryExpression') {
      const childPrecedence = this.getPrecedence(node.operator);
      const parentPrecedence = this.getPrecedence(parentOp);

      // Wrap if child has lower precedence
      if (childPrecedence < parentPrecedence) {
        return `(${str})`;
      }

      // Wrap right-side same-precedence for non-associative ops (-, /)
      if (
        side === 'right' &&
        childPrecedence === parentPrecedence &&
        (parentOp === '-' || parentOp === '/' || parentOp === '%')
      ) {
        return `(${str})`;
      }
    }

    return str;
  }

  private getPrecedence(operator: string): number {
    switch (operator) {
      case '==':
      case '!=':
      case '>':
      case '<':
      case '>=':
      case '<=':
        return 1;
      case '+':
      case '-':
        return 2;
      case '*':
      case '/':
      case '%':
        return 3;
      default:
        return 0;
    }
  }
}
