import { DependencyGraphService } from '../../../src/modules/compensation/services/dependency-graph.service';
import { FormulaEntity } from '../../../src/modules/compensation/entities/formula.entity';
import { FormulaStatus } from '../../../src/modules/compensation/enums';

describe('DependencyGraphService', () => {
  let service: DependencyGraphService;

  beforeEach(() => {
    service = new DependencyGraphService();
  });

  describe('buildGraph', () => {
    it('should build adjacency list from formulas', () => {
      const formulas = [
        createFormula('pc-1', ['BASIC_SALARY'], null),
        createFormula('pc-2', null, null),
        createFormula('pc-3', ['NET_SALARY', 'BASIC_SALARY'], null),
      ] as FormulaEntity[];

      const codeMap = new Map<string, string>();
      codeMap.set('pc-1', 'ALLOWANCE');
      codeMap.set('pc-2', 'BASIC_SALARY');
      codeMap.set('pc-3', 'TOTAL');

      const graph = service.buildGraph(formulas, codeMap);

      expect(graph.get('ALLOWANCE')).toEqual(['BASIC_SALARY']);
      expect(graph.get('BASIC_SALARY')).toEqual([]);
      expect(graph.get('TOTAL')).toEqual(['NET_SALARY', 'BASIC_SALARY']);
    });

    it('should handle formulas with no dependencies', () => {
      const formulas = [
        createFormula('pc-1', null, null),
      ] as FormulaEntity[];

      const codeMap = new Map<string, string>();
      codeMap.set('pc-1', 'BASIC');

      const graph = service.buildGraph(formulas, codeMap);

      expect(graph.get('BASIC')).toEqual([]);
    });
  });

  describe('topologicalSort', () => {
    it('should return correct order for linear dependencies', () => {
      const graph = new Map<string, string[]>();
      graph.set('NET', ['GROSS', 'TAX']);
      graph.set('GROSS', ['BASIC', 'ALLOWANCE']);
      graph.set('BASIC', []);
      graph.set('ALLOWANCE', []);
      graph.set('TAX', ['GROSS']);

      const result = service.topologicalSort(graph);

      expect(result.hasCycle).toBe(false);
      // BASIC and ALLOWANCE should come before GROSS
      // GROSS should come before TAX and NET
      const basicIdx = result.order.indexOf('BASIC');
      const allowanceIdx = result.order.indexOf('ALLOWANCE');
      const grossIdx = result.order.indexOf('GROSS');
      const taxIdx = result.order.indexOf('TAX');
      const netIdx = result.order.indexOf('NET');

      expect(basicIdx).toBeLessThan(grossIdx);
      expect(allowanceIdx).toBeLessThan(grossIdx);
      expect(grossIdx).toBeLessThan(taxIdx);
      expect(grossIdx).toBeLessThan(netIdx);
      expect(taxIdx).toBeLessThan(netIdx);
    });

    it('should detect cycles', () => {
      const graph = new Map<string, string[]>();
      graph.set('A', ['B']);
      graph.set('B', ['C']);
      graph.set('C', ['A']);

      const result = service.topologicalSort(graph);

      expect(result.hasCycle).toBe(true);
    });

    it('should handle empty graph', () => {
      const graph = new Map<string, string[]>();
      const result = service.topologicalSort(graph);

      expect(result.hasCycle).toBe(false);
      expect(result.order).toEqual([]);
    });

    it('should handle independent nodes', () => {
      const graph = new Map<string, string[]>();
      graph.set('A', []);
      graph.set('B', []);
      graph.set('C', []);

      const result = service.topologicalSort(graph);

      expect(result.hasCycle).toBe(false);
      expect(result.order).toHaveLength(3);
      expect(result.order).toContain('A');
      expect(result.order).toContain('B');
      expect(result.order).toContain('C');
    });
  });

  describe('detectCycles', () => {
    it('should detect simple cycle', () => {
      const graph = new Map<string, string[]>();
      graph.set('A', ['B']);
      graph.set('B', ['A']);

      const cycles = service.detectCycles(graph);

      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should return empty array when no cycles', () => {
      const graph = new Map<string, string[]>();
      graph.set('A', ['B']);
      graph.set('B', ['C']);
      graph.set('C', []);

      const cycles = service.detectCycles(graph);

      expect(cycles).toEqual([]);
    });

    it('should detect multi-node cycle', () => {
      const graph = new Map<string, string[]>();
      graph.set('A', ['B']);
      graph.set('B', ['C']);
      graph.set('C', ['A']);

      const cycles = service.detectCycles(graph);

      expect(cycles.length).toBeGreaterThan(0);
    });
  });
});

function createFormula(
  payComponentId: string,
  dependencies: string[] | null,
  variableRefs: string[] | null,
): Partial<FormulaEntity> {
  return {
    id: `formula-${payComponentId}`,
    payComponentId,
    schoolId: 'school-1',
    expression: 'BASIC * 1',
    parsedAst: null,
    dependencies,
    variableRefs,
    version: 1,
    changelog: null,
    status: FormulaStatus.PUBLISHED,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}
