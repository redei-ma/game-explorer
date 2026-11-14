import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { AuthService } from './auth.service';

// The cookie can stop working while the app is open (it expired, or the user logged out in
// another tab): every service then answers 401, so the check is here once and not on each call.
export const sessionInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  return next(req).pipe(
    tap({
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          auth.expireSession();
        }
      },
    }),
  );
};
