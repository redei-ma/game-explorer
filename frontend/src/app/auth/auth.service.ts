import { HttpClient } from '@angular/common/http';
import { Service, inject, signal } from '@angular/core';
import { Observable, catchError, of, tap } from 'rxjs';

export interface User {
  id: string;
  email: string;
  username: string;
}

@Service()
export class AuthService {
  private readonly http = inject(HttpClient);

  // undefined: the server has not said yet who is logged in; null: guest.
  private readonly _currentUser = signal<User | null | undefined>(undefined);

  readonly currentUser = this._currentUser.asReadonly();

  // The token is in an HttpOnly cookie that JavaScript cannot read, so only the
  // server knows who is logged in.
  loadCurrentUser(): Observable<User | null> {
    // The app does not start until this call ends (app.config.ts), so a server that never
    // answers must not block it.
    return this.http.get<User>('/api/auth/me', { timeout: 5000 }).pipe(
      // 401 for a guest, auth-service down or too slow: either way nobody is logged in.
      catchError(() => of(null)),
      tap((user) => this._currentUser.set(user)),
    );
  }
}
