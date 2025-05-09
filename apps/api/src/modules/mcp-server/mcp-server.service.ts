import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/modules/common/prisma.service';
import {
  DeleteMcpServerRequest,
  ListMcpServersData,
  UpsertMcpServerRequest,
  User,
} from '@refly/openapi-schema';
import { McpServer as McpServerModel } from '@/generated/client';
// 不再需要 serverId 相关代码
import { McpServerNotFoundError, ParamsError } from '@refly/errors';
import { SingleFlightCache } from '@/utils/cache';
import { EncryptionService } from '@/modules/common/encryption.service';

interface GlobalMcpServerConfig {
  servers: McpServerModel[];
}

@Injectable()
export class McpServerService {
  private logger = new Logger(McpServerService.name);
  private globalMcpServerCache: SingleFlightCache<GlobalMcpServerConfig>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {
    this.globalMcpServerCache = new SingleFlightCache(this.fetchGlobalMcpServerConfig.bind(this));
  }

  /**
   * Fetch global MCP server configurations
   */
  async fetchGlobalMcpServerConfig(): Promise<GlobalMcpServerConfig> {
    const servers = await this.prisma.mcpServer.findMany({
      where: {
        isGlobal: true,
        deletedAt: null,
      },
    });

    // Decrypt sensitive information
    const decryptedServers = servers.map((server) => this.decryptServerConfig(server));

    return { servers: decryptedServers };
  }

  /**
   * Encrypt sensitive information in server config
   */
  private encryptServerConfig(server: any): any {
    const result = { ...server };

    // Encrypt headers containing sensitive information
    if (result.headers) {
      try {
        const headers = JSON.parse(result.headers);
        for (const key of Object.keys(headers)) {
          if (
            key.toLowerCase().includes('token') ||
            key.toLowerCase().includes('key') ||
            key.toLowerCase().includes('secret') ||
            key.toLowerCase().includes('password') ||
            key.toLowerCase().includes('auth')
          ) {
            headers[key] = this.encryptionService.encrypt(headers[key]);
          }
        }
        result.headers = JSON.stringify(headers);
      } catch (e) {
        this.logger.warn(`Failed to encrypt headers: ${e}`);
      }
    }

    // Encrypt environment variables containing sensitive information
    if (result.env) {
      try {
        const env = JSON.parse(result.env);
        for (const key of Object.keys(env)) {
          if (
            key.toLowerCase().includes('token') ||
            key.toLowerCase().includes('key') ||
            key.toLowerCase().includes('secret') ||
            key.toLowerCase().includes('password') ||
            key.toLowerCase().includes('auth')
          ) {
            env[key] = this.encryptionService.encrypt(env[key]);
          }
        }
        result.env = JSON.stringify(env);
      } catch (e) {
        this.logger.warn(`Failed to encrypt env: ${e}`);
      }
    }

    return result;
  }

  /**
   * Decrypt sensitive information in server config
   */
  private decryptServerConfig(server: any): any {
    const result = { ...server };

    // Decrypt headers containing sensitive information
    if (result.headers) {
      try {
        const headers = JSON.parse(result.headers);
        for (const key of Object.keys(headers)) {
          if (
            key.toLowerCase().includes('token') ||
            key.toLowerCase().includes('key') ||
            key.toLowerCase().includes('secret') ||
            key.toLowerCase().includes('password') ||
            key.toLowerCase().includes('auth')
          ) {
            headers[key] = this.encryptionService.decrypt(headers[key]);
          }
        }
        result.headers = JSON.stringify(headers);
      } catch (e) {
        this.logger.warn(`Failed to decrypt headers: ${e}`);
      }
    }

    // Decrypt environment variables containing sensitive information
    if (result.env) {
      try {
        const env = JSON.parse(result.env);
        for (const key of Object.keys(env)) {
          if (
            key.toLowerCase().includes('token') ||
            key.toLowerCase().includes('key') ||
            key.toLowerCase().includes('secret') ||
            key.toLowerCase().includes('password') ||
            key.toLowerCase().includes('auth')
          ) {
            env[key] = this.encryptionService.decrypt(env[key]);
          }
        }
        result.env = JSON.stringify(env);
      } catch (e) {
        this.logger.warn(`Failed to decrypt env: ${e}`);
      }
    }

    return result;
  }

  /**
   * List MCP servers for a user
   */
  async listMcpServers(user: User, param: ListMcpServersData['query']) {
    const { enabled, type } = param;
    const servers = await this.prisma.mcpServer.findMany({
      where: {
        uid: user.uid,
        enabled,
        type,
        deletedAt: null,
      },
    });

    // Decrypt sensitive information
    const decryptedServers = servers.map((server) => this.decryptServerConfig(server));

    const { servers: globalServers } = await this.globalMcpServerCache.get();
    return [...globalServers, ...decryptedServers];
  }

  /**
   * Create a new MCP server
   */
  async createMcpServer(user: User, param: UpsertMcpServerRequest) {
    const { name, type, url, command, args, env, headers, reconnect, config, enabled } = param;

    if (!name || !type) {
      throw new ParamsError('Server name and type are required');
    }

    const existingServer = await this.prisma.mcpServer.findFirst({
      where: {
        name,
      },
    });

    // 如果存在已删除的同名服务器，恢复并更新它
    if (existingServer) {
      this.logger.log(`Restoring deleted MCP server with name '${name}'`);

      // 加密敏感信息
      const serverData = this.encryptServerConfig({
        name,
        type,
        url,
        command,
        args: args ? JSON.stringify(args) : null,
        env: env ? JSON.stringify(env) : null,
        headers: headers ? JSON.stringify(headers) : null,
        reconnect: reconnect ? JSON.stringify(reconnect) : null,
        config: config ? JSON.stringify(config) : null,
        enabled,
        deletedAt: null,
      });

      const updatedServer = await this.prisma.mcpServer.update({
        where: {
          pk: existingServer.pk,
        },
        data: serverData,
      });

      // 返回解密后的服务器配置
      return this.decryptServerConfig(updatedServer);
    }

    // Validate required fields based on server type
    if ((type === 'sse' || type === 'streamable') && !url) {
      throw new ParamsError('URL is required for SSE and Streamable server types');
    }

    if (type === 'stdio' && (!command || !args)) {
      throw new ParamsError('Command and args are required for Stdio server type');
    }

    // Encrypt sensitive information
    const serverData = this.encryptServerConfig({
      name,
      type,
      url,
      command,
      args: args ? JSON.stringify(args) : null,
      env: env ? JSON.stringify(env) : null,
      headers: headers ? JSON.stringify(headers) : null,
      reconnect: reconnect ? JSON.stringify(reconnect) : null,
      config: config ? JSON.stringify(config) : null,
      enabled,
    });

    const server = await this.prisma.mcpServer.create({
      data: {
        ...serverData,
        uid: user.uid,
      },
    });

    // Return decrypted server configuration
    return this.decryptServerConfig(server);
  }

  /**
   * Update an existing MCP server
   */
  async updateMcpServer(user: User, param: UpsertMcpServerRequest) {
    const { name, type, url, command, args, env, headers, reconnect, config, enabled } = param;

    if (!name) {
      throw new ParamsError('Server name is required');
    }

    // 根据名称查找服务器
    const server = await this.prisma.mcpServer.findFirst({
      where: {
        name,
        OR: [{ uid: user.uid }, { isGlobal: true }],
        deletedAt: null,
      },
    });

    if (!server) {
      throw new McpServerNotFoundError();
    }
    if (server.isGlobal) {
      throw new ParamsError('Global MCP server cannot be updated');
    }

    // Validate required fields based on server type
    if (type) {
      if ((type === 'sse' || type === 'streamable') && !url && !server.url) {
        throw new ParamsError('URL is required for SSE and Streamable server types');
      }

      if (type === 'stdio' && !command && !server.command && !args && !server.args) {
        throw new ParamsError('Command and args are required for Stdio server type');
      }
    }

    // Encrypt sensitive information
    const serverData = this.encryptServerConfig({
      name,
      type,
      url,
      command,
      args: args ? JSON.stringify(args) : undefined,
      env: env ? JSON.stringify(env) : undefined,
      headers: headers ? JSON.stringify(headers) : undefined,
      reconnect: reconnect ? JSON.stringify(reconnect) : undefined,
      config: config ? JSON.stringify(config) : undefined,
      enabled,
    });

    const updatedServer = await this.prisma.mcpServer.update({
      where: {
        pk: server.pk,
      },
      data: serverData,
    });

    // Return decrypted server configuration
    return this.decryptServerConfig(updatedServer);
  }

  /**
   * Delete an MCP server
   */
  async deleteMcpServer(user: User, param: DeleteMcpServerRequest) {
    const { name } = param;

    if (!name) {
      throw new ParamsError('Server name is required');
    }

    // 根据名称查找服务器
    const server = await this.prisma.mcpServer.findFirst({
      where: {
        name,
        OR: [{ uid: user.uid }, { isGlobal: true }],
        deletedAt: null,
      },
    });

    if (!server) {
      throw new McpServerNotFoundError();
    }
    if (server.isGlobal) {
      throw new ParamsError('Global MCP server cannot be deleted');
    }

    return this.prisma.mcpServer.update({
      where: {
        pk: server.pk,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Validate MCP server configuration
   */
  async validateMcpServer(_user: User, param: UpsertMcpServerRequest) {
    const { type, url, command, args } = param;

    if (!type) {
      throw new ParamsError('Server type is required');
    }

    if ((type === 'sse' || type === 'streamable') && !url) {
      throw new ParamsError('URL is required for SSE and Streamable server types');
    }

    if (type === 'stdio' && (!command || !args)) {
      throw new ParamsError('Command and args are required for Stdio server type');
    }

    // Additional validation logic can be added here

    return true;
  }
}
