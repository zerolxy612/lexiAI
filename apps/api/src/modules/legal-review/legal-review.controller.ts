import { Body, Controller, Post, Sse, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { CreateLegalReviewDto } from './dto/create-legal-review.dto';
import { LegalReviewService } from './legal-review.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { User } from '@refly/openapi-schema';

@Controller('api/v1/legal-review')
export class LegalReviewController {
  constructor(private readonly legalReviewService: LegalReviewService) {}

  @Post('stream')
  @Sse()
  @UseGuards(JwtAuthGuard)
  async stream(
    @Body() createLegalReviewDto: CreateLegalReviewDto,
    @LoginedUser() user: User,
  ): Promise<Observable<MessageEvent>> {
    const stream = await this.legalReviewService.createStream(createLegalReviewDto.query, user.uid);
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    return new Observable((observer) => {
      const push = async () => {
        const { done, value } = await reader.read();
        if (done) {
          observer.complete();
          return;
        }

        const chunk = decoder.decode(value, { stream: true });
        // Dify stream sends data in 'data: {...}\n\n' format. We need to split and process.
        const lines = chunk.split('\n\n');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            // We are simply forwarding the raw event from Dify
            const eventData = line.substring(5).trim();
            if (eventData) {
              observer.next({ data: JSON.parse(eventData) } as MessageEvent);
            }
          }
        }
        push();
      };
      push();
    });
  }
}
