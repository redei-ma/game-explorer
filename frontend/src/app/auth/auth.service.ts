import { HttpClient } from '@angular/common/http';
import { Service, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { AuthResponse, RecoverResponse, RegisterResponse, User } from './auth.models';

@Service()
export class AuthService {
  private readonly http = inject(HttpClient);

  // undefined: the server has not said yet who is logged in; null: guest.
  private readonly _currentUser = signal<User | null | undefined>(undefined);

  readonly currentUser = this._currentUser.asReadonly();

  // true when the server ended a session the app still showed as open (expired cookie, logout
  // in another tab): the page says why the user is a guest again.
  private readonly _sessionExpired = signal(false);

  readonly sessionExpired = this._sessionExpired.asReadonly();

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

  // Called on a 401. A guest gets 401 too (from /api/auth/me at startup, from a wrong login):
  // only a user who was logged in has lost a session.
  expireSession(): void {
    if (!this._currentUser()) {
      return;
    }
    this._currentUser.set(null);
    this._sessionExpired.set(true);
  }

  // Another tab may have logged in or out, or the cookie may have expired while this tab was
  // hidden. A 401 is handled by the session interceptor; any other error keeps the current state,
  // so a network problem does not log the user out.
  recheckCurrentUser(): void {
    this.http.get<User>('/api/auth/me').subscribe({
      next: (user) => {
        // A new object for the same user would make the favorites load again.
        if (user.id !== this._currentUser()?.id) {
          this.startSession(user);
        }
      },
      error: () => {},
    });
  }

  dismissSessionExpired(): void {
    this._sessionExpired.set(false);
  }

  // No catchError: on a 401 the error must reach the login page, which shows the message.
  login(email: string, password: string): Observable<User> {
    return this.http.post<AuthResponse>('/api/auth/login', { email, password }).pipe(
      map((response) => response.user),
      tap((user) => this.startSession(user)),
    );
  }

  // The server logs the new user in. The recovery code is in this response only, so the
  // whole response goes to the caller, which shows the code once.
  register(email: string, username: string, password: string): Observable<RegisterResponse> {
    return this.http
      .post<RegisterResponse>('/api/auth/register', { email, username, password })
      .pipe(tap((response) => this.startSession(response.user)));
  }

  // Sets a new password with the recovery code and returns the new code, since the old one stops
  // working. No login: the user then logs in as usual (OWASP Forgot Password Cheat Sheet).
  recover(email: string, code: string, newPassword: string): Observable<string> {
    return this.http
      .post<RecoverResponse>('/api/auth/recover', { email, code, newPassword })
      .pipe(map((response) => response.recoveryCode));
  }

  // The session stays: the caller still needs it to delete the user's favorites, then logs out.
  deleteAccount(password: string): Observable<void> {
    return this.http.delete<void>('/api/auth/me', { body: { password } });
  }

  // Only the server can delete the HttpOnly cookie: until it answers, the session still exists.
  logout(): Observable<void> {
    return this.http
      .post<void>('/api/auth/logout', {})
      .pipe(tap(() => this._currentUser.set(null)));
  }

  private startSession(user: User): void {
    this._currentUser.set(user);
    this._sessionExpired.set(false);
  }
}
