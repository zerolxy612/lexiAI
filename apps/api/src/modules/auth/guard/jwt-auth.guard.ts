import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ACCESS_TOKEN_COOKIE } from '@refly/utils';
import { AppMode } from '@/modules/config/app.config';
import { PrismaService } from '../../../modules/common/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();

    // If we are in desktop mode, we don't need to check the JWT token
    if (this.configService.get('mode') === AppMode.Desktop) {
      request.user = { uid: this.configService.get('local.uid') };
      return true;
    }

    // If auth verification is skipped (development mode), create a mock user
    if (this.configService.get('auth.skipVerification')) {
      this.logger.debug('Skipping JWT verification due to AUTH_SKIP_VERIFICATION=true');

      const devUserId = 'u-dev-user';

      // Ensure the dev user exists in database
      await this.ensureDevUserExists(devUserId);

      request.user = {
        uid: devUserId,
        email: 'dev@example.com',
      };
      return true;
    }

    const token = this.extractTokenFromRequest(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('auth.jwt.secret'),
      });

      // 💡 We're assigning the payload to the request object here
      // so that we can access it in our route handlers
      request.user = payload;
    } catch (error) {
      this.logger.warn(`jwt verify not valid: ${error}`);
      throw new UnauthorizedException();
    }
    return true;
  }

  private async ensureDevUserExists(uid: string): Promise<void> {
    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { uid },
      });

      if (!existingUser) {
        await this.prisma.user.create({
          data: {
            uid,
            name: 'Dev User',
            nickname: 'Dev User',
            email: 'dev@example.com',
            emailVerified: new Date(),
            outputLocale: 'auto',
          },
        });
        this.logger.debug(`Created development user: ${uid}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to ensure dev user exists: ${error.message}`);
    }
  }

  private extractTokenFromRequest(request: Request): string | undefined {
    // Try to get token from Authorization header
    const authHeader = request.headers?.authorization;
    if (authHeader) {
      const [type, token] = authHeader.split(' ');
      if (type === 'Bearer') {
        return token;
      }
    }

    // Try to get token from cookie
    const token = request.cookies?.[ACCESS_TOKEN_COOKIE];
    if (token) {
      return token;
    }

    return undefined;
  }
}
