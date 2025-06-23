import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';

@Injectable()
export class LegalReviewService {
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('HKGAI_CONTRACT_API_KEY');
    this.apiUrl = 'https://api.dify.ai/v1/chat-messages';
  }

  async createStream(query: string, userId: string): Promise<ReadableStream<Uint8Array>> {
    if (!this.apiKey) {
      throw new Error('Dify API key is not configured.');
    }

    const body = {
      inputs: {},
      query,
      response_mode: 'streaming',
      user: userId, // Using a static user ID for now
      conversation_id: '', // Empty conversation_id for stateless conversation
      files: [],
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Dify API request failed: ${response.status} ${response.statusText} - ${errorBody}`,
      );
    }

    return response.body;
  }
}
