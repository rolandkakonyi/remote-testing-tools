import PQueue from 'p-queue';

export class TaskQueue {
  private queue: PQueue;

  constructor(concurrency: number = 5) {
    this.queue = new PQueue({ concurrency });
  }

  async add<T>(task: () => Promise<T>): Promise<T> {
    return this.queue.add(task) as Promise<T>;
  }

  get size(): number {
    return this.queue.size;
  }

  get pending(): number {
    return this.queue.pending;
  }
}

export const defaultQueue = new TaskQueue();