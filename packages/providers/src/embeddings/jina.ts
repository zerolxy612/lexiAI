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

    const response = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.status !== 200) {
      throw new Error(
        `call embeddings failed: ${response.status} ${response.statusText} ${response.text}`,
      );
    }

    const data = await response.json();

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
