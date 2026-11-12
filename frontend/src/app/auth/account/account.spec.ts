import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../auth.service';
import { Account } from './account';

describe('Account', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // The logout action awaits a Promise: let it settle before checking the page.
  async function settle(fixture: { whenStable(): Promise<unknown> }) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  // The page is reached only through loggedInGuard, so a user is always loaded.
  async function renderLoggedIn() {
    TestBed.inject(AuthService).loadCurrentUser().subscribe();
    http
      .expectOne('/api/auth/me')
      .flush({ id: '1', email: 'mario@example.com', username: 'mario' });
    const fixture = TestBed.createComponent(Account);
    // FavoritesService loads the account's favorites from an effect, which runs after creation.
    await fixture.whenStable();
    http.expectOne({ method: 'GET', url: '/api/library/favorites' }).flush([]);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    return { fixture, page, button: page.querySelector<HTMLButtonElement>('button')! };
  }

  it('shows the email and the username', async () => {
    const { page } = await renderLoggedIn();

    expect(page.textContent).toContain('mario@example.com');
    expect(page.textContent).toContain('mario');
  });

  it('links to the favorites', async () => {
    const { page } = await renderLoggedIn();

    expect(page.querySelector('a[href="/favorites"]')).not.toBeNull();
  });

  it('logs out, disabling the button meanwhile, then goes to the home page', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const { fixture, button } = await renderLoggedIn();

    button.click();
    await fixture.whenStable();

    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Uscita in corso…');
    http.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    await settle(fixture);

    expect(TestBed.inject(AuthService).currentUser()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
  });

  it('shows an error and stays when the logout fails', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const { fixture, page, button } = await renderLoggedIn();

    button.click();
    await fixture.whenStable();
    http.expectOne('/api/auth/logout').error(new ProgressEvent('error'));
    await settle(fixture);

    expect(page.querySelector('.alert-danger')?.textContent).toContain(
      'Uscita non riuscita: riprova.',
    );
    expect(button.disabled).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  async function submitDeletion(password = 'Secret1!') {
    const rendered = await renderLoggedIn();
    const input = rendered.page.querySelector<HTMLInputElement>('#delete-password')!;
    input.value = password;
    input.dispatchEvent(new Event('input'));
    deleteButton(rendered.page).click();
    await rendered.fixture.whenStable();
    return rendered;
  }

  function deleteButton(page: HTMLElement) {
    return page.querySelector<HTMLButtonElement>('form button[type="submit"]')!;
  }

  function expectAccountDeletion() {
    const request = http.expectOne({ method: 'DELETE', url: '/api/auth/me' });
    expect(request.request.body).toEqual({ password: 'Secret1!' });
    return request;
  }

  it('asks for the password before deleting the account', async () => {
    const { fixture, page } = await renderLoggedIn();

    deleteButton(page).click();
    await fixture.whenStable();

    http.expectNone({ method: 'DELETE', url: '/api/auth/me' });
    expect(page.textContent).toContain('Inserisci la password per confermare.');
  });

  it('deletes the account, then the favorites, then logs out and goes home', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const { fixture } = await submitDeletion();

    expectAccountDeletion().flush(null, { status: 204, statusText: 'No Content' });
    await settle(fixture);
    http
      .expectOne({ method: 'DELETE', url: '/api/library/favorites' })
      .flush(null, { status: 204, statusText: 'No Content' });
    await settle(fixture);
    http.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    await settle(fixture);

    expect(TestBed.inject(AuthService).currentUser()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
  });

  it('shows a wrong password under the field and deletes nothing', async () => {
    const { fixture, page } = await submitDeletion();

    expectAccountDeletion().flush(null, { status: 403, statusText: 'Forbidden' });
    await settle(fixture);

    http.expectNone({ method: 'DELETE', url: '/api/library/favorites' });
    const field = page.querySelector('#delete-password')!.closest('.mb-3')!;
    expect(field.textContent).toContain('Password errata.');
  });

  it('logs out and goes home even when the favorites cannot be deleted', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const { fixture, page } = await submitDeletion();

    expectAccountDeletion().flush(null, { status: 204, statusText: 'No Content' });
    await settle(fixture);
    http
      .expectOne({ method: 'DELETE', url: '/api/library/favorites' })
      .error(new ProgressEvent('error'));
    await settle(fixture);
    http.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    await settle(fixture);

    expect(page.querySelector('form .alert-danger')).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
  });

  it('shows the message for too many attempts and deletes nothing', async () => {
    const { fixture, page } = await submitDeletion();

    expectAccountDeletion().flush(null, { status: 429, statusText: 'Too Many Requests' });
    await settle(fixture);

    expect(page.querySelector('form .alert-danger')?.textContent).toContain(
      'Troppi tentativi sbagliati: riprova tra qualche minuto.',
    );
    http.expectNone({ method: 'DELETE', url: '/api/library/favorites' });
  });

  it('shows a generic message when the account cannot be deleted', async () => {
    const { fixture, page } = await submitDeletion();

    expectAccountDeletion().error(new ProgressEvent('error'));
    await settle(fixture);

    expect(page.querySelector('form .alert-danger')?.textContent).toContain(
      'Eliminazione non riuscita: riprova più tardi.',
    );
  });
});
