import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../common/admin-only.decorator';
import { AdminUsersService } from './admin-users.service';
import { GrantProDto } from './dto/grant-pro.dto';
import { QueryAdminUsersDto } from './dto/query-admin-users.dto';

@ApiTags('Admin - Users')
@AdminOnly()
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly usersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users (search by email/name, filter by role and FREE/PRO plan)' })
  @ApiOkResponse({ description: 'Paginated user list' })
  listUsers(@Query() query: QueryAdminUsersDto) {
    return this.usersService.listUsers(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'User detail with health profile (BMR, TDEE, weight) and nutrition target' })
  @ApiOkResponse({ description: 'User detail' })
  @ApiNotFoundResponse({ description: 'User not found' })
  getUserDetail(@Param('id') id: string) {
    return this.usersService.getUserDetail(id);
  }

  @Post(':id/grant-pro')
  @ApiOperation({ summary: 'Manually upgrade or extend a user to Pro subscription' })
  @ApiOkResponse({ description: 'Updated user detail with active Pro subscription' })
  @ApiNotFoundResponse({ description: 'User or active Pro plan not found' })
  grantPro(@Param('id') id: string, @Body() dto: GrantProDto) {
    return this.usersService.grantPro(id, dto);
  }

  @Post(':id/revoke-pro')
  @ApiOperation({ summary: 'Revoke active Pro subscription(s) for a user' })
  @ApiOkResponse({ description: 'Updated user detail with FREE plan' })
  @ApiNotFoundResponse({ description: 'User not found' })
  revokePro(@Param('id') id: string) {
    return this.usersService.revokePro(id);
  }
}
