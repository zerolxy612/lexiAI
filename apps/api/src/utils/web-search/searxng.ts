import { Injectable } from '@nestjs/common';
import { WebSearchRequest, WebSearchResult, BatchWebSearchRequest } from '@refly/openapi-schema';
import { BaseWebSearcher } from './base';

/**
 * Response interface for SearXNG API
 */
interface SearXNGSearchResult {
  url: string;
  title: string;
  content: string;
  engine?: string;
  parsed_url?: string[];
  engines?: string[];
  positions?: number[];
  score?: number;
  category?: string;
  pretty_url?: string;
  img_src?: string;
}

/**
 * SearXNG API implementation of the web searcher
 */
@Injectable()
export class SearXNGWebSearcher extends BaseWebSearcher {
  private readonly baseUrl: string;

  constructor(config: { apiUrl: string } & Partial<any>) {
    super(config);

    if (!config.apiUrl) {
      throw new Error('SearXNG API URL must be provided');
    }

    this.baseUrl = config.apiUrl;
  }

  /**
   * Perform web search using SearXNG API.
   *
   * @param req The search request (single or batch)
   * @returns Web search results
   */
  async search(req: WebSearchRequest | BatchWebSearchRequest): Promise<WebSearchResult[]> {
    try {
      const queries: WebSearchRequest[] = 'queries' in req ? req.queries : [req];
      const results: WebSearchResult[] = [];

      // Process each query
      for (const query of queries) {
        if (!query?.q) {
          continue;
        }

        const searchResults = await this.executeSearXNGQuery(query);
        results.push(...searchResults);
      }

      const limit = req?.limit || this.config.defaultLimit;
      return 'queries' in req ? results : results?.slice(0, limit);
    } catch (error) {
      this.logger.error(
        `SearXNG search error: ${error?.stack || error?.message || 'Unknown error'}`,
      );
      return this.defaultFallback(error);
    }
  }

  /**
   * Execute a single SearXNG query
   *
   * @param query The search query request
   * @returns Processed web search results
   */
  private async executeSearXNGQuery(query: WebSearchRequest): Promise<WebSearchResult[]> {
    const params = new URLSearchParams();

    // Required parameter
    params.append('q', query.q);

    // Optional parameters
    params.append('format', 'json');

    if (query.limit || this.config.defaultLimit) {
      // SearXNG doesn't have direct limit parameter, but we can control pages
      // We'll fetch one page and filter later
      params.append('pageno', '1');
    }

    if (query.hl || this.config.defaultLocale) {
      params.append('language', query.hl || this.config.defaultLocale);
    }

    // Time range support if needed
    // params.append('time_range', 'day|week|month|year');

    // Safety filters if needed
    // params.append('safesearch', '0|1|2');

    const searchUrl = `${this.baseUrl}search?${params.toString()}`;

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`SearXNG API returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return this.parseSearchResults(
      data,
      query.hl || this.config.defaultLocale,
      query.limit || this.config.defaultLimit,
    );
  }

  /**
   * Parse search results from SearXNG API
   *
   * @param data The JSON response from SearXNG API
   * @param locale The locale used for the search
   * @param limit The maximum number of results to return
   * @returns Processed web search results
   */
  private parseSearchResults(
    data: SearXNGSearchResult,
    locale: string,
    limit: number,
  ): WebSearchResult[] {
    const results: WebSearchResult[] = [];

    if (data?.results?.length) {
      for (const result of data.results) {
        if (results.length >= limit) break;

        // Skip results without required fields
        if (!result?.url || !result?.title) continue;

        results.push({
          name: result.title,
          url: result.url,
          snippet: result.content || '',
          locale,
        });
      }
    }

    // Also add answer if available
    if (data?.answers?.length) {
      for (const answer of data.answers) {
        if (results.length >= limit) break;

        results.push({
          name: 'SearXNG Answer',
          url: answer.url || '',
          snippet: answer.content || answer.answer || '',
          locale,
        });
      }
    }

    // Add infoboxes if available
    if (data?.infoboxes?.length) {
      for (const infobox of data.infoboxes) {
        if (results.length >= limit) break;

        results.push({
          name: infobox.title || 'Information',
          url: infobox.url || '',
          snippet: infobox.content || '',
          locale,
        });
      }
    }

    return results;
  }
}
