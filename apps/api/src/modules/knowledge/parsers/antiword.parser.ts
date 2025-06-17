import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { BaseParser, ParserOptions, ParseResult } from './base';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

@Injectable()
export class AntiwordParser extends BaseParser {
  private readonly logger = new Logger(AntiwordParser.name);

  name = 'antiword';

  constructor(options: ParserOptions = {}) {
    super({
      format: 'text',
      timeout: 30000,
      ...options,
    });
  }

  private async createTempFile(buffer: Buffer): Promise<string> {
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `antiword-${Date.now()}.doc`);
    await fs.writeFile(tempFile, buffer);
    return tempFile;
  }

  private async cleanupTempFile(tempFile: string): Promise<void> {
    try {
      await fs.unlink(tempFile);
    } catch {
      // Ignore cleanup errors
    }
  }

  async parse(input: string | Buffer): Promise<ParseResult> {
    if (this.options.mockMode) {
      return {
        content: 'Mocked antiword content',
        metadata: { format: 'doc' },
      };
    }

    // Convert input to buffer if it's a string
    const inputBuffer = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf-8');
    const tempFile = await this.createTempFile(inputBuffer);

    try {
      // Use antiword to extract text from .doc file
      const antiword = spawn('antiword', [tempFile]);

      return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';

        antiword.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        antiword.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        antiword.on('close', async (code) => {
          try {
            if (code !== 0) {
              reject(new Error(`Antiword failed with code ${code}: ${stderr}`));
              return;
            }

            resolve({
              content: stdout,
              metadata: { format: 'doc' },
            });
          } finally {
            await this.cleanupTempFile(tempFile);
          }
        });

        antiword.on('error', async (error) => {
          await this.cleanupTempFile(tempFile);
          reject(error);
        });

        // Handle timeout
        const timeout = setTimeout(async () => {
          antiword.kill();
          await this.cleanupTempFile(tempFile);
          reject(new Error(`Antiword process timed out after ${this.options.timeout}ms`));
        }, this.options.timeout);

        antiword.on('close', () => {
          clearTimeout(timeout);
        });
      });
    } catch (error) {
      await this.cleanupTempFile(tempFile);
      return this.handleError(error);
    }
  }
}
