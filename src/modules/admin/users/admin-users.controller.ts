import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../common/admin-only.decorator';
import { AdminUsersService } from './admin-users.service';
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
}
