import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(() => {
    service = new CacheService();
  });

  describe('set & get', () => {
    it('should store and retrieve a value', async () => {
      await service.set('key1', { name: 'test' });
      const result = await service.get<{ name: string }>('key1');
      expect(result).toEqual({ name: 'test' });
    });

    it('should return null for non-existent key', async () => {
      const result = await service.get('non-existent');
      expect(result).toBeNull();
    });

    it('should return null for expired key', async () => {
      await service.set('key2', 'value', { ttl: 0 });
      // Wait a tiny bit for expiration
      await new Promise((r) => setTimeout(r, 10));
      const result = await service.get('key2');
      expect(result).toBeNull();
    });

    it('should overwrite existing key', async () => {
      await service.set('key3', 'old');
      await service.set('key3', 'new');
      const result = await service.get('key3');
      expect(result).toBe('new');
    });
  });

  describe('setStatic', () => {
    it('should store with longer TTL', async () => {
      await service.setStatic('static-key', [1, 2, 3]);
      const result = await service.get<number[]>('static-key');
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('del', () => {
    it('should delete a key', async () => {
      await service.set('del-key', 'value');
      await service.del('del-key');
      const result = await service.get('del-key');
      expect(result).toBeNull();
    });
  });

  describe('delByPattern', () => {
    it('should delete all keys matching prefix', async () => {
      await service.set('teachers:school-1:list', []);
      await service.set('teachers:school-1:detail', {});
      await service.set('teachers:school-2:list', []);
      await service.delByPattern('teachers:school-1');
      expect(await service.get('teachers:school-1:list')).toBeNull();
      expect(await service.get('teachers:school-1:detail')).toBeNull();
      expect(await service.get('teachers:school-2:list')).toEqual([]);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value without calling factory', async () => {
      await service.set('cached', 'existing');
      const factory = jest.fn().mockResolvedValue('new');

      const result = await service.getOrSet('cached', factory);

      expect(result).toBe('existing');
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result on miss', async () => {
      const factory = jest.fn().mockResolvedValue('computed');

      const result = await service.getOrSet('miss-key', factory);

      expect(result).toBe('computed');
      expect(factory).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await service.getOrSet('miss-key', factory);
      expect(result2).toBe('computed');
      expect(factory).toHaveBeenCalledTimes(1);
    });
  });

  describe('flush', () => {
    it('should clear all entries', async () => {
      await service.set('a', 1);
      await service.set('b', 2);
      await service.flush();
      expect(service.size()).toBe(0);
    });
  });

  describe('size', () => {
    it('should return number of entries', async () => {
      expect(service.size()).toBe(0);
      await service.set('x', 'y');
      expect(service.size()).toBe(1);
    });
  });
});
