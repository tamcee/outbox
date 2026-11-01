import { Client } from '@elastic/elasticsearch';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export const ES_EMAIL_INDEX = 'emails';

export const esClient = new Client({
  node: env.ELASTICSEARCH_NODE,
  maxRetries: 2,
  requestTimeout: 3000,
});

let isEsAvailable = false;

export async function initElasticsearch(): Promise<void> {
  try {
    const health = await esClient.cluster.health({});
    isEsAvailable = true;
    logger.info(`Connected to Elasticsearch (cluster status: ${health.status})`);

    const indexExists = await esClient.indices.exists({ index: ES_EMAIL_INDEX });
    if (!indexExists) {
      await esClient.indices.create({
        index: ES_EMAIL_INDEX,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            userId: { type: 'keyword' },
            campaignId: { type: 'keyword' },
            senderId: { type: 'keyword' },
            recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            subject: { type: 'text' },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
            createdAt: { type: 'date' },
          },
        },
      });
      logger.info(`Elasticsearch index '${ES_EMAIL_INDEX}' created`);
    }
  } catch (err: any) {
    isEsAvailable = false;
    logger.warn('Elasticsearch is currently unavailable; continuing in degraded mode:', err.message);
  }
}

export function isElasticsearchAvailable(): boolean {
  return isEsAvailable;
}

