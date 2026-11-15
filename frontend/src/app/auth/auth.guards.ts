import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// Both guards read the session without waiting: the app starts only after /api/auth/me
// (app.config.ts).

export const loggedInGuard: CanActivateFn = () =>
  inject(AuthService).currentUser() ? true : inject(Router).createUrlTree(['/login']);

// A registration made while logged in would replace the current session with the new account.
export const guestGuard: CanActivateFn = () =>
  inject(AuthService).currentUser() ? inject(Router).createUrlTree(['/account']) : true;
