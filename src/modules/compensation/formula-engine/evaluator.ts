import { ASTNode } from './parser';

export class EvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvaluationError';
  }
}

export interface EvaluationContext {
  variables: Record<string, number>;
  functions: Record<string, (...args: number[]) => number>;
}

/**
 * Evaluates an AST with a given context (variables and function library).
 * All values are treated as numbers during evaluation.
 */
export class Evaluator {
  private context: EvaluationContext;

  constructor(context: EvaluationContext) {
    this.context = context;
  }

  evaluate(node: ASTNode): number {
    switch (node.type) {
      case 'NumberLiteral':
        return node.value;

      case 'StringLiteral':
        // Strings in numeric context evaluate to 0 or attempt parse
        const parsed = parseFloat(node.value);
        return isNaN(parsed) ? 0 : parsed;

      case 'Identifier':
        return this.evaluateIdentifier(node.name);

      case 'UnaryExpression':
        return this.evaluateUnary(node.operator, node.argument);

      case 'BinaryExpression':
        return this.evaluateBinary(node.operator, node.left, node.right);

      case 'FunctionCall':
        return this.evaluateFunctionCall(node.name, node.arguments);

      default:
        throw new EvaluationError(`Unknown node type: ${(node as ASTNode).type}`);
    }
  }

  private evaluateIdentifier(name: string): number {
    if (name in this.context.variables) {
      return this.context.variables[name];
    }
    throw new EvaluationError(`Undefined variable: '${name}'`);
  }

  private evaluateUnary(operator: string, argument: ASTNode): number {
    const value = this.evaluate(argument);
    switch (operator) {
      case '-':
        return -value;
      case '+':
        return value;
      default:
        throw new EvaluationError(`Unknown unary operator: '${operator}'`);
    }
  }

  private evaluateBinary(operator: string, left: ASTNode, right: ASTNode): number {
    const leftVal = this.evaluate(left);
    const rightVal = this.evaluate(right);

    switch (operator) {
      case '+':
        return leftVal + rightVal;
      case '-':
        return leftVal - rightVal;
      case '*':
        return leftVal * rightVal;
      case '/':
        if (rightVal === 0) {
          throw new EvaluationError('Division by zero');
        }
        return leftVal / rightVal;
      case '%':
        if (rightVal === 0) {
          throw new EvaluationError('Modulo by zero');
        }
        return leftVal % rightVal;
      // Comparison operators return 1 (true) or 0 (false)
      case '==':
        return leftVal === rightVal ? 1 : 0;
      case '!=':
        return leftVal !== rightVal ? 1 : 0;
      case '>':
        return leftVal > rightVal ? 1 : 0;
      case '<':
        return leftVal < rightVal ? 1 : 0;
      case '>=':
        return leftVal >= rightVal ? 1 : 0;
      case '<=':
        return leftVal <= rightVal ? 1 : 0;
      default:
        throw new EvaluationError(`Unknown operator: '${operator}'`);
    }
  }

  private evaluateFunctionCall(name: string, args: ASTNode[]): number {
    if (!(name in this.context.functions)) {
      throw new EvaluationError(`Unknown function: '${name}'`);
    }

    const evaluatedArgs = args.map((arg) => this.evaluate(arg));
    return this.context.functions[name](...evaluatedArgs);
  }
}
