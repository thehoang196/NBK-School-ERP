/**
 * k6 Load Test: Workspace Context Switch Performance
 *
 * Validates Requirements 17.1–17.4:
 * - POST /api/v1/context/switch: P95 < 300ms, P99 < 500ms (1000 VUs)
 * - GET /api/v1/context/accessible-schools: P95 < 500ms
 * - GET /api/v1/context/current: P95 < 200ms
 *
 * Usage:
 *   k6 run test/performance/context-switch.k6.ts
 *   k6 run --env BASE_URL=http://staging:3000 test/performance/context-switch.k6.ts
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Custom Metrics
// ---------------------------------------------------------------------------

const contextSwitchDuration = new Trend('context_switch_duration', true);
const accessibleSchoolsDuration = new Trend('accessible_schools_duration', true);
const currentContextDuration = new Trend('current_context_duration', true);

const contextSwitchSuccess = new Rate('context_switch_success');
const accessibleSchoolsSuccess = new Rate('accessible_schools_success');
const currentContextSuccess = new Rate('current_context_success');

const contextSwitchErrors = new Counter('context_switch_errors');
const accessibleSchoolsErrors = new Counter('accessible_schools_errors');
const currentContextErrors = new Counter('current_context_errors');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_PREFIX = `${BASE_URL}/api/v1`;

// Test user credentials — configure via environment or use defaults for local
const TEST_USERS_JSON = __ENV.TEST_USERS || '';

// ---------------------------------------------------------------------------
// k6 Options — Thresholds and Scenarios
// ---------------------------------------------------------------------------

export const options = {
  scenarios: {
    // Scenario 1: POST /api/v1/context/switch — 1000 concurrent VUs
    context_switch: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 200 },   // Ramp up to 200 VUs
        { duration: '30s', target: 500 },   // Ramp up to 500 VUs
        { duration: '1m', target: 1000 },   // Ramp up to 1000 VUs
        { duration: '2m', target: 1000 },   // Sustain 1000 VUs
        { duration: '30s', target: 0 },     // Ramp down
      ],
      exec: 'contextSwitchScenario',
      tags: { scenario: 'context_switch' },
    },

    // Scenario 2: GET /api/v1/context/accessible-schools — under load
    accessible_schools: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 100 },
        { duration: '30s', target: 300 },
        { duration: '1m', target: 500 },
        { duration: '1m', target: 500 },
        { duration: '20s', target: 0 },
      ],
      exec: 'accessibleSchoolsScenario',
      tags: { scenario: 'accessible_schools' },
    },

    // Scenario 3: GET /api/v1/context/current — under load
    current_context: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 100 },
        { duration: '30s', target: 300 },
        { duration: '1m', target: 500 },
        { duration: '1m', target: 500 },
        { duration: '20s', target: 0 },
      ],
      exec: 'currentContextScenario',
      tags: { scenario: 'current_context' },
    },
  },

  thresholds: {
    // Requirement 17.1: Context switch P95 < 300ms, P99 < 500ms
    'context_switch_duration': [
      'p(95) < 300',
      'p(99) < 500',
    ],
    // Requirement 17.3: Accessible schools P95 < 500ms
    'accessible_schools_duration': [
      'p(95) < 500',
    ],
    // Requirement 17.4: Current context P95 < 200ms
    'current_context_duration': [
      'p(95) < 200',
    ],
    // General success rate thresholds
    'context_switch_success': ['rate > 0.95'],
    'accessible_schools_success': ['rate > 0.95'],
    'current_context_success': ['rate > 0.95'],
    // Standard http thresholds
    'http_req_failed': ['rate < 0.05'],
  },
};

// ---------------------------------------------------------------------------
// Test Data — Realistic multi-school, multi-role users
// ---------------------------------------------------------------------------

interface TestUser {
  email: string;
  password: string;
  role: string;
  schoolIds: string[];
}

// Default test users for local environment
// Override with TEST_USERS env variable for staging/production
const DEFAULT_TEST_USERS: TestUser[] = [
  // SUPER_ADMIN — access to all schools
  {
    email: 'superadmin@nbk.edu.vn',
    password: 'Test@12345678',
    role: 'super_admin',
    schoolIds: [
      'a1b2c3d4-1111-4000-a000-000000000001',
      'a1b2c3d4-2222-4000-a000-000000000002',
      'a1b2c3d4-3333-4000-a000-000000000003',
      'a1b2c3d4-4444-4000-a000-000000000004',
      'a1b2c3d4-5555-4000-a000-000000000005',
    ],
  },
  // COMPANY_ADMIN — access to company node + children
  {
    email: 'companyadmin@nbk.edu.vn',
    password: 'Test@12345678',
    role: 'company_admin',
    schoolIds: [
      'a1b2c3d4-2222-4000-a000-000000000002',
      'a1b2c3d4-3333-4000-a000-000000000003',
      'a1b2c3d4-4444-4000-a000-000000000004',
    ],
  },
  // TEACHER — access to multiple schools via assignments
  {
    email: 'teacher.multi@nbk.edu.vn',
    password: 'Test@12345678',
    role: 'teacher',
    schoolIds: [
      'a1b2c3d4-3333-4000-a000-000000000003',
      'a1b2c3d4-4444-4000-a000-000000000004',
    ],
  },
  // SCHOOL_ADMIN — single school
  {
    email: 'schooladmin@nbk.edu.vn',
    password: 'Test@12345678',
    role: 'school_admin',
    schoolIds: [
      'a1b2c3d4-3333-4000-a000-000000000003',
    ],
  },
  // Additional COMPANY_ADMIN for diversity
  {
    email: 'companyadmin2@nbk.edu.vn',
    password: 'Test@12345678',
    role: 'company_admin',
    schoolIds: [
      'a1b2c3d4-1111-4000-a000-000000000001',
      'a1b2c3d4-5555-4000-a000-000000000005',
    ],
  },
];

function getTestUsers(): TestUser[] {
  if (TEST_USERS_JSON) {
    try {
      return JSON.parse(TEST_USERS_JSON) as TestUser[];
    } catch {
      console.warn('Failed to parse TEST_USERS env variable, using defaults');
    }
  }
  return DEFAULT_TEST_USERS;
}

// ---------------------------------------------------------------------------
// Setup — Authenticate test users and store tokens
// ---------------------------------------------------------------------------

interface SetupData {
  tokens: string[];
  users: TestUser[];
}

export function setup(): SetupData {
  const testUsers = getTestUsers();
  const tokens: string[] = [];

  for (const user of testUsers) {
    const loginRes = http.post(
      `${API_PREFIX}/auth/login`,
      JSON.stringify({
        email: user.email,
        password: user.password,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'setup_login' },
      },
    );

    const loginCheck = check(loginRes, {
      'login status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    });

    if (loginCheck && loginRes.status < 300) {
      try {
        const body = JSON.parse(loginRes.body as string);
        const token = body.data?.accessToken || body.data?.access_token || body.accessToken || '';
        tokens.push(token);
      } catch {
        console.warn(`Failed to parse login response for ${user.email}`);
        tokens.push('');
      }
    } else {
      console.warn(`Login failed for ${user.email}: status=${loginRes.status}`);
      tokens.push('');
    }
  }

  return { tokens, users: testUsers };
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function getAuthHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomUserAndToken(data: SetupData): { user: TestUser; token: string } {
  const idx = Math.floor(Math.random() * data.users.length);
  return { user: data.users[idx], token: data.tokens[idx] };
}

function getMultiSchoolUserAndToken(data: SetupData): { user: TestUser; token: string } | null {
  const multiSchoolIndices: number[] = [];
  for (let i = 0; i < data.users.length; i++) {
    if (data.users[i].schoolIds.length > 1 && data.tokens[i]) {
      multiSchoolIndices.push(i);
    }
  }
  if (multiSchoolIndices.length === 0) return null;
  const idx = pickRandom(multiSchoolIndices);
  return { user: data.users[idx], token: data.tokens[idx] };
}

// ---------------------------------------------------------------------------
// Scenario 1: POST /api/v1/context/switch
// Requirement 17.1: P95 < 300ms, P99 < 500ms
// Requirement 17.2: 1000 concurrent users
// ---------------------------------------------------------------------------

export function contextSwitchScenario(data: SetupData): void {
  const userAndToken = getMultiSchoolUserAndToken(data);
  if (!userAndToken || !userAndToken.token) {
    sleep(1);
    return;
  }

  const { user, token } = userAndToken;

  // Pick a random school from the user's accessible schools to switch to
  const targetSchoolId = pickRandom(user.schoolIds);

  group('POST /api/v1/context/switch', () => {
    const res = http.post(
      `${API_PREFIX}/context/switch`,
      JSON.stringify({ schoolId: targetSchoolId }),
      {
        headers: getAuthHeaders(token),
        tags: { name: 'context_switch' },
      },
    );

    contextSwitchDuration.add(res.timings.duration);

    const success = check(res, {
      'switch status is 200': (r) => r.status === 200,
      'switch response has data': (r) => {
        try {
          const body = JSON.parse(r.body as string);
          return body.success === true && body.data !== null;
        } catch {
          return false;
        }
      },
      'switch response contains school info': (r) => {
        try {
          const body = JSON.parse(r.body as string);
          return !!(body.data?.id || body.data?.activeSchoolId);
        } catch {
          return false;
        }
      },
    });

    contextSwitchSuccess.add(success ? 1 : 0);
    if (!success) {
      contextSwitchErrors.add(1);
    }
  });

  // Realistic pause between switches (1-3 seconds)
  sleep(Math.random() * 2 + 1);
}

// ---------------------------------------------------------------------------
// Scenario 2: GET /api/v1/context/accessible-schools
// Requirement 17.3: P95 < 500ms
// ---------------------------------------------------------------------------

export function accessibleSchoolsScenario(data: SetupData): void {
  const { token } = getRandomUserAndToken(data);
  if (!token) {
    sleep(1);
    return;
  }

  group('GET /api/v1/context/accessible-schools', () => {
    const res = http.get(
      `${API_PREFIX}/context/accessible-schools`,
      {
        headers: getAuthHeaders(token),
        tags: { name: 'accessible_schools' },
      },
    );

    accessibleSchoolsDuration.add(res.timings.duration);

    const success = check(res, {
      'accessible-schools status is 200': (r) => r.status === 200,
      'accessible-schools returns array': (r) => {
        try {
          const body = JSON.parse(r.body as string);
          return body.success === true && Array.isArray(body.data);
        } catch {
          return false;
        }
      },
      'accessible-schools items have required fields': (r) => {
        try {
          const body = JSON.parse(r.body as string);
          if (!Array.isArray(body.data) || body.data.length === 0) return true;
          const first = body.data[0];
          return !!(first.id && first.name && first.hierarchyLevel);
        } catch {
          return false;
        }
      },
      'accessible-schools sorted alphabetically': (r) => {
        try {
          const body = JSON.parse(r.body as string);
          if (!Array.isArray(body.data) || body.data.length < 2) return true;
          for (let i = 1; i < body.data.length; i++) {
            if (body.data[i].name.localeCompare(body.data[i - 1].name) < 0) {
              return false;
            }
          }
          return true;
        } catch {
          return false;
        }
      },
    });

    accessibleSchoolsSuccess.add(success ? 1 : 0);
    if (!success) {
      accessibleSchoolsErrors.add(1);
    }
  });

  // Realistic pause between requests (0.5-2 seconds)
  sleep(Math.random() * 1.5 + 0.5);
}

// ---------------------------------------------------------------------------
// Scenario 3: GET /api/v1/context/current
// Requirement 17.4: P95 < 200ms
// ---------------------------------------------------------------------------

export function currentContextScenario(data: SetupData): void {
  const { token } = getRandomUserAndToken(data);
  if (!token) {
    sleep(1);
    return;
  }

  group('GET /api/v1/context/current', () => {
    const res = http.get(
      `${API_PREFIX}/context/current`,
      {
        headers: getAuthHeaders(token),
        tags: { name: 'current_context' },
      },
    );

    currentContextDuration.add(res.timings.duration);

    const success = check(res, {
      'current-context status is 200': (r) => r.status === 200,
      'current-context has expected fields': (r) => {
        try {
          const body = JSON.parse(r.body as string);
          return (
            body.success === true &&
            body.data !== null &&
            'role' in body.data &&
            'canSwitch' in body.data
          );
        } catch {
          return false;
        }
      },
      'current-context globalView is boolean': (r) => {
        try {
          const body = JSON.parse(r.body as string);
          return typeof body.data?.globalView === 'boolean';
        } catch {
          return false;
        }
      },
    });

    currentContextSuccess.add(success ? 1 : 0);
    if (!success) {
      currentContextErrors.add(1);
    }
  });

  // Realistic pause (0.5-1.5 seconds)
  sleep(Math.random() + 0.5);
}

// ---------------------------------------------------------------------------
// Teardown — Optional summary logging
// ---------------------------------------------------------------------------

export function teardown(data: SetupData): void {
  console.log(`Load test completed. Tested with ${data.users.length} user profiles.`);
  console.log('Review k6 output for threshold results:');
  console.log('  - context_switch_duration: P95 < 300ms, P99 < 500ms');
  console.log('  - accessible_schools_duration: P95 < 500ms');
  console.log('  - current_context_duration: P95 < 200ms');
}
