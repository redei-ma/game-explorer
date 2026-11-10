import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { User } from './auth.models';
import { AuthService } from './auth.service';

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

  it('logs in and keeps only the user from the response', async () => {
    const result = firstValueFrom(auth.login('mario@example.com', 'Secret1!'));
    const request = http.expectOne('/api/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'mario@example.com', password: 'Secret1!' });
    request.flush({ expiresAt: '2026-11-07T18:00:00Z', user: mario });

    expect(await result).toEqual(mario);
    expect(auth.currentUser()).toEqual(mario);
  });

  it('passes a failed login on to the caller and leaves the user unchanged', async () => {
    const result = firstValueFrom(auth.login('mario@example.com', 'wrong'));
    http
      .expectOne('/api/auth/login')
      .flush({ detail: 'Invalid email or password.' }, { status: 401, statusText: 'Unauthorized' });

    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(auth.currentUser()).toBeUndefined();
  });

  it('registers and returns the whole response with the recovery code', async () => {
    const result = firstValueFrom(auth.register('mario@example.com', 'mario', 'Secret1!'));
    const request = http.expectOne('/api/auth/register');
    expect(request.request.body).toEqual({
      email: 'mario@example.com',
      username: 'mario',
      password: 'Secret1!',
    });
    request.flush({ expiresAt: '2026-11-07T18:00:00Z', user: mario, recoveryCode: 'ABCD-1234' });

    expect((await result).recoveryCode).toBe('ABCD-1234');
    expect(auth.currentUser()).toEqual(mario);
  });

  it('recovers the password and returns only the new code, staying a guest', async () => {
    auth.loadCurrentUser().subscribe();
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    const result = firstValueFrom(auth.recover('mario@example.com', 'old-code', 'NewSecret1!'));
    const request = http.expectOne('/api/auth/recover');
    expect(request.request.body).toEqual({
      email: 'mario@example.com',
      code: 'old-code',
      newPassword: 'NewSecret1!',
    });
    request.flush({ recoveryCode: 'new-code' });

    expect(await result).toBe('new-code');
    expect(auth.currentUser()).toBeNull();
  });

  it('deletes the account with the password and keeps the session for the next calls', async () => {
    const result = firstValueFrom(auth.login('mario@example.com', 'Secret1!'));
    http.expectOne('/api/auth/login').flush({ expiresAt: '2026-11-07T18:00:00Z', user: mario });
    await result;

    const deletion = firstValueFrom(auth.deleteAccount('Secret1!'));
    const request = http.expectOne('/api/auth/me');
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toEqual({ password: 'Secret1!' });
    request.flush(null, { status: 204, statusText: 'No Content' });

    await deletion;
    expect(auth.currentUser()).toEqual(mario);
  });

  it('logs out and becomes a guest once the server answers', async () => {
    const result = firstValueFrom(auth.login('mario@example.com', 'Secret1!'));
    http.expectOne('/api/auth/login').flush({ expiresAt: '2026-11-07T18:00:00Z', user: mario });
    await result;

    const logout = firstValueFrom(auth.logout());
    const request = http.expectOne('/api/auth/logout');
    expect(auth.currentUser()).toEqual(mario);
    request.flush(null, { status: 204, statusText: 'No Content' });

    await logout;
    expect(auth.currentUser()).toBeNull();
  });

  it('stays logged in when the logout fails', async () => {
    const result = firstValueFrom(auth.login('mario@example.com', 'Secret1!'));
    http.expectOne('/api/auth/login').flush({ expiresAt: '2026-11-07T18:00:00Z', user: mario });
    await result;

    const logout = firstValueFrom(auth.logout());
    http.expectOne('/api/auth/logout').error(new ProgressEvent('error'));

    await expect(logout).rejects.toMatchObject({ status: 0 });
    expect(auth.currentUser()).toEqual(mario);
  });
});
