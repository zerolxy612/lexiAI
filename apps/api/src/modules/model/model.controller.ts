import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ModelService } from './model.service';
import { JwtAuthGuard } from '@/modules/auth/guard/jwt-auth.guard';
import { LoginedUser } from '@/utils/decorators/user.decorator';
import { User as UserModel } from '@/generated/client';
import {
  DeleteModelItemRequest,
  DeleteModelItemResponse,
  DeleteModelProviderRequest,
  DeleteModelProviderResponse,
  ListModelItemsResponse,
  ListModelProvidersResponse,
  ModelType,
  UpsertModelItemRequest,
  UpsertModelItemResponse,
  UpsertModelProviderRequest,
  UpsertModelProviderResponse,
} from '@refly/openapi-schema';
import { buildSuccessResponse } from '@/utils/response';
import { modelItemPO2DTO, modelProviderPO2DTO } from './model.dto';

@Controller('v1/model')
export class ModelController {
  constructor(private readonly modelService: ModelService) {}

  @UseGuards(JwtAuthGuard)
  @Get('/provider/list')
  async listModelProviders(
    @LoginedUser() user: UserModel,
    @Query('enabled') enabled: boolean,
    @Query('providerKey') providerKey: string,
  ): Promise<ListModelProvidersResponse> {
    const providers = await this.modelService.listModelProviders(user, { enabled, providerKey });
    return buildSuccessResponse(providers.map(modelProviderPO2DTO));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/provider/create')
  async createModelProvider(
    @LoginedUser() user: UserModel,
    @Body() body: UpsertModelProviderRequest,
  ): Promise<UpsertModelProviderResponse> {
    const provider = await this.modelService.createModelProvider(user, body);
    return buildSuccessResponse(modelProviderPO2DTO(provider));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/provider/update')
  async updateModelProvider(
    @LoginedUser() user: UserModel,
    @Body() body: UpsertModelProviderRequest,
  ): Promise<UpsertModelProviderResponse> {
    const provider = await this.modelService.updateModelProvider(user, body);
    return buildSuccessResponse(modelProviderPO2DTO(provider));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/provider/delete')
  async deleteModelProvider(
    @LoginedUser() user: UserModel,
    @Body() body: DeleteModelProviderRequest,
  ): Promise<DeleteModelProviderResponse> {
    await this.modelService.deleteModelProvider(user, body);
    return buildSuccessResponse();
  }

  @UseGuards(JwtAuthGuard)
  @Get('/item/list')
  async listModelItems(
    @LoginedUser() user: UserModel,
    @Query('providerId') providerId: string,
    @Query('modelType') modelType: ModelType,
    @Query('enabled') enabled: boolean,
  ): Promise<ListModelItemsResponse> {
    const items = await this.modelService.listModelItems(user, { providerId, modelType, enabled });
    return buildSuccessResponse(items.map(modelItemPO2DTO));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/item/create')
  async createModelItem(
    @LoginedUser() user: UserModel,
    @Body() body: UpsertModelItemRequest,
  ): Promise<UpsertModelItemResponse> {
    const item = await this.modelService.createModelItem(user, body);
    return buildSuccessResponse(modelItemPO2DTO(item));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/item/update')
  async updateModelItem(
    @LoginedUser() user: UserModel,
    @Body() body: UpsertModelItemRequest,
  ): Promise<UpsertModelItemResponse> {
    const item = await this.modelService.updateModelItem(user, body);
    return buildSuccessResponse(modelItemPO2DTO(item));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/item/delete')
  async deleteModelItem(
    @LoginedUser() user: UserModel,
    @Body() body: DeleteModelItemRequest,
  ): Promise<DeleteModelItemResponse> {
    await this.modelService.deleteModelItem(user, body);
    return buildSuccessResponse();
  }
}
