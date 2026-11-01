import { esClient, ES_EMAIL_INDEX, isElasticsearchAvailable } from '../config/elasticsearch.js';
import { logger } from '../utils/logger.js';

export interface EmailDocument {
  id: string;
  userId: string;
  campaignId?: string | null;
  senderId?: string | null;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: Date | string;
  sentAt?: Date | string | null;
  createdAt: Date | string;
}

export const elasticsearchService = {
  async indexEmail(email: EmailDocument): Promise<void> {
    if (!isElasticsearchAvailable()) return;
    try {
      await esClient.index({
        index: ES_EMAIL_INDEX,
        id: email.id,
        document: {
          ...email,
          scheduledAt: new Date(email.scheduledAt).toISOString(),
          sentAt: email.sentAt ? new Date(email.sentAt).toISOString() : null,
          createdAt: new Date(email.createdAt).toISOString(),
        },
      });
    } catch (err: any) {
      logger.error(`Elasticsearch indexing failed for email ${email.id}:`, err.message);
    }
  },

  async updateEmailStatus(id: string, status: string, sentAt?: Date | null): Promise<void> {
    if (!isElasticsearchAvailable()) return;
    try {
      await esClient.update({
        index: ES_EMAIL_INDEX,
        id,
        doc: {
          status,
          ...(sentAt ? { sentAt: new Date(sentAt).toISOString() } : {}),
        },
      });
    } catch (err: any) {
      logger.error(`Elasticsearch status update failed for email ${id}:`, err.message);
    }
  },

  async searchEmails(
    userId: string,
    query?: string,
    status?: string,
    from: number = 0,
    size: number = 20
  ): Promise<{ total: number; emails: any[] }> {
    if (!isElasticsearchAvailable()) {
      return { total: 0, emails: [] };
    }

    try {
      const mustClauses: any[] = [{ term: { userId } }];

      if (status) {
        mustClauses.push({ term: { status: status.toUpperCase() } });
      }

      if (query && query.trim()) {
        mustClauses.push({
          multi_match: {
            query: query.trim(),
            fields: ['recipient^3', 'subject^2', 'body'],
            fuzziness: 'AUTO',
          },
        });
      }

      const result = await esClient.search({
        index: ES_EMAIL_INDEX,
        from,
        size,
        query: {
          bool: {
            must: mustClauses,
          },
        },
        sort: [{ scheduledAt: { order: 'desc' } }],
      });

      const totalHits =
        typeof result.hits.total === 'number'
          ? result.hits.total
          : (result.hits.total?.value ?? 0);

      const emails = result.hits.hits.map((hit) => hit._source);

      return { total: totalHits, emails };
    } catch (err: any) {
      logger.error('Elasticsearch search error:', err.message);
      return { total: 0, emails: [] };
    }
  },
};

