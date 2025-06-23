import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink?: string;
}

@Injectable()
export class GoogleSearchService {
  private readonly logger = new Logger(GoogleSearchService.name);
  private readonly apiKey: string;
  private readonly cx: string;
  private readonly baseUrl = 'https://www.googleapis.com/customsearch/v1';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('LAS_SEARCH_GOOGLE_KEY');
    this.cx = this.configService.get<string>('LAS_SEARCH_GOOGLE_CX');

    if (!this.apiKey || !this.cx) {
      this.logger.warn('Google Search API Key or CX is not configured. The service will not work.');
    } else {
      this.logger.log('GoogleSearchService initialized successfully with API Key and CX.');
    }
  }

  async search(
    query: string,
    options?: { num?: number; start?: number; language?: string },
  ): Promise<SearchResult[]> {
    if (!this.apiKey || !this.cx) {
      this.logger.error('Google Search API is not configured.');
      throw new HttpException('Search service is not available', HttpStatus.SERVICE_UNAVAILABLE);
    }

    const params = new URLSearchParams({
      key: this.apiKey,
      cx: this.cx,
      q: query,
      num: String(options?.num || 8),
      start: String(options?.start || 1),
      safesearch: 'active',
      ...(options?.language && { hl: options.language }),
    });

    const url = `${this.baseUrl}?${params.toString()}`;
    this.logger.debug(`[GoogleSearch] Sending request to: ${url.replace(this.apiKey, '***')}`);

    try {
      const response = await fetch(url);
      const data = await response.json();
      this.logger.debug(`[GoogleSearch] Received raw response: ${JSON.stringify(data, null, 2)}`);

      if (!response.ok || data.error) {
        const errorDetails = data.error
          ? JSON.stringify(data.error)
          : `${response.status} ${response.statusText}`;
        this.logger.error(`Google Search API error: ${errorDetails}`);
        throw new HttpException(
          `Google Search API error: ${errorDetails}`,
          response.status || HttpStatus.BAD_GATEWAY,
        );
      }

      const searchResults = (data.items || []).map((item) => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        displayLink: item.displayLink,
      }));
      this.logger.debug(`[GoogleSearch] Parsed ${searchResults.length} results.`);
      return searchResults;
    } catch (error) {
      this.logger.error(
        `[GoogleSearch] An unexpected error occurred during the fetch call for query "${query}". Full error:`,
        error,
      );

      // Fallback to mock data in development environment
      if (process.env.NODE_ENV === 'development') {
        this.logger.warn('Google Search failed in DEV mode. Returning mock data instead.');
        return this.getMockSearchResults(query);
      }

      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Search service call failed due to an internal error: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private getMockSearchResults(query: string): SearchResult[] {
    this.logger.log(`Generating mock search results for query: "${query}"`);
    return [
      {
        title: 'Mock Result 1: Comprehensive Guide to Topic',
        link: 'https://mock-link-1.com/guide',
        snippet: `This is a detailed mock snippet for the query "${query}". It provides an overview of the main concepts, key features, and important considerations. This guide is designed for both beginners and experts.`,
      },
      {
        title: 'Mock Result 2: Advanced Techniques',
        link: 'https://mock-link-2.com/advanced',
        snippet: `Explore advanced techniques related to "${query}". This article covers in-depth strategies, performance optimizations, and real-world case studies to enhance your understanding.`,
      },
      {
        title: 'Mock Result 3: News and Recent Developments',
        link: 'https://mock-link-3.com/news',
        snippet: `Stay up-to-date with the latest news and developments on "${query}". This resource provides timely updates from credible sources around the world.`,
      },
      {
        title: 'Mock Result 4: Community Forum Discussion',
        link: 'https://mock-link-4.com/forum',
        snippet: `Join the community discussion about "${query}". See what others are saying, ask questions, and share your own experiences and insights with a large community of peers.`,
      },
      {
        title: 'Mock Result 5: Official Documentation',
        link: 'https://mock-link-5.com/docs',
        snippet: `The official documentation provides the most accurate and reliable information. Refer to this for technical specifications and usage guidelines regarding "${query}".`,
      },
    ];
  }
}
