import { Tokenizer, TokenType, TokenizerError } from '../../../src/modules/compensation/formula-engine/tokenizer';
import { Parser, ParseError, ASTNode } from '../../../src/modules/compensation/formula-engine/parser';
import { Evaluator, EvaluationError } from '../../../src/modules/compensation/formula-engine/evaluator';
import { FormulaValidator } from '../../../src/modules/compensation/formula-engine/validator';
import { DependencyExtractor } from '../../../src/modules/compensation/formula-engine/dependency-extractor';
import { CircularDependencyDetector } from '../../../src/modules/compensation/formula-engine/circular-dependency-detector';
import { PrettyPrinter } from '../../../src/modules/compensation/formula-engine/pretty-printer';

describe('Formula Engine', () => {
  describe('Tokenizer', () => {
    it('should tokenize numbers', () => {
      const tokenizer = new Tokenizer('123 45.67');
      const tokens = tokenizer.tokenize();
      expect(tokens[0]).toEqual({ type: TokenType.NUMBER, value: '123', position: 0 });
      expect(tokens[1]).toEqual({ type: TokenType.NUMBER, value: '45.67', position: 4 });
    });

    it('should tokenize strings', () => {
      const tokenizer = new Tokenizer('"hello" \'world\'');
      const tokens = tokenizer.tokenize();
      expect(tokens[0]).toEqual({ type: TokenType.STRING, value: 'hello', position: 0 });
      expect(tokens[1]).toEqual({ type: TokenType.STRING, value: 'world', position: 8 });
    });

    it('should tokenize identifiers', () => {
      const tokenizer = new Tokenizer('BASIC_SALARY x');
      const tokens = tokenizer.tokenize();
      expect(tokens[0]).toEqual({ type: TokenType.IDENTIFIER, value: 'BASIC_SALARY', position: 0 });
      expect(tokens[1]).toEqual({ type: TokenType.IDENTIFIER, value: 'x', position: 13 });
    });

    it('should tokenize operators', () => {
      const tokenizer = new Tokenizer('+ - * / %');
      const tokens = tokenizer.tokenize();
      expect(tokens.filter((t) => t.type === TokenType.OPERATOR)).toHaveLength(5);
    });

    it('should tokenize comparison operators', () => {
      const tokenizer = new Tokenizer('== != > < >= <=');
      const tokens = tokenizer.tokenize();
      expect(tokens.filter((t) => t.type === TokenType.COMPARISON_OP)).toHaveLength(6);
    });

    it('should tokenize parentheses and commas', () => {
      const tokenizer = new Tokenizer('SUM(a, b)');
      const tokens = tokenizer.tokenize();
      expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].type).toBe(TokenType.LPAREN);
      expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[3].type).toBe(TokenType.COMMA);
      expect(tokens[4].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[5].type).toBe(TokenType.RPAREN);
    });

    it('should throw on unexpected characters', () => {
      const tokenizer = new Tokenizer('a @ b');
      expect(() => tokenizer.tokenize()).toThrow(TokenizerError);
    });

    it('should throw on unterminated string', () => {
      const tokenizer = new Tokenizer('"hello');
      expect(() => tokenizer.tokenize()).toThrow(TokenizerError);
    });
  });

  describe('Parser', () => {
    it('should parse number literals', () => {
      const parser = new Parser('42');
      const ast = parser.parse();
      expect(ast).toEqual({ type: 'NumberLiteral', value: 42 });
    });

    it('should parse binary expressions', () => {
      const parser = new Parser('a + b');
      const ast = parser.parse();
      expect(ast.type).toBe('BinaryExpression');
      if (ast.type === 'BinaryExpression') {
        expect(ast.operator).toBe('+');
        expect(ast.left).toEqual({ type: 'Identifier', name: 'a' });
        expect(ast.right).toEqual({ type: 'Identifier', name: 'b' });
      }
    });

    it('should respect operator precedence', () => {
      const parser = new Parser('a + b * c');
      const ast = parser.parse();
      // Should be: a + (b * c)
      expect(ast.type).toBe('BinaryExpression');
      if (ast.type === 'BinaryExpression') {
        expect(ast.operator).toBe('+');
        expect(ast.left).toEqual({ type: 'Identifier', name: 'a' });
        expect(ast.right.type).toBe('BinaryExpression');
      }
    });

    it('should parse parenthesized expressions', () => {
      const parser = new Parser('(a + b) * c');
      const ast = parser.parse();
      expect(ast.type).toBe('BinaryExpression');
      if (ast.type === 'BinaryExpression') {
        expect(ast.operator).toBe('*');
        expect(ast.left.type).toBe('BinaryExpression');
      }
    });

    it('should parse function calls', () => {
      const parser = new Parser('SUM(a, b, c)');
      const ast = parser.parse();
      expect(ast.type).toBe('FunctionCall');
      if (ast.type === 'FunctionCall') {
        expect(ast.name).toBe('SUM');
        expect(ast.arguments).toHaveLength(3);
      }
    });

    it('should parse nested function calls', () => {
      const parser = new Parser('ROUND(SUM(a, b), 2)');
      const ast = parser.parse();
      expect(ast.type).toBe('FunctionCall');
      if (ast.type === 'FunctionCall') {
        expect(ast.name).toBe('ROUND');
        expect(ast.arguments[0].type).toBe('FunctionCall');
      }
    });

    it('should parse unary minus', () => {
      const parser = new Parser('-a');
      const ast = parser.parse();
      expect(ast.type).toBe('UnaryExpression');
      if (ast.type === 'UnaryExpression') {
        expect(ast.operator).toBe('-');
      }
    });

    it('should parse comparison operators', () => {
      const parser = new Parser('a >= b');
      const ast = parser.parse();
      expect(ast.type).toBe('BinaryExpression');
      if (ast.type === 'BinaryExpression') {
        expect(ast.operator).toBe('>=');
      }
    });

    it('should parse complex formulas', () => {
      const parser = new Parser('BASIC_SALARY * WORKING_DAYS / STANDARD_DAYS');
      const ast = parser.parse();
      expect(ast.type).toBe('BinaryExpression');
    });

    it('should throw on invalid syntax', () => {
      const parser = new Parser('a + ');
      expect(() => parser.parse()).toThrow(ParseError);
    });
  });

  describe('Evaluator', () => {
    it('should evaluate simple arithmetic', () => {
      const parser = new Parser('2 + 3 * 4');
      const ast = parser.parse();
      const evaluator = new Evaluator({
        variables: {},
        functions: {},
      });
      expect(evaluator.evaluate(ast)).toBe(14);
    });

    it('should evaluate with variables', () => {
      const parser = new Parser('BASIC_SALARY * 1.5');
      const ast = parser.parse();
      const evaluator = new Evaluator({
        variables: { BASIC_SALARY: 10000000 },
        functions: {},
      });
      expect(evaluator.evaluate(ast)).toBe(15000000);
    });

    it('should evaluate function calls', () => {
      const parser = new Parser('ROUND(BASIC / DAYS, 0)');
      const ast = parser.parse();
      const evaluator = new Evaluator({
        variables: { BASIC: 10000000, DAYS: 22 },
        functions: {
          ROUND: (value: number, decimals: number) => {
            const factor = Math.pow(10, decimals);
            return Math.round(value * factor) / factor;
          },
        },
      });
      expect(evaluator.evaluate(ast)).toBe(454545);
    });

    it('should throw on division by zero', () => {
      const parser = new Parser('100 / 0');
      const ast = parser.parse();
      const evaluator = new Evaluator({
        variables: {},
        functions: {},
      });
      expect(() => evaluator.evaluate(ast)).toThrow(EvaluationError);
    });

    it('should throw on undefined variable', () => {
      const parser = new Parser('UNKNOWN_VAR + 1');
      const ast = parser.parse();
      const evaluator = new Evaluator({
        variables: {},
        functions: {},
      });
      expect(() => evaluator.evaluate(ast)).toThrow(EvaluationError);
    });

    it('should evaluate comparisons as 0 or 1', () => {
      const parser = new Parser('5 > 3');
      const ast = parser.parse();
      const evaluator = new Evaluator({ variables: {}, functions: {} });
      expect(evaluator.evaluate(ast)).toBe(1);
    });

    it('should evaluate IF function', () => {
      const parser = new Parser('IF(HOURS > 40, HOURS * 1.5, HOURS * 1.0)');
      const ast = parser.parse();
      const evaluator = new Evaluator({
        variables: { HOURS: 45 },
        functions: {
          IF: (cond: number, trueVal: number, falseVal: number) =>
            cond !== 0 ? trueVal : falseVal,
        },
      });
      expect(evaluator.evaluate(ast)).toBe(67.5);
    });

    it('should evaluate unary minus', () => {
      const parser = new Parser('-5 + 10');
      const ast = parser.parse();
      const evaluator = new Evaluator({ variables: {}, functions: {} });
      expect(evaluator.evaluate(ast)).toBe(5);
    });
  });

  describe('FormulaValidator', () => {
    it('should validate known identifiers', () => {
      const parser = new Parser('BASIC_SALARY + ALLOWANCE');
      const ast = parser.parse();
      const validator = new FormulaValidator({
        variableCodes: new Set(['BASIC_SALARY', 'ALLOWANCE']),
        payComponentCodes: new Set(),
        functionNames: new Set(),
      });
      const errors = validator.validate(ast);
      expect(errors).toHaveLength(0);
    });

    it('should report unknown identifiers', () => {
      const parser = new Parser('UNKNOWN_VAR + 1');
      const ast = parser.parse();
      const validator = new FormulaValidator({
        variableCodes: new Set(),
        payComponentCodes: new Set(),
        functionNames: new Set(),
      });
      const errors = validator.validate(ast);
      expect(errors).toHaveLength(1);
      expect(errors[0].node).toBe('UNKNOWN_VAR');
    });

    it('should report unknown functions', () => {
      const parser = new Parser('UNKNOWN_FUNC(1, 2)');
      const ast = parser.parse();
      const validator = new FormulaValidator({
        variableCodes: new Set(),
        payComponentCodes: new Set(),
        functionNames: new Set(['SUM', 'ROUND']),
      });
      const errors = validator.validate(ast);
      expect(errors.some((e) => e.node === 'UNKNOWN_FUNC')).toBe(true);
    });

    it('should accept known functions', () => {
      const parser = new Parser('SUM(a, b)');
      const ast = parser.parse();
      const validator = new FormulaValidator({
        variableCodes: new Set(['a', 'b']),
        payComponentCodes: new Set(),
        functionNames: new Set(['SUM']),
      });
      const errors = validator.validate(ast);
      expect(errors).toHaveLength(0);
    });
  });

  describe('DependencyExtractor', () => {
    it('should extract pay component references', () => {
      const parser = new Parser('GROSS_SALARY - TAX - INSURANCE');
      const ast = parser.parse();
      const extractor = new DependencyExtractor(
        new Set(['GROSS_SALARY', 'TAX', 'INSURANCE']),
      );
      const deps = extractor.extract(ast);
      expect(deps).toContain('GROSS_SALARY');
      expect(deps).toContain('TAX');
      expect(deps).toContain('INSURANCE');
    });

    it('should not include variables as dependencies', () => {
      const parser = new Parser('BASIC_SALARY * RATE');
      const ast = parser.parse();
      const extractor = new DependencyExtractor(
        new Set(['BASIC_SALARY']),
      );
      const deps = extractor.extract(ast);
      expect(deps).toContain('BASIC_SALARY');
      expect(deps).not.toContain('RATE');
    });

    it('should extract variable refs', () => {
      const parser = new Parser('BASIC_SALARY * RATE + BONUS');
      const ast = parser.parse();
      const extractor = new DependencyExtractor(new Set(['BASIC_SALARY']));
      const varRefs = extractor.extractVariableRefs(ast, new Set(['RATE', 'BONUS']));
      expect(varRefs).toContain('RATE');
      expect(varRefs).toContain('BONUS');
      expect(varRefs).not.toContain('BASIC_SALARY');
    });

    it('should handle function call arguments', () => {
      const parser = new Parser('SUM(BASIC, ALLOWANCE, BONUS)');
      const ast = parser.parse();
      const extractor = new DependencyExtractor(
        new Set(['BASIC', 'ALLOWANCE', 'BONUS']),
      );
      const deps = extractor.extract(ast);
      expect(deps).toHaveLength(3);
    });
  });

  describe('CircularDependencyDetector', () => {
    it('should detect no cycle in acyclic graph', () => {
      const graph = new Map<string, string[]>();
      graph.set('NET', ['GROSS', 'TAX']);
      graph.set('GROSS', ['BASIC', 'ALLOWANCE']);
      graph.set('TAX', ['GROSS']);
      graph.set('BASIC', []);
      graph.set('ALLOWANCE', []);

      const detector = new CircularDependencyDetector();
      const result = detector.detect(graph);
      expect(result.hasCycle).toBe(false);
    });

    it('should detect simple cycle', () => {
      const graph = new Map<string, string[]>();
      graph.set('A', ['B']);
      graph.set('B', ['C']);
      graph.set('C', ['A']);

      const detector = new CircularDependencyDetector();
      const result = detector.detect(graph);
      expect(result.hasCycle).toBe(true);
      expect(result.cycle.length).toBeGreaterThan(0);
    });

    it('should detect self-reference', () => {
      const detector = new CircularDependencyDetector();
      const graph = new Map<string, string[]>();
      graph.set('A', ['B']);
      graph.set('B', []);

      expect(detector.wouldCreateCycle('A', 'A', graph)).toBe(true);
    });

    it('should detect would-create cycle', () => {
      const detector = new CircularDependencyDetector();
      const graph = new Map<string, string[]>();
      graph.set('A', ['B']);
      graph.set('B', ['C']);
      graph.set('C', []);

      // Adding C → A would create cycle: A → B → C → A
      expect(detector.wouldCreateCycle('C', 'A', graph)).toBe(true);
      // Adding C → D would not create cycle
      expect(detector.wouldCreateCycle('C', 'D', graph)).toBe(false);
    });
  });

  describe('PrettyPrinter', () => {
    it('should format simple expressions', () => {
      const parser = new Parser('a+b');
      const ast = parser.parse();
      const printer = new PrettyPrinter();
      expect(printer.print(ast)).toBe('a + b');
    });

    it('should format function calls', () => {
      const parser = new Parser('SUM(a,b,c)');
      const ast = parser.parse();
      const printer = new PrettyPrinter();
      expect(printer.print(ast)).toBe('SUM(a, b, c)');
    });

    it('should preserve parentheses for precedence', () => {
      const parser = new Parser('(a + b) * c');
      const ast = parser.parse();
      const printer = new PrettyPrinter();
      expect(printer.print(ast)).toBe('(a + b) * c');
    });

    it('should handle nested functions', () => {
      const parser = new Parser('ROUND(SUM(a, b), 2)');
      const ast = parser.parse();
      const printer = new PrettyPrinter();
      expect(printer.print(ast)).toBe('ROUND(SUM(a, b), 2)');
    });

    it('should round-trip complex formulas', () => {
      const formula = 'BASIC_SALARY * WORKING_DAYS / STANDARD_DAYS';
      const parser1 = new Parser(formula);
      const ast1 = parser1.parse();
      const printer = new PrettyPrinter();
      const pretty = printer.print(ast1);

      const parser2 = new Parser(pretty);
      const ast2 = parser2.parse();
      // ASTs should be equivalent
      expect(JSON.stringify(ast1)).toBe(JSON.stringify(ast2));
    });
  });
});
