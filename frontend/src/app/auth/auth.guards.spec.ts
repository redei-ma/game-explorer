import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { guestGuard, loggedInGuard } from './auth.guards';
import { AuthService } from './auth.service';

describe('auth guards', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  // The guards read the session that /api/auth/me loaded at startup.
  function startSession(me: object | null) {
    TestBed.inject(AuthService).loadCurrentUser().subscribe();
    const request = http.expectOne('/api/auth/me');
    if (me) {
      request.flush(me);
    } else {
      request.flush(null, { status: 401, statusText: 'Unauthorized' });
    }
  }

  function runGuard(guard: CanActivateFn) {
    return TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  const mario = { id: '1', email: 'mario@example.com', username: 'mario' };

  it('loggedInGuard lets a logged-in user in', () => {
    startSession(mario);

    expect(runGuard(loggedInGuard)).toBe(true);
  });

  it('loggedInGuard sends a guest to the login page', () => {
    startSession(null);

    const result = runGuard(loggedInGuard);

    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toBe('/login');
  });

  it('guestGuard lets a guest in', () => {
    startSession(null);

    expect(runGuard(guestGuard)).toBe(true);
  });

  it('guestGuard sends a logged-in user to the account page', () => {
    startSession(mario);

    const result = runGuard(guestGuard);

    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toBe('/account');
  });
});
