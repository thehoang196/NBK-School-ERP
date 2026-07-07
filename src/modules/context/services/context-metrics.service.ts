import { Injectable } from '@nestjs/common';
import {
  Counter,
  Histogram,
  Registry,
  register,
} from 'prom-client';

/**
 * ContextMetricsService — Prometheus metrics cho Context Switcher.
 *
 * Cung cấp các custom metrics để giám sát hoạt động chuyển workspace:
 * - context_switch_total: Tổng số lần chuyển context (label: status=success/failed)
 * - context_switch_failed: Số lần chuyển context thất bại
 * - redis_context_hit: Số lần cache hit Redis session
 * - redis_context_miss: Số lần cache miss Redis session
 * - context_resolution_time: Thời gian resolve context (ms)
 * - global_view_requests: Số request ở chế độ Global View
 *
 * Service sử dụng default Prometheus registry.
 * Injectable — consumers nên dùng @Optional() để metrics không block logic chính.
 */
@Injectable()
export class ContextMetricsService {
  private readonly contextSwitchTotal: Counter<string>;
  private readonly contextSwitchFailed: Counter<string>;
  private readonly redisContextHit: Counter<string>;
  private readonly redisContextMiss: Counter<string>;
  private readonly contextResolutionTime: Histogram<string>;
  private readonly globalViewRequests: Counter<string>;

  constructor() {
    // context_switch_total — Counter with label status (success/failed)
    this.contextSwitchTotal = this.getOrCreateCounter(
      'context_switch_total',
      'Total context switch attempts',
      ['status'],
    );

    // context_switch_failed — Counter for failed switch attempts
    this.contextSwitchFailed = this.getOrCreateCounter(
      'context_switch_failed',
      'Total failed context switch attempts',
    );

    // redis_context_hit — Counter for Redis session cache hits
    this.redisContextHit = this.getOrCreateCounter(
      'redis_context_hit',
      'Redis context session cache hits',
    );

    // redis_context_miss — Counter for Redis session cache misses
    this.redisContextMiss = this.getOrCreateCounter(
      'redis_context_miss',
      'Redis context session cache misses',
    );

    // context_resolution_time — Histogram for context resolution time in ms
    this.contextResolutionTime = this.getOrCreateHistogram(
      'context_resolution_time',
      'Time to resolve context in milliseconds',
      [10, 25, 50, 100, 150, 200, 300, 500, 1000],
    );

    // global_view_requests — Counter for requests in Global View mode
    this.globalViewRequests = this.getOrCreateCounter(
      'global_view_requests',
      'Total requests in Global View mode',
    );
  }

  /**
   * Record a successful context switch.
   */
  recordSwitchSuccess(): void {
    this.contextSwitchTotal.inc({ status: 'success' });
  }

  /**
   * Record a failed context switch.
   */
  recordSwitchFailed(): void {
    this.contextSwitchTotal.inc({ status: 'failed' });
    this.contextSwitchFailed.inc();
  }

  /**
   * Record a Redis context session cache hit.
   */
  recordRedisHit(): void {
    this.redisContextHit.inc();
  }

  /**
   * Record a Redis context session cache miss.
   */
  recordRedisMiss(): void {
    this.redisContextMiss.inc();
  }

  /**
   * Record context resolution time in milliseconds.
   */
  recordResolutionTime(durationMs: number): void {
    this.contextResolutionTime.observe(durationMs);
  }

  /**
   * Record a request in Global View mode.
   */
  recordGlobalViewRequest(): void {
    this.globalViewRequests.inc();
  }

  /**
   * Get the default Prometheus registry (for exposing /metrics endpoint).
   */
  getRegistry(): Registry {
    return register;
  }

  /**
   * Get or create a Counter metric, avoiding duplicate registration errors.
   */
  private getOrCreateCounter(
    name: string,
    help: string,
    labelNames?: string[],
  ): Counter<string> {
    const existing = register.getSingleMetric(name);
    if (existing) {
      return existing as Counter<string>;
    }
    return new Counter({
      name,
      help,
      labelNames: labelNames || [],
    });
  }

  /**
   * Get or create a Histogram metric, avoiding duplicate registration errors.
   */
  private getOrCreateHistogram(
    name: string,
    help: string,
    buckets: number[],
  ): Histogram<string> {
    const existing = register.getSingleMetric(name);
    if (existing) {
      return existing as Histogram<string>;
    }
    return new Histogram({
      name,
      help,
      buckets,
    });
  }
}
