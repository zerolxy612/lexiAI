import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SearchResultDto } from './dto/deep-research-response.dto';

interface GoogleSearchResponse {
  items?: GoogleSearchItem[];
  searchInformation?: {
    totalResults: string;
    searchTime: number;
  };
  error?: {
    code: number;
    message: string;
    errors: any[];
  };
}

interface GoogleSearchItem {
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
  private readonly numResults: number;
  private readonly safesearch: string;
  private readonly language: string;
  private readonly baseUrl = 'https://www.googleapis.com/customsearch/v1';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get('credentials.google.searchApiKey');
    this.cx = this.configService.get('credentials.google.searchCx');
    this.numResults = this.configService.get('GOOGLE_SEARCH_NUM_RESULTS') || 8;
    this.safesearch = this.configService.get('GOOGLE_SEARCH_SAFE_SEARCH') || 'active';
    this.language = this.configService.get('GOOGLE_SEARCH_LANGUAGE') || 'zh-CN';

    this.logger.log('GoogleSearchService initialized');
    this.logger.log(`API Key configured: ${this.apiKey ? 'Yes' : 'No'}`);
    this.logger.log(`Search CX configured: ${this.cx ? 'Yes' : 'No'}`);
  }

  /**
   * Perform Google Custom Search
   * @param query - Search query string
   * @param options - Additional search options
   * @returns Array of search results
   */
  async search(
    query: string,
    options?: {
      num?: number;
      start?: number;
      language?: string;
    },
  ): Promise<SearchResultDto[]> {
    if (!this.apiKey || !this.cx) {
      this.logger.error('Google Search API not properly configured');
      throw new HttpException('Search service not available', HttpStatus.SERVICE_UNAVAILABLE);
    }

    try {
      const params = new URLSearchParams({
        key: this.apiKey,
        cx: this.cx,
        q: query,
        num: String(options?.num || this.numResults),
        start: String(options?.start || 1),
        ...(options?.language && { hl: options.language }),
        safesearch: this.safesearch,
      });

      const url = `${this.baseUrl}?${params.toString()}`;

      this.logger.debug(`Performing Google search for query: "${query}"`);
      this.logger.debug(`Search URL: ${url.replace(this.apiKey, '***')}`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'LexiHK Deep Research Bot/1.0',
        },
      });

      if (!response.ok) {
        throw new HttpException(
          `Google Search API error: ${response.status} ${response.statusText}`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      const data: GoogleSearchResponse = await response.json();

      // Handle API errors
      if (data.error) {
        this.logger.error('Google Search API error:', data.error);
        throw new HttpException(
          `Google Search API error: ${data.error.message}`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      // Transform results
      const results = this.transformSearchResults(data.items || []);

      this.logger.log(`Found ${results.length} search results for query: "${query}"`);
      return results;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Unexpected error during Google search:', error);
      throw new HttpException(
        'Search service temporarily unavailable',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Transform Google Search API response to our DTO format
   * @param items - Google search items
   * @returns Transformed search results
   */
  private transformSearchResults(items: GoogleSearchItem[]): SearchResultDto[] {
    return items.map((item) => ({
      title: this.cleanText(item.title),
      link: item.link,
      snippet: this.cleanText(item.snippet),
      displayLink: item.displayLink,
    }));
  }

  /**
   * Clean and sanitize text content
   * @param text - Raw text from search results
   * @returns Cleaned text
   */
  private cleanText(text: string): string {
    if (!text) return '';

    return text
      .replace(/\n/g, ' ') // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .replace(/[^\x20-\x7E\u4e00-\u9fff]/g, '') // Keep only ASCII and Chinese characters
      .trim();
  }

  /**
   * Test the Google Search API configuration
   * @returns Boolean indicating if the service is working
   */
  async testConnection(): Promise<boolean> {
    try {
      const results = await this.search('test', { num: 1 });
      return results.length >= 0; // Even 0 results is a successful connection
    } catch (error) {
      this.logger.error('Google Search service test failed:', error);
      return false;
    }
  }

  /**
   * Get service health status
   * @returns Service health information
   */
  getHealthStatus(): {
    configured: boolean;
    apiKey: boolean;
    searchEngineId: boolean;
  } {
    return {
      configured: !!(this.apiKey && this.cx),
      apiKey: !!this.apiKey,
      searchEngineId: !!this.cx,
    };
  }
}
