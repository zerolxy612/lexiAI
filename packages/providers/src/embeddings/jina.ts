import { Embeddings } from '@langchain/core/embeddings';

export interface JinaEmbeddingsConfig {
  model: string;
  batchSize: number;
  maxRetries: number;
  dimensions: number;
  apiKey: string;
}

export class JinaEmbeddings extends Embeddings {
  private config: JinaEmbeddingsConfig;

  constructor(config: JinaEmbeddingsConfig) {
    super(config);
    this.config = config;
  }

  private async fetch(input: string[]) {
    const payload = {
      model: this.config.model,
      task: 'retrieval.passage',
      dimensions: this.config.dimensions,
      late_chunking: false,
      input,
    };

    console.log(`[JinaEmbeddings] Making request to Jina API:`);
    console.log(`[JinaEmbeddings] - URL: https://api.jina.ai/v1/embeddings`);
    console.log(`[JinaEmbeddings] - Model: ${this.config.model}`);
    console.log(`[JinaEmbeddings] - Dimensions: ${this.config.dimensions}`);
    console.log(`[JinaEmbeddings] - Input count: ${input.length}`);
    console.log(`[JinaEmbeddings] - API Key: ${this.config.apiKey.substring(0, 10)}...`);
    console.log(`[JinaEmbeddings] - Payload:`, JSON.stringify(payload, null, 2));

    const response = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    console.log(`[JinaEmbeddings] Response status: ${response.status} ${response.statusText}`);
    console.log(
      `[JinaEmbeddings] Response headers:`,
      Object.fromEntries(response.headers.entries()),
    );

    if (response.status !== 200) {
      const errorText = await response.text();
      console.error(`[JinaEmbeddings] Error response body:`, errorText);
      throw new Error(
        `call embeddings failed: ${response.status} ${response.statusText} ${errorText}`,
      );
    }

    const data = await response.json();
    console.log(`[JinaEmbeddings] Success response:`, JSON.stringify(data, null, 2));

    return data;
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    const body = await this.fetch(documents);
    return body.data.map((point: { embedding: number[] }) => point.embedding);
  }

  async embedQuery(query: string): Promise<number[]> {
    const body = await this.fetch([query]);
    if (body.data.length === 0) {
      throw new Error('No embedding returned');
    }
    return body.data[0].embedding;
  }
}
