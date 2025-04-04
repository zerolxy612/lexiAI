import { Body, Controller, Get, Post, Put, Delete, UseGuards, Query, Param, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PagesService } from './pages.service';
import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';
import { LoginedUser } from '@/utils/decorators/user.decorator';
import { User } from '@refly-packages/openapi-schema';
import { buildSuccessResponse } from '@/utils';
import { CreatePageDto, UpdatePageDto, PageVersionParamDto, pagePO2DTO, pageNodeRelationPO2DTO, pageVersionPO2DTO, PublishPageResult, PageVersionResult, PageVersionsResult, SharePageResult, DeletePageResult, CreatePageResult, PageDetailResult, UpdatePageResult } from './pages.dto';

@ApiTags('Pages')
@Controller('v1/pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @ApiOperation({ summary: '获取用户所有页面' })
  @ApiResponse({ status: 200, description: '成功' })
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
      pages: result.pages.map(page => pagePO2DTO(page)),
    });
  }

  @ApiOperation({ summary: '创建页面' })
  @ApiResponse({ status: 201, description: '创建成功' })
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

  @ApiOperation({ summary: '获取页面详情' })
  @ApiResponse({ status: 200, description: '成功' })
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

  @ApiOperation({ summary: '更新页面' })
  @ApiResponse({ status: 200, description: '更新成功' })
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

  @ApiOperation({ summary: '发布页面' })
  @ApiResponse({ status: 200, description: '发布成功' })
  @UseGuards(JwtAuthGuard)
  @Post(':pageId/publish')
  async publishPage(@LoginedUser() user: User, @Param('pageId') pageId: string) {
    const result = await this.pagesService.publishPage(user, pageId);
    
    return buildSuccessResponse({
      ...pagePO2DTO(result.page),
      version: pageVersionPO2DTO(result.version),
    });
  }

  @ApiOperation({ summary: '获取页面版本内容' })
  @ApiResponse({ status: 200, description: '成功' })
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

  @ApiOperation({ summary: '获取页面所有版本' })
  @ApiResponse({ status: 200, description: '成功' })
  @UseGuards(JwtAuthGuard)
  @Get(':pageId/versions')
  async getPageVersions(@Param('pageId') pageId: string) {
    const result = await this.pagesService.getPageVersions(pageId);
    
    return buildSuccessResponse({
      ...pagePO2DTO(result.page),
      versions: result.versions.map(pageVersionPO2DTO),
    });
  }

  @ApiOperation({ summary: '分享页面' })
  @ApiResponse({ status: 200, description: '分享成功' })
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

  @ApiOperation({ summary: '删除页面' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @UseGuards(JwtAuthGuard)
  @Delete(':pageId')
  async deletePage(@LoginedUser() user: User, @Param('pageId') pageId: string) {
    const result = await this.pagesService.deletePage(user, pageId);
    
    return buildSuccessResponse({
      pageId: result.pageId,
    });
  }
} 