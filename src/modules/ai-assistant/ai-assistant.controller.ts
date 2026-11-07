import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AiAssistantService } from './ai-assistant.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('AI Assistant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai/assistant')
export class AiAssistantController {
  constructor(private readonly aiAssistantService: AiAssistantService) {}

  @Get('context')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get today’s nutrition context card data and active AI Assistant conversation',
  })
  @ApiResponse({ status: 200, description: 'Nutrition context and active conversation returned.' })
  async getAssistantContext(@CurrentUser() user: AuthUser) {
    if (!user?.id) throw new UnauthorizedException('User not authenticated');
    return this.aiAssistantService.getAssistantContext(user.id);
  }

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({
    summary: 'Send a message to NutraAI Nutrition Assistant (Hybrid Direct Context + Tool Calling)',
  })
  @ApiResponse({ status: 200, description: 'AI Assistant reply and updated nutrition snapshot.' })
  async sendChatMessage(
    @CurrentUser() user: AuthUser,
    @Body() dto: SendMessageDto,
  ) {
    if (!user?.id) throw new UnauthorizedException('User not authenticated');
    return this.aiAssistantService.sendChatMessage(user.id, dto);
  }

  @Get('conversations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List past AI Assistant conversations (History drawer)' })
  @ApiResponse({ status: 200, description: 'Conversation history returned.' })
  async listConversations(@CurrentUser() user: AuthUser) {
    if (!user?.id) throw new UnauthorizedException('User not authenticated');
    return this.aiAssistantService.listConversations(user.id);
  }

  @Get('conversations/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Open a past conversation and make it the active session' })
  @ApiResponse({ status: 200, description: 'Conversation messages and nutrition context returned.' })
  @ApiResponse({ status: 404, description: 'Conversation not found.' })
  async openConversation(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    if (!user?.id) throw new UnauthorizedException('User not authenticated');
    return this.aiAssistantService.openConversation(user.id, id);
  }

  @Post('conversations/new')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Start a new AI Assistant conversation session' })
  @ApiResponse({ status: 201, description: 'New conversation session initialized.' })
  async startNewConversation(
    @CurrentUser() user: AuthUser,
    @Body() dto?: CreateConversationDto,
  ) {
    if (!user?.id) throw new UnauthorizedException('User not authenticated');
    return this.aiAssistantService.startNewConversation(user.id, dto);
  }
}

