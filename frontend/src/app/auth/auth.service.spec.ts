import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AuthService, User } from './auth.service';

const mario: User = { id: '1', email: 'mario@example.com', username: 'mario' };

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('starts with the session not loaded yet', () => {
    expect(auth.currentUser()).toBeUndefined();
  });

  it('loads the logged-in user from /api/auth/me', async () => {
    const result = firstValueFrom(auth.loadCurrentUser());
    http.expectOne('/api/auth/me').flush(mario);

    expect(await result).toEqual(mario);
    expect(auth.currentUser()).toEqual(mario);
  });

  it('asks /api/auth/me with a 5-second timeout', () => {
    auth.loadCurrentUser().subscribe();
    const request = http.expectOne('/api/auth/me');

    expect(request.request.timeout).toBe(5000);
    request.flush(mario);
  });

  it('treats a 401 from /api/auth/me as a guest', async () => {
    const result = firstValueFrom(auth.loadCurrentUser());
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(await result).toBeNull();
    expect(auth.currentUser()).toBeNull();
  });

  it('treats an unreachable auth-service as a guest', async () => {
    const result = firstValueFrom(auth.loadCurrentUser());
    http.expectOne('/api/auth/me').error(new ProgressEvent('error'));

    expect(await result).toBeNull();
    expect(auth.currentUser()).toBeNull();
  });
});
