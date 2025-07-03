import { describe, it, expect, vi } from 'vitest';
import { TaskQueue } from '../lib/queue.js';

describe('TaskQueue', () => {
  it('should create a queue with default concurrency', () => {
    const queue = new TaskQueue();
    expect(queue.size).toBe(0);
    expect(queue.pending).toBe(0);
  });

  it('should create a queue with custom concurrency', () => {
    const queue = new TaskQueue(10);
    expect(queue.size).toBe(0);
    expect(queue.pending).toBe(0);
  });

  it('should execute tasks', async () => {
    const queue = new TaskQueue(1);
    const mockTask = vi.fn().mockResolvedValue('result');

    const result = await queue.add(mockTask);

    expect(result).toBe('result');
    expect(mockTask).toHaveBeenCalledOnce();
  });

  it('should handle task errors', async () => {
    const queue = new TaskQueue(1);
    const mockTask = vi.fn().mockRejectedValue(new Error('Task failed'));

    await expect(queue.add(mockTask)).rejects.toThrow('Task failed');
    expect(mockTask).toHaveBeenCalledOnce();
  });

  it('should respect concurrency limits', async () => {
    const queue = new TaskQueue(2);
    let activeCount = 0;
    let maxActiveCount = 0;

    const createTask = (): (() => Promise<void>) => {
      return async () => {
        activeCount++;
        maxActiveCount = Math.max(maxActiveCount, activeCount);
        await new Promise(resolve => setTimeout(resolve, 50));
        activeCount--;
      };
    };

    const tasks = Array.from({ length: 5 }, () => queue.add(createTask()));
    await Promise.all(tasks);

    expect(maxActiveCount).toBeLessThanOrEqual(2);
  });
});