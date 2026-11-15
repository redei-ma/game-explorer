import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { User } from './auth.models';
import { AuthService } from './auth.service';
import { sessionInterceptor } from './session.interceptor';

const mario: User = { id: '1', email: 'mario@example.com', username: 'mario' };

describe('sessionInterceptor', () => {
  let auth: AuthService;
  let client: HttpClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([sessionInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    auth = TestBed.inject(AuthService);
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function logIn(): Promise<void> {
    const result = firstValueFrom(auth.login('mario@example.com', 'Secret1!'));
    http.expectOne('/api/auth/login').flush({ expiresAt: '2026-11-07T18:00:00Z', user: mario });
    await result;
  }

  function answerFavorites(status: number, statusText: string): void {
    client.get('/api/library/favorites').subscribe({ error: () => {} });
    http.expectOne('/api/library/favorites').flush(null, { status, statusText });
  }

  it('turns a user whose session ended into a guest and says so until the next login', async () => {
    await logIn();

    answerFavorites(401, 'Unauthorized');
    expect(auth.currentUser()).toBeNull();
    expect(auth.sessionExpired()).toBe(true);

    await logIn();
    expect(auth.sessionExpired()).toBe(false);
  });

  it('keeps the user logged in when a service fails for another reason', async () => {
    await logIn();

    answerFavorites(500, 'Internal Server Error');
    expect(auth.currentUser()).toEqual(mario);
  });

  it('does not tell a guest that the session expired', async () => {
    const result = firstValueFrom(auth.loadCurrentUser());
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });
    await result;

    expect(auth.sessionExpired()).toBe(false);
  });
});
