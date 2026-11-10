import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// The session is already known here: the app starts only after /api/auth/me (app.config.ts).
export const loggedInGuard: CanActivateFn = () =>
  inject(AuthService).currentUser() ? true : inject(Router).createUrlTree(['/login']);
