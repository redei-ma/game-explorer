import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { loggedInGuard } from './auth.guards';
import { AuthService } from './auth.service';

describe('loggedInGuard', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  // The guard reads the session that /api/auth/me loaded at startup.
  function startSession(me: object | null) {
    TestBed.inject(AuthService).loadCurrentUser().subscribe();
    const request = http.expectOne('/api/auth/me');
    if (me) {
      request.flush(me);
    } else {
      request.flush(null, { status: 401, statusText: 'Unauthorized' });
    }
  }

  function runGuard() {
    return TestBed.runInInjectionContext(() =>
      loggedInGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  it('lets a logged-in user in', () => {
    startSession({ id: '1', email: 'mario@example.com', username: 'mario' });

    expect(runGuard()).toBe(true);
  });

  it('sends a guest to the login page', () => {
    startSession(null);

    const result = runGuard();

    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toBe('/login');
  });
});
