import { Token, TokenType, Tokenizer, TokenizerError } from './tokenizer';

// AST Node types
export type ASTNode =
  | BinaryExpression
  | UnaryExpression
  | FunctionCall
  | Identifier
  | NumberLiteral
  | StringLiteral;

export interface BinaryExpression {
  type: 'BinaryExpression';
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryExpression {
  type: 'UnaryExpression';
  operator: string;
  argument: ASTNode;
}

export interface FunctionCall {
  type: 'FunctionCall';
  name: string;
  arguments: ASTNode[];
}

export interface Identifier {
  type: 'Identifier';
  name: string;
}

export interface NumberLiteral {
  type: 'NumberLiteral';
  value: number;
}

export interface StringLiteral {
  type: 'StringLiteral';
  value: string;
}

export class ParseError extends Error {
  constructor(
    message: string,
    public position: number,
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

/**
 * Recursive descent parser for compensation formula expressions.
 *
 * Operator precedence (low to high):
 * 1. Comparison: ==, !=, >, <, >=, <=
 * 2. Addition/Subtraction: +, -
 * 3. Multiplication/Division/Modulo: *, /, %
 * 4. Unary: -, +
 * 5. Function calls, identifiers, literals, parenthesized expressions
 */
export class Parser {
  private tokens: Token[];
  private pos: number;

  constructor(private input: string) {
    this.tokens = [];
    this.pos = 0;
  }

  parse(): ASTNode {
    const tokenizer = new Tokenizer(this.input);
    this.tokens = tokenizer.tokenize();
    this.pos = 0;

    const ast = this.parseExpression();

    if (this.current().type !== TokenType.EOF) {
      throw new ParseError(
        `Unexpected token: '${this.current().value}'`,
        this.current().position,
      );
    }

    return ast;
  }

  private current(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const token = this.tokens[this.pos];
    this.pos++;
    return token;
  }

  private expect(type: TokenType, value?: string): Token {
    const token = this.current();
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      throw new ParseError(
        `Expected ${type}${value ? ` '${value}'` : ''}, got ${token.type} '${token.value}'`,
        token.position,
      );
    }
    return this.advance();
  }

  // Expression → Comparison
  private parseExpression(): ASTNode {
    return this.parseComparison();
  }

  // Comparison → Addition ( ( '==' | '!=' | '>' | '<' | '>=' | '<=' ) Addition )*
  private parseComparison(): ASTNode {
    let left = this.parseAddition();

    while (this.current().type === TokenType.COMPARISON_OP) {
      const operator = this.advance().value;
      const right = this.parseAddition();
      left = { type: 'BinaryExpression', operator, left, right };
    }

    return left;
  }

  // Addition → Multiplication ( ( '+' | '-' ) Multiplication )*
  private parseAddition(): ASTNode {
    let left = this.parseMultiplication();

    while (
      this.current().type === TokenType.OPERATOR &&
      (this.current().value === '+' || this.current().value === '-')
    ) {
      const operator = this.advance().value;
      const right = this.parseMultiplication();
      left = { type: 'BinaryExpression', operator, left, right };
    }

    return left;
  }

  // Multiplication → Unary ( ( '*' | '/' | '%' ) Unary )*
  private parseMultiplication(): ASTNode {
    let left = this.parseUnary();

    while (
      this.current().type === TokenType.OPERATOR &&
      (this.current().value === '*' ||
        this.current().value === '/' ||
        this.current().value === '%')
    ) {
      const operator = this.advance().value;
      const right = this.parseUnary();
      left = { type: 'BinaryExpression', operator, left, right };
    }

    return left;
  }

  // Unary → ( '-' | '+' ) Unary | Primary
  private parseUnary(): ASTNode {
    if (
      this.current().type === TokenType.OPERATOR &&
      (this.current().value === '-' || this.current().value === '+')
    ) {
      const operator = this.advance().value;
      const argument = this.parseUnary();
      return { type: 'UnaryExpression', operator, argument };
    }

    return this.parsePrimary();
  }

  // Primary → NUMBER | STRING | IDENTIFIER ( '(' args ')' )? | '(' Expression ')'
  private parsePrimary(): ASTNode {
    const token = this.current();

    switch (token.type) {
      case TokenType.NUMBER: {
        this.advance();
        return { type: 'NumberLiteral', value: parseFloat(token.value) };
      }

      case TokenType.STRING: {
        this.advance();
        return { type: 'StringLiteral', value: token.value };
      }

      case TokenType.IDENTIFIER: {
        this.advance();
        // Check if this is a function call
        if (this.current().type === TokenType.LPAREN) {
          return this.parseFunctionCall(token.value);
        }
        return { type: 'Identifier', name: token.value };
      }

      case TokenType.LPAREN: {
        this.advance(); // consume '('
        const expr = this.parseExpression();
        this.expect(TokenType.RPAREN);
        return expr;
      }

      default:
        throw new ParseError(
          `Unexpected token: '${token.value}'`,
          token.position,
        );
    }
  }

  private parseFunctionCall(name: string): FunctionCall {
    this.expect(TokenType.LPAREN); // consume '('
    const args: ASTNode[] = [];

    if (this.current().type !== TokenType.RPAREN) {
      args.push(this.parseExpression());

      while (this.current().type === TokenType.COMMA) {
        this.advance(); // consume ','
        args.push(this.parseExpression());
      }
    }

    this.expect(TokenType.RPAREN); // consume ')'
    return { type: 'FunctionCall', name, arguments: args };
  }
}
