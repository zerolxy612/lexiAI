import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  UseGuards,
  Query,
  Param,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { PagesService } from './pages.service';
import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';
import { LoginedUser } from '@/utils/decorators/user.decorator';
import { User } from '@refly-packages/openapi-schema';
import { buildSuccessResponse } from '@/utils';
import {
  CreatePageDto,
  UpdatePageDto,
  PageVersionParamDto,
  pagePO2DTO,
  pageNodeRelationPO2DTO,
  pageVersionPO2DTO,
} from './pages.dto';

@ApiTags('Pages')
@Controller('v1/pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @ApiOperation({ summary: 'Get all user pages' })
  @ApiResponse({ status: 200, description: 'Get all user pages successfully' })
  @UseGuards(JwtAuthGuard)
  @Get()
  async listPages(
    @LoginedUser() user: User,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    const result = await this.pagesService.listPages(user, page, pageSize);
    return buildSuccessResponse({
      ...result,
      pages: result.pages.map((page) => pagePO2DTO(page)),
    });
  }

  @ApiOperation({ summary: 'Create page' })
  @ApiResponse({ status: 201, description: 'Page created successfully' })
  @UseGuards(JwtAuthGuard)
  @Post()
  async createPage(@LoginedUser() user: User, @Body() createPageDto: CreatePageDto) {
    const result = await this.pagesService.createPage(user, createPageDto);

    return buildSuccessResponse({
      ...pagePO2DTO(result.page),
      nodeRelations: Array.isArray(result.nodeRelations)
        ? result.nodeRelations.map(pageNodeRelationPO2DTO)
        : [],
    });
  }

  @ApiOperation({ summary: 'Get page details' })
  @ApiResponse({ status: 200, description: 'Get page details successfully' })
  @UseGuards(JwtAuthGuard)
  @Get(':pageId')
  async getPageDetail(@LoginedUser() user: User, @Param('pageId') pageId: string) {
    const result = await this.pagesService.getPageDetail(user, pageId);

    return buildSuccessResponse({
      ...pagePO2DTO(result.page),
      nodeRelations: Array.isArray(result.nodeRelations)
        ? result.nodeRelations.map(pageNodeRelationPO2DTO)
        : [],
      pageConfig: result.pageConfig,
    });
  }

  @ApiOperation({ summary: 'Update page' })
  @ApiResponse({ status: 200, description: 'Page updated successfully' })
  @UseGuards(JwtAuthGuard)
  @Patch(':pageId')
  async updatePage(
    @LoginedUser() user: User,
    @Param('pageId') pageId: string,
    @Body() updatePageDto: UpdatePageDto,
  ) {
    const result = await this.pagesService.updatePage(user, pageId, updatePageDto);

    return buildSuccessResponse({
      ...pagePO2DTO(result.page),
      nodeRelations: result.nodeRelations
        ? result.nodeRelations.map(pageNodeRelationPO2DTO)
        : undefined,
    });
  }

  @ApiOperation({ summary: 'Update page (PUT)' })
  @ApiResponse({ status: 200, description: 'Page updated successfully' })
  @UseGuards(JwtAuthGuard)
  @Put(':pageId')
  async updatePagePut(
    @LoginedUser() user: User,
    @Param('pageId') pageId: string,
    @Body() updatePageDto: UpdatePageDto,
  ) {
    const result = await this.pagesService.updatePage(user, pageId, updatePageDto);

    return buildSuccessResponse({
      ...pagePO2DTO(result.page),
      nodeRelations: result.nodeRelations
        ? result.nodeRelations.map(pageNodeRelationPO2DTO)
        : undefined,
    });
  }

  @ApiOperation({ summary: 'Publish page' })
  @ApiResponse({ status: 200, description: 'Page published successfully' })
  @UseGuards(JwtAuthGuard)
  @Post(':pageId/publish')
  async publishPage(@LoginedUser() user: User, @Param('pageId') pageId: string) {
    const result = await this.pagesService.publishPage(user, pageId);

    return buildSuccessResponse({
      ...pagePO2DTO(result.page),
      version: pageVersionPO2DTO(result.version),
    });
  }

  @ApiOperation({ summary: 'Get page version content' })
  @ApiResponse({ status: 200, description: 'Get page version content successfully' })
  @UseGuards(JwtAuthGuard)
  @Get(':pageId/version')
  async getPageVersion(@Param() params: PageVersionParamDto) {
    const result = await this.pagesService.getPageVersion(params.pageId, params.version);

    return buildSuccessResponse({
      ...pagePO2DTO(result.page),
      version: pageVersionPO2DTO(result.version),
      content: result.content,
    });
  }

  @ApiOperation({ summary: 'Get all page versions' })
  @ApiResponse({ status: 200, description: 'Get all page versions successfully' })
  @UseGuards(JwtAuthGuard)
  @Get(':pageId/versions')
  async getPageVersions(@Param('pageId') pageId: string) {
    const result = await this.pagesService.getPageVersions(pageId);

    return buildSuccessResponse({
      ...pagePO2DTO(result.page),
      versions: result.versions.map(pageVersionPO2DTO),
    });
  }

  @ApiOperation({ summary: 'Share page' })
  @ApiResponse({ status: 200, description: 'Page shared successfully' })
  @UseGuards(JwtAuthGuard)
  @Post(':pageId/share')
  async sharePage(@LoginedUser() user: User, @Param('pageId') pageId: string) {
    const result = await this.pagesService.sharePage(user, pageId);

    return buildSuccessResponse({
      pageId: result.pageId,
      shareId: result.shareId,
      shareUrl: result.shareUrl,
    });
  }

  @ApiOperation({ summary: 'Get shared page content' })
  @ApiResponse({ status: 200, description: 'Get shared page content successfully' })
  @ApiParam({ name: 'shareId', description: 'Share ID' })
  @Get('share/:shareId')
  async getSharedPage(@Param('shareId') shareId: string, @LoginedUser() user?: User) {
    // Use unified share service to handle
    const result = await this.pagesService.getSharedPage(shareId, user);

    return buildSuccessResponse(result);
  }

  @ApiOperation({ summary: 'Delete page' })
  @ApiResponse({ status: 200, description: 'Page deleted successfully' })
  @UseGuards(JwtAuthGuard)
  @Delete(':pageId')
  async deletePage(@LoginedUser() user: User, @Param('pageId') pageId: string) {
    const result = await this.pagesService.deletePage(user, pageId);

    return buildSuccessResponse({
      pageId: result.pageId,
    });
  }

  @ApiOperation({ summary: 'Delete page node' })
  @ApiResponse({ status: 200, description: 'Page node deleted successfully' })
  @UseGuards(JwtAuthGuard)
  @Delete(':pageId/nodes/:nodeId')
  async deletePageNode(
    @LoginedUser() user: User,
    @Param('pageId') pageId: string,
    @Param('nodeId') nodeId: string,
  ) {
    const result = await this.pagesService.deletePageNode(user, pageId, nodeId);

    return buildSuccessResponse({
      pageId: result.pageId,
      nodeId: result.nodeId,
    });
  }

  @ApiOperation({ summary: 'Delete page share' })
  @ApiResponse({ status: 200, description: 'Page share deleted successfully' })
  @UseGuards(JwtAuthGuard)
  @Delete(':pageId/share')
  async deletePageShare(@LoginedUser() user: User, @Param('pageId') pageId: string) {
    // Find all share records related to pageId
    const shareRecords = await this.pagesService.listSharesByEntityId(user, pageId);

    // Use ShareService to delete shares
    for (const record of shareRecords) {
      await this.pagesService.deleteShareById(user, record.shareId);
    }

    return buildSuccessResponse({
      pageId,
      deleted: shareRecords.length > 0,
    });
  }
}
