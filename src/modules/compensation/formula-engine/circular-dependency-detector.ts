/**
 * Detects circular dependencies in a directed graph using DFS.
 * Used to prevent circular references between pay component formulas.
 */
export interface CycleDetectionResult {
  hasCycle: boolean;
  cycle: string[]; // The cycle path, empty if no cycle
}

export class CircularDependencyDetector {
  /**
   * Detect cycles in the dependency graph.
   * @param graph Map of componentCode → dependency codes
   * @returns CycleDetectionResult with hasCycle flag and the cycle path if found
   */
  detect(graph: Map<string, string[]>): CycleDetectionResult {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        const result = this.dfs(node, graph, visited, recursionStack, path);
        if (result.hasCycle) {
          return result;
        }
      }
    }

    return { hasCycle: false, cycle: [] };
  }

  /**
   * Check if adding a new edge would create a cycle.
   * @param from Source node (the component being defined)
   * @param to Target node (the dependency)
   * @param graph Existing dependency graph
   */
  wouldCreateCycle(
    from: string,
    to: string,
    graph: Map<string, string[]>,
  ): boolean {
    // If adding edge from → to, check if there's already a path from to → from
    if (from === to) return true;

    const visited = new Set<string>();
    return this.hasPath(to, from, graph, visited);
  }

  /**
   * Check if there's a path from source to target in the graph using BFS.
   */
  private hasPath(
    source: string,
    target: string,
    graph: Map<string, string[]>,
    visited: Set<string>,
  ): boolean {
    if (source === target) return true;
    visited.add(source);

    const neighbors = graph.get(source) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (this.hasPath(neighbor, target, graph, visited)) {
          return true;
        }
      }
    }

    return false;
  }

  private dfs(
    node: string,
    graph: Map<string, string[]>,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[],
  ): CycleDetectionResult {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = graph.get(node) || [];

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const result = this.dfs(neighbor, graph, visited, recursionStack, path);
        if (result.hasCycle) {
          return result;
        }
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle - extract the cycle path
        const cycleStart = path.indexOf(neighbor);
        const cycle = [...path.slice(cycleStart), neighbor];
        return { hasCycle: true, cycle };
      }
    }

    path.pop();
    recursionStack.delete(node);
    return { hasCycle: false, cycle: [] };
  }
}
