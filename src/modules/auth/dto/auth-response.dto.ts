import { ApiProperty } from '@nestjs/swagger';

export class AuthTokensDto {
  @ApiProperty({ description: 'Short-lived JWT access token (7d)' })
  accessToken: string;

  @ApiProperty({ description: 'Long-lived refresh token (30d)' })
  refreshToken: string;
}

export class AuthResponseDto {
  @ApiProperty()
  tokens: AuthTokensDto;

  @ApiProperty({ description: 'Whether this is a newly created account' })
  isNewUser: boolean;

  @ApiProperty({
    description: 'Basic user information',
    example: {
      id: 'uuid-string',
      email: 'user@example.com',
      name: 'Alex Johnson',
      role: 'USER',
    },
  })
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
}
