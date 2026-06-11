import { createHash } from 'node:crypto';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { Observable, Subject } from 'rxjs';
import { BodyLabConfigService } from '../config/config.service';

export interface SyncNotification {
  accountHash: string;
  resource: string;
  action: 'created' | 'updated' | 'deleted' | 'imported';
  id?: unknown;
  cursor: string;
  updatedAt?: unknown;
}

export interface ServerSentMessage {
  type?: string;
  data: SyncNotification;
}

export interface PredictionConfigNotification {
  accountHash: string;
  resource: 'prediction-config';
  action: 'updated';
  cursor: string;
  items: unknown[];
}

export interface PredictionConfigServerSentMessage {
  type?: string;
  data: PredictionConfigNotification;
}

@Injectable()
export class SyncService implements OnModuleDestroy {
  private readonly logger = new Logger(SyncService.name);
  private readonly publisher?: Redis;
  private readonly localSyncStreams = new Map<string, Subject<ServerSentMessage>>();
  private readonly localPredictionConfigStreams = new Map<string, Subject<PredictionConfigServerSentMessage>>();

  constructor(private readonly config: BodyLabConfigService) {
    if (this.config.redisUrl) {
      this.publisher = new Redis(this.config.redisUrl, {
        keyPrefix: `${this.config.redisKeyPrefix}:`,
        lazyConnect: true,
      });
    }
  }

  async publish(
    accountId: string,
    resource: string,
    action: SyncNotification['action'],
    row: Record<string, unknown>,
  ): Promise<void> {
    const payload: SyncNotification = {
      accountHash: this.accountHash(accountId),
      resource,
      action,
      id: row.id,
      cursor: String(row.updatedAt ?? row.updated_at ?? new Date().toISOString()),
      updatedAt: row.updatedAt ?? row.updated_at,
    };

    if (!this.publisher) {
      this.localSyncSubject(accountId).next({ type: 'sync', data: payload });
      return;
    }

    try {
      await this.publisher.connect().catch((error: Error & { message?: string }) => {
        if (!error.message?.includes('already connecting') && !error.message?.includes('already connected')) {
          throw error;
        }
      });
      await this.publisher.publish(this.channel(accountId), JSON.stringify(payload));
    } catch (error) {
      this.logger.warn(`Redis sync publish failed: ${(error as Error).message}`);
    }
  }

  async publishPredictionConfig(accountId: string, items: unknown[]): Promise<void> {
    const payload: PredictionConfigNotification = {
      accountHash: this.accountHash(accountId),
      resource: 'prediction-config',
      action: 'updated',
      cursor: new Date().toISOString(),
      items,
    };

    if (!this.publisher) {
      this.localPredictionConfigSubject(accountId).next({ type: 'prediction-config', data: payload });
      return;
    }

    try {
      await this.publisher.connect().catch((error: Error & { message?: string }) => {
        if (!error.message?.includes('already connecting') && !error.message?.includes('already connected')) {
          throw error;
        }
      });
      await this.publisher.publish(this.predictionConfigChannel(accountId), JSON.stringify(payload));
    } catch (error) {
      this.logger.warn(`Redis prediction config publish failed: ${(error as Error).message}`);
    }
  }

  streamPredictionConfig(accountId: string): Observable<PredictionConfigServerSentMessage> {
    return new Observable((subscriber) => {
      if (!this.config.redisUrl) {
        subscriber.next({
          type: 'prediction-config-ready',
          data: {
            accountHash: this.accountHash(accountId),
            resource: 'prediction-config',
            action: 'updated',
            cursor: new Date().toISOString(),
            items: [],
          },
        });
        const subscription = this.localPredictionConfigSubject(accountId).subscribe((event) => subscriber.next(event));
        return () => subscription.unsubscribe();
      }

      const redis = new Redis(this.config.redisUrl, {
        keyPrefix: `${this.config.redisKeyPrefix}:`,
        lazyConnect: true,
      });
      const onMessage = (_channel: string, message: string) => {
        subscriber.next({ type: 'prediction-config', data: JSON.parse(message) as PredictionConfigNotification });
      };

      redis.on('message', onMessage);
      redis
        .connect()
        .then(() => redis.subscribe(this.predictionConfigChannel(accountId)))
        .catch((error) => subscriber.error(error));

      return () => {
        redis.off('message', onMessage);
        redis.disconnect();
      };
    });
  }

  stream(accountId: string): Observable<ServerSentMessage> {
    return new Observable((subscriber) => {
      if (!this.config.redisUrl) {
        subscriber.next({
          type: 'sync-ready',
          data: {
            accountHash: this.accountHash(accountId),
            resource: 'sync',
            action: 'updated',
            cursor: new Date().toISOString(),
          },
        });
        const subscription = this.localSyncSubject(accountId).subscribe((event) => subscriber.next(event));
        return () => subscription.unsubscribe();
      }

      const redis = new Redis(this.config.redisUrl, {
        keyPrefix: `${this.config.redisKeyPrefix}:`,
        lazyConnect: true,
      });
      const channel = this.channel(accountId);
      const onMessage = (_channel: string, message: string) => {
        subscriber.next({ type: 'sync', data: JSON.parse(message) as SyncNotification });
      };

      redis.on('message', onMessage);
      redis
        .connect()
        .then(() => redis.subscribe(channel))
        .catch((error) => subscriber.error(error));

      return () => {
        redis.off('message', onMessage);
        redis.disconnect();
      };
    });
  }

  accountHash(accountId: string): string {
    return createHash('sha256').update(accountId).digest('hex');
  }

  async onModuleDestroy(): Promise<void> {
    this.publisher?.disconnect();
  }

  private channel(accountId: string): string {
    return `sync:${this.accountHash(accountId)}`;
  }

  private predictionConfigChannel(accountId: string): string {
    return `prediction-config:${this.accountHash(accountId)}`;
  }

  private localSyncSubject(accountId: string): Subject<ServerSentMessage> {
    const channel = this.channel(accountId);
    let subject = this.localSyncStreams.get(channel);
    if (!subject) {
      subject = new Subject<ServerSentMessage>();
      this.localSyncStreams.set(channel, subject);
    }
    return subject;
  }

  private localPredictionConfigSubject(accountId: string): Subject<PredictionConfigServerSentMessage> {
    const channel = this.predictionConfigChannel(accountId);
    let subject = this.localPredictionConfigStreams.get(channel);
    if (!subject) {
      subject = new Subject<PredictionConfigServerSentMessage>();
      this.localPredictionConfigStreams.set(channel, subject);
    }
    return subject;
  }
}
