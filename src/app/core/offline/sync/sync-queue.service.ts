import { Injectable } from '@angular/core';
import { localDb, SyncQueueItem } from '../db/local.db';
import { LoggerService } from '../../logging/logger.service';
import { inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SyncQueueService {
  private readonly logger = inject(LoggerService);

  async enqueue(
    operation: SyncQueueItem['operation'],
    collection: string,
    documentId: string,
    data: unknown
  ): Promise<void> {
    await localDb.syncQueue.add({
      operation,
      collection,
      documentId,
      data: JSON.stringify(data),
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    });
    this.logger.debug('Enqueued sync operation', { operation, collection, documentId });
  }

  async getPending(): Promise<SyncQueueItem[]> {
    return localDb.syncQueue.where('status').equals('pending').toArray();
  }

  async markSynced(id: number): Promise<void> {
    await localDb.syncQueue.update(id, { status: 'synced' });
  }

  async markFailed(id: number, retryCount: number): Promise<void> {
    await localDb.syncQueue.update(id, {
      status: retryCount >= 3 ? 'failed' : 'pending',
      retryCount,
    });
  }

  async flush(): Promise<{ synced: number; failed: number }> {
    const pending = await this.getPending();
    let synced = 0;
    let failed = 0;

    for (const item of pending) {
      try {
        // Firebase sync logic will be injected per-service
        // This is just queue management
        await this.markSynced(item.id!);
        synced++;
      } catch {
        await this.markFailed(item.id!, item.retryCount + 1);
        failed++;
      }
    }

    return { synced, failed };
  }
}
