import { Injectable } from '@nestjs/common';
import { FormulaEntity } from '../entities/formula.entity';

export interface DependencyGraphResult {
  order: string[];
  hasCycle: boolean;
  cyclePaths: string[];
}

@Injectable()
export class DependencyGraphService {
  /**
   * Build adjacency list from formulas.
   * Key = pay component code, Value = list of codes it depends on.
   */
  buildGraph(formulas: FormulaEntity[], codeMap: Map<string, string>): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    for (const formula of formulas) {
      const code = codeMap.get(formula.payComponentId);
      if (!code) continue;

      const deps = formula.dependencies || [];
      graph.set(code, deps);
    }

    return graph;
  }

  /**
   * Topological sort using Kahn's algorithm.
   * Returns ordered list of pay component codes to calculate.
   */
  topologicalSort(graph: Map<string, string[]>): DependencyGraphResult {
    const allNodes = new Set<string>();
    const inDegree = new Map<string, number>();

    // Collect all nodes
    for (const [node, deps] of graph) {
      allNodes.add(node);
      for (const dep of deps) {
        allNodes.add(dep);
      }
    }

    // Initialize in-degree
    for (const node of allNodes) {
      inDegree.set(node, 0);
    }

    // Calculate in-degree
    for (const [node, deps] of graph) {
      for (const dep of deps) {
        if (allNodes.has(dep)) {
          inDegree.set(node, (inDegree.get(node) || 0) + 1);
        }
      }
    }

    // Wait — Kahn's: edges go from dependency TO dependent
    // Re-calculate: if A depends on B, then B → A (B must come before A)
    // in-degree of A = number of dependencies A has (that are in the graph)
    const revisedInDegree = new Map<string, number>();
    for (const node of allNodes) {
      revisedInDegree.set(node, 0);
    }

    for (const [node, deps] of graph) {
      const relevantDeps = deps.filter((d) => allNodes.has(d));
      revisedInDegree.set(node, relevantDeps.length);
    }

    // BFS with nodes that have 0 in-degree
    const queue: string[] = [];
    for (const [node, degree] of revisedInDegree) {
      if (degree === 0) {
        queue.push(node);
      }
    }

    const order: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      order.push(current);

      // For each node that depends on current, decrease its in-degree
      for (const [node, deps] of graph) {
        if (deps.includes(current)) {
          const newDegree = (revisedInDegree.get(node) || 0) - 1;
          revisedInDegree.set(node, newDegree);
          if (newDegree === 0) {
            queue.push(node);
          }
        }
      }
    }

    const hasCycle = order.length < allNodes.size;
    const cyclePaths: string[] = [];

    if (hasCycle) {
      // Find nodes not in the order (involved in cycles)
      const cycleNodes = [...allNodes].filter((n) => !order.includes(n));
      cyclePaths.push(cycleNodes.join(' → '));
    }

    return { order, hasCycle, cyclePaths };
  }

  /**
   * Detect cycles using DFS.
   * Returns cycle paths if any exist.
   */
  detectCycles(graph: Map<string, string[]>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): void => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const deps = graph.get(node) || [];
      for (const dep of deps) {
        if (!visited.has(dep)) {
          dfs(dep);
        } else if (recursionStack.has(dep)) {
          // Found a cycle
          const cycleStart = path.indexOf(dep);
          const cycle = [...path.slice(cycleStart), dep];
          cycles.push(cycle);
        }
      }

      path.pop();
      recursionStack.delete(node);
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles;
  }
}
