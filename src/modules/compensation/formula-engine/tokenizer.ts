export enum TokenType {
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  IDENTIFIER = 'IDENTIFIER',
  OPERATOR = 'OPERATOR',
  COMPARISON_OP = 'COMPARISON_OP',
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  COMMA = 'COMMA',
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

export class TokenizerError extends Error {
  constructor(
    message: string,
    public position: number,
  ) {
    super(message);
    this.name = 'TokenizerError';
  }
}

export class Tokenizer {
  private input: string;
  private pos: number;
  private tokens: Token[];

  constructor(input: string) {
    this.input = input;
    this.pos = 0;
    this.tokens = [];
  }

  tokenize(): Token[] {
    this.tokens = [];
    this.pos = 0;

    while (this.pos < this.input.length) {
      this.skipWhitespace();
      if (this.pos >= this.input.length) break;

      const ch = this.input[this.pos];

      if (this.isDigit(ch) || (ch === '.' && this.isDigit(this.peek(1)))) {
        this.readNumber();
      } else if (ch === '"' || ch === "'") {
        this.readString(ch);
      } else if (this.isIdentifierStart(ch)) {
        this.readIdentifier();
      } else if (this.isComparisonStart(ch)) {
        this.readComparisonOrOperator();
      } else if (this.isOperator(ch)) {
        this.tokens.push({
          type: TokenType.OPERATOR,
          value: ch,
          position: this.pos,
        });
        this.pos++;
      } else if (ch === '(') {
        this.tokens.push({
          type: TokenType.LPAREN,
          value: '(',
          position: this.pos,
        });
        this.pos++;
      } else if (ch === ')') {
        this.tokens.push({
          type: TokenType.RPAREN,
          value: ')',
          position: this.pos,
        });
        this.pos++;
      } else if (ch === ',') {
        this.tokens.push({
          type: TokenType.COMMA,
          value: ',',
          position: this.pos,
        });
        this.pos++;
      } else {
        throw new TokenizerError(`Unexpected character: '${ch}'`, this.pos);
      }
    }

    this.tokens.push({ type: TokenType.EOF, value: '', position: this.pos });
    return this.tokens;
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      this.pos++;
    }
  }

  private peek(offset: number): string {
    return this.input[this.pos + offset] || '';
  }

  private isDigit(ch: string): boolean {
    return /[0-9]/.test(ch);
  }

  private isIdentifierStart(ch: string): boolean {
    return /[a-zA-Z_]/.test(ch);
  }

  private isIdentifierPart(ch: string): boolean {
    return /[a-zA-Z0-9_]/.test(ch);
  }

  private isOperator(ch: string): boolean {
    return ['+', '-', '*', '/', '%'].includes(ch);
  }

  private isComparisonStart(ch: string): boolean {
    return ['>', '<', '=', '!'].includes(ch);
  }

  private readNumber(): void {
    const start = this.pos;
    let hasDecimal = false;

    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (this.isDigit(ch)) {
        this.pos++;
      } else if (ch === '.' && !hasDecimal) {
        hasDecimal = true;
        this.pos++;
      } else {
        break;
      }
    }

    this.tokens.push({
      type: TokenType.NUMBER,
      value: this.input.slice(start, this.pos),
      position: start,
    });
  }

  private readString(quote: string): void {
    const start = this.pos;
    this.pos++; // skip opening quote

    while (this.pos < this.input.length && this.input[this.pos] !== quote) {
      if (this.input[this.pos] === '\\') {
        this.pos++; // skip escape character
      }
      this.pos++;
    }

    if (this.pos >= this.input.length) {
      throw new TokenizerError('Unterminated string literal', start);
    }

    this.pos++; // skip closing quote
    // Store value without quotes
    const raw = this.input.slice(start + 1, this.pos - 1);
    this.tokens.push({
      type: TokenType.STRING,
      value: raw,
      position: start,
    });
  }

  private readIdentifier(): void {
    const start = this.pos;

    while (
      this.pos < this.input.length &&
      this.isIdentifierPart(this.input[this.pos])
    ) {
      this.pos++;
    }

    this.tokens.push({
      type: TokenType.IDENTIFIER,
      value: this.input.slice(start, this.pos),
      position: start,
    });
  }

  private readComparisonOrOperator(): void {
    const start = this.pos;
    const ch = this.input[this.pos];
    const next = this.peek(1);

    if (
      (ch === '=' || ch === '!' || ch === '>' || ch === '<') &&
      next === '='
    ) {
      this.tokens.push({
        type: TokenType.COMPARISON_OP,
        value: ch + next,
        position: start,
      });
      this.pos += 2;
    } else if (ch === '>' || ch === '<') {
      this.tokens.push({
        type: TokenType.COMPARISON_OP,
        value: ch,
        position: start,
      });
      this.pos++;
    } else if (ch === '!') {
      throw new TokenizerError(`Unexpected character: '!'`, this.pos);
    } else {
      // '=' alone is not a valid token in formula context
      throw new TokenizerError(`Unexpected character: '${ch}'`, this.pos);
    }
  }
}
