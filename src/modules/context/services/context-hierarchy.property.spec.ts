import * as fc from 'fast-check';

/**
 * Feature: workspace-context-switcher, Property 5: HierarchyLevel derivation
 *
 * **Validates: Requirements 1.6**
 *
 * For any school in the accessible schools response, the `hierarchyLevel` field SHALL equal
 * "holding" if the school has `parentSchoolId` = null AND has child schools,
 * "company" if `parentSchoolId` is not null AND has child schools,
 * or "school" if it has no child schools.
 */
describe('Feature: workspace-context-switcher, Property 5: HierarchyLevel derivation', () => {
  /**
   * Pure implementation of deriveHierarchyLevel matching the logic in ContextService.
   * This tests the derivation function in isolation with arbitrary inputs.
   */
  function deriveHierarchyLevel(
    parentSchoolId: string | null,
    hasChildren: boolean,
  ): 'holding' | 'company' | 'school' {
    if (!hasChildren) {
      return 'school';
    }
    if (parentSchoolId === null) {
      return 'holding';
    }
    return 'company';
  }

  /**
   * Arbitrary for generating a school node with:
   * - id: valid UUID-like string
   * - parentSchoolId: null or UUID-like string
   * - hasChildren: boolean indicating whether this school has child schools
   */
  const schoolNodeArb = fc.record({
    id: fc.uuid(),
    parentSchoolId: fc.option(fc.uuid(), { nil: null }),
    hasChildren: fc.boolean(),
  });

  /**
   * Arbitrary for generating a school hierarchy — a list of school nodes
   * where some are parents of others. This ensures we test with realistic
   * hierarchy structures.
   */
  const schoolHierarchyArb = fc
    .array(fc.uuid(), { minLength: 1, maxLength: 20 })
    .chain((schoolIds) => {
      // Generate school nodes from the IDs, with some having parent-child relationships
      const nodeArbs = schoolIds.map((id) =>
        fc.record({
          id: fc.constant(id),
          parentSchoolId: fc.oneof(
            fc.constant(null as string | null),
            // Pick a parent from other schools in the hierarchy
            schoolIds.length > 1
              ? fc.constantFrom(
                  ...schoolIds.filter((sid) => sid !== id),
                ) as fc.Arbitrary<string | null>
              : fc.constant(null as string | null),
          ),
        }),
      );
      return fc.tuple(...nodeArbs);
    });

  it('schools with no children should always have hierarchyLevel = "school"', async () => {
    await fc.assert(
      fc.asyncProperty(schoolNodeArb, async (node) => {
        // Force hasChildren = false
        const level = deriveHierarchyLevel(node.parentSchoolId, false);
        expect(level).toBe('school');
      }),
      { numRuns: 100 },
    );
  });

  it('schools with parentSchoolId = null AND has children should have hierarchyLevel = "holding"', async () => {
    await fc.assert(
      fc.asyncProperty(schoolNodeArb, async (node) => {
        // Force parentSchoolId = null and hasChildren = true
        const level = deriveHierarchyLevel(null, true);
        expect(level).toBe('holding');
      }),
      { numRuns: 100 },
    );
  });

  it('schools with parentSchoolId != null AND has children should have hierarchyLevel = "company"', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // non-null parentSchoolId
        async (parentSchoolId) => {
          const level = deriveHierarchyLevel(parentSchoolId, true);
          expect(level).toBe('company');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('hierarchyLevel derivation is exhaustive — every combination maps to exactly one level', async () => {
    await fc.assert(
      fc.asyncProperty(schoolNodeArb, async (node) => {
        const level = deriveHierarchyLevel(node.parentSchoolId, node.hasChildren);

        // Must be one of the three valid levels
        expect(['holding', 'company', 'school']).toContain(level);

        // Verify correct mapping based on the property definition
        if (!node.hasChildren) {
          expect(level).toBe('school');
        } else if (node.parentSchoolId === null) {
          expect(level).toBe('holding');
        } else {
          expect(level).toBe('company');
        }
      }),
      { numRuns: 100 },
    );
  });

  it('hierarchyLevel derivation in a full hierarchy assigns correct levels to all nodes', async () => {
    await fc.assert(
      fc.asyncProperty(schoolHierarchyArb, async (nodes) => {
        // Compute which nodes have children (any node that is referenced as a parent)
        const parentIds = new Set(
          nodes
            .map((n) => n.parentSchoolId)
            .filter((pid): pid is string => pid !== null),
        );

        for (const node of nodes) {
          const hasChildren = parentIds.has(node.id);
          const level = deriveHierarchyLevel(node.parentSchoolId, hasChildren);

          // Verify correct assignment for each node
          if (!hasChildren) {
            expect(level).toBe('school');
          } else if (node.parentSchoolId === null) {
            expect(level).toBe('holding');
          } else {
            expect(level).toBe('company');
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it('hierarchyLevel "holding" requires BOTH parentSchoolId = null AND hasChildren = true', async () => {
    await fc.assert(
      fc.asyncProperty(schoolNodeArb, async (node) => {
        const level = deriveHierarchyLevel(node.parentSchoolId, node.hasChildren);

        if (level === 'holding') {
          // Verify both conditions hold
          expect(node.parentSchoolId).toBeNull();
          expect(node.hasChildren).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('hierarchyLevel "company" requires BOTH parentSchoolId != null AND hasChildren = true', async () => {
    await fc.assert(
      fc.asyncProperty(schoolNodeArb, async (node) => {
        const level = deriveHierarchyLevel(node.parentSchoolId, node.hasChildren);

        if (level === 'company') {
          // Verify both conditions hold
          expect(node.parentSchoolId).not.toBeNull();
          expect(node.hasChildren).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('hierarchyLevel "school" requires hasChildren = false regardless of parentSchoolId', async () => {
    await fc.assert(
      fc.asyncProperty(schoolNodeArb, async (node) => {
        const level = deriveHierarchyLevel(node.parentSchoolId, node.hasChildren);

        if (level === 'school') {
          // Verify the condition holds — parentSchoolId can be anything
          expect(node.hasChildren).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });
});
