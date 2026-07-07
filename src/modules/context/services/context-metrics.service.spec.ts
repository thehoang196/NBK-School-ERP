import { register } from 'prom-client';
import { ContextMetricsService } from './context-metrics.service';

describe('ContextMetricsService', () => {
  let service: ContextMetricsService;

  beforeEach(() => {
    // Clear the default Prometheus registry to avoid duplicate metric errors
    register.clear();
    service = new ContextMetricsService();
  });

  afterEach(() => {
    register.clear();
  });

  describe('recordSwitchSuccess', () => {
    it('should increment context_switch_total with status=success', async () => {
      service.recordSwitchSuccess();

      const metric = register.getSingleMetric('context_switch_total');
      expect(metric).toBeDefined();

      const metricData = await metric!.get();
      const successValue = metricData.values.find(
        (v) => v.labels.status === 'success',
      );
      expect(successValue?.value).toBe(1);
    });

    it('should increment correctly on multiple calls', async () => {
      service.recordSwitchSuccess();
      service.recordSwitchSuccess();
      service.recordSwitchSuccess();

      const metric = register.getSingleMetric('context_switch_total');
      const metricData = await metric!.get();
      const successValue = metricData.values.find(
        (v) => v.labels.status === 'success',
      );
      expect(successValue?.value).toBe(3);
    });
  });

  describe('recordSwitchFailed', () => {
    it('should increment context_switch_total with status=failed', async () => {
      service.recordSwitchFailed();

      const metric = register.getSingleMetric('context_switch_total');
      const metricData = await metric!.get();
      const failedValue = metricData.values.find(
        (v) => v.labels.status === 'failed',
      );
      expect(failedValue?.value).toBe(1);
    });

    it('should increment context_switch_failed counter', async () => {
      service.recordSwitchFailed();

      const metric = register.getSingleMetric('context_switch_failed');
      expect(metric).toBeDefined();

      const metricData = await metric!.get();
      expect(metricData.values[0]?.value).toBe(1);
    });

    it('should increment both counters on multiple failures', async () => {
      service.recordSwitchFailed();
      service.recordSwitchFailed();

      const totalMetric = register.getSingleMetric('context_switch_total');
      const totalData = await totalMetric!.get();
      const failedTotal = totalData.values.find(
        (v) => v.labels.status === 'failed',
      );
      expect(failedTotal?.value).toBe(2);

      const failedMetric = register.getSingleMetric('context_switch_failed');
      const failedData = await failedMetric!.get();
      expect(failedData.values[0]?.value).toBe(2);
    });
  });

  describe('recordRedisHit', () => {
    it('should increment redis_context_hit counter', async () => {
      service.recordRedisHit();

      const metric = register.getSingleMetric('redis_context_hit');
      expect(metric).toBeDefined();

      const metricData = await metric!.get();
      expect(metricData.values[0]?.value).toBe(1);
    });

    it('should increment correctly on multiple hits', async () => {
      service.recordRedisHit();
      service.recordRedisHit();
      service.recordRedisHit();

      const metric = register.getSingleMetric('redis_context_hit');
      const metricData = await metric!.get();
      expect(metricData.values[0]?.value).toBe(3);
    });
  });

  describe('recordRedisMiss', () => {
    it('should increment redis_context_miss counter', async () => {
      service.recordRedisMiss();

      const metric = register.getSingleMetric('redis_context_miss');
      expect(metric).toBeDefined();

      const metricData = await metric!.get();
      expect(metricData.values[0]?.value).toBe(1);
    });

    it('should increment correctly on multiple misses', async () => {
      service.recordRedisMiss();
      service.recordRedisMiss();

      const metric = register.getSingleMetric('redis_context_miss');
      const metricData = await metric!.get();
      expect(metricData.values[0]?.value).toBe(2);
    });
  });

  describe('recordResolutionTime', () => {
    it('should observe value in context_resolution_time histogram', async () => {
      service.recordResolutionTime(150);

      const metric = register.getSingleMetric('context_resolution_time');
      expect(metric).toBeDefined();

      const metricData = await metric!.get();
      // In prom-client v15, histogram values include _sum and _count entries
      const sumValue = metricData.values.find(
        (v) => (v as Record<string, unknown>).metricName === 'context_resolution_time_sum',
      );
      const countValue = metricData.values.find(
        (v) => (v as Record<string, unknown>).metricName === 'context_resolution_time_count',
      );
      expect(sumValue?.value).toBe(150);
      expect(countValue?.value).toBe(1);
    });

    it('should observe multiple resolution times correctly', async () => {
      service.recordResolutionTime(100);
      service.recordResolutionTime(200);
      service.recordResolutionTime(50);

      const metric = register.getSingleMetric('context_resolution_time');
      const metricData = await metric!.get();
      const sumValue = metricData.values.find(
        (v) => (v as Record<string, unknown>).metricName === 'context_resolution_time_sum',
      );
      const countValue = metricData.values.find(
        (v) => (v as Record<string, unknown>).metricName === 'context_resolution_time_count',
      );
      expect(sumValue?.value).toBe(350);
      expect(countValue?.value).toBe(3);
    });
  });

  describe('recordGlobalViewRequest', () => {
    it('should increment global_view_requests counter', async () => {
      service.recordGlobalViewRequest();

      const metric = register.getSingleMetric('global_view_requests');
      expect(metric).toBeDefined();

      const metricData = await metric!.get();
      expect(metricData.values[0]?.value).toBe(1);
    });

    it('should increment correctly on multiple global view requests', async () => {
      service.recordGlobalViewRequest();
      service.recordGlobalViewRequest();

      const metric = register.getSingleMetric('global_view_requests');
      const metricData = await metric!.get();
      expect(metricData.values[0]?.value).toBe(2);
    });
  });

  describe('getRegistry', () => {
    it('should return the default Prometheus registry', () => {
      const registry = service.getRegistry();
      expect(registry).toBe(register);
    });
  });

  describe('metric isolation (success vs failure)', () => {
    it('should track success and failure independently in context_switch_total', async () => {
      service.recordSwitchSuccess();
      service.recordSwitchSuccess();
      service.recordSwitchFailed();

      const metric = register.getSingleMetric('context_switch_total');
      const metricData = await metric!.get();

      const successValue = metricData.values.find(
        (v) => v.labels.status === 'success',
      );
      const failedValue = metricData.values.find(
        (v) => v.labels.status === 'failed',
      );
      expect(successValue?.value).toBe(2);
      expect(failedValue?.value).toBe(1);
    });

    it('should track redis hit and miss independently', async () => {
      service.recordRedisHit();
      service.recordRedisHit();
      service.recordRedisMiss();

      const hitMetric = register.getSingleMetric('redis_context_hit');
      const missMetric = register.getSingleMetric('redis_context_miss');

      const hitData = await hitMetric!.get();
      const missData = await missMetric!.get();

      expect(hitData.values[0]?.value).toBe(2);
      expect(missData.values[0]?.value).toBe(1);
    });
  });
});
