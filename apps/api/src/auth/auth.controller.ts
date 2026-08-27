import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from './decorators/current-user.decorator';

const REFRESH_COOKIE = 'jc_refresh';
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/api/v1/auth',
};

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { refreshToken, ...rest } = await this.authService.register(dto);
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
    return rest;
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { refreshToken, ...rest } = await this.authService.login(dto);
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
    return rest;
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];
    const { refreshToken, ...rest } = await this.authService.refresh(token);
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
    return rest;
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(REFRESH_COOKIE, cookieOptions);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: JwtUser) {
    return this.authService.me(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/profile')
  async updateProfile(@CurrentUser() user: JwtUser, @Body() body: any) {
    return this.authService.updateSeekerProfile(user.sub, body);
  }
}
