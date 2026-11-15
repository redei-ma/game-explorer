import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../auth.service';
import { Login } from './login';

describe('Login', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // The submit action awaits a Promise: let it settle before checking the page.
  async function settle(fixture: { whenStable(): Promise<unknown> }) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  async function render() {
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    return { fixture, page: fixture.nativeElement as HTMLElement };
  }

  function type(input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
  }

  async function submitValidForm() {
    const { fixture, page } = await render();
    type(page.querySelector('#login-email')!, 'mario@example.com');
    type(page.querySelector('#login-password')!, 'Secret1!');
    page.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
    return { fixture, page };
  }

  it('links to the registration page', async () => {
    const { page } = await render();

    expect(page.querySelector('a[href="/register"]')?.textContent).toContain('Crea il tuo account');
  });

  it('links to the password recovery page', async () => {
    const { page } = await render();

    expect(page.querySelector('a[href="/recover"]')?.textContent).toContain(
      'Password dimenticata?',
    );
  });

  it('shows no error before the user touches a field', async () => {
    const { page } = await render();

    expect(page.querySelectorAll('.text-danger').length).toBe(0);
  });

  it('shows no error when a field is left before the first submit', async () => {
    const { fixture, page } = await render();

    type(page.querySelector('#login-email')!, 'mario');
    await fixture.whenStable();

    expect(page.querySelectorAll('.text-danger').length).toBe(0);
  });

  it('rejects an email without @ on submit', async () => {
    const { fixture, page } = await render();

    type(page.querySelector('#login-email')!, 'mario');
    page.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();

    http.expectNone('/api/auth/login');
    expect(page.textContent).toContain("L'email non è valida.");
  });

  it('updates the errors while typing after the first submit', async () => {
    const { fixture, page } = await render();

    page.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    type(page.querySelector('#login-email')!, 'mario@example.com');
    await fixture.whenStable();

    expect(page.textContent).not.toContain("Inserisci l'email.");
    expect(page.textContent).toContain('Inserisci la password.');
  });

  it('sends nothing and shows every error when submitted empty', async () => {
    const { fixture, page } = await render();

    page.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();

    http.expectNone('/api/auth/login');
    expect(page.textContent).toContain("Inserisci l'email.");
    expect(page.textContent).toContain('Inserisci la password.');
  });

  it('disables the button while the request is in progress', async () => {
    const { fixture, page } = await submitValidForm();
    const button = page.querySelector<HTMLButtonElement>('button[type="submit"]')!;

    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Accesso in corso…');

    http.expectOne('/api/auth/login').flush({
      expiresAt: '2026-11-07T18:00:00Z',
      user: { id: '1', email: 'mario@example.com', username: 'mario' },
    });
    await settle(fixture);

    expect(button.disabled).toBe(false);
    expect(TestBed.inject(AuthService).currentUser()?.username).toBe('mario');
  });

  it('shows the message for a wrong email or password', async () => {
    const { fixture, page } = await submitValidForm();

    http.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });
    await settle(fixture);

    expect(page.querySelector('.alert-danger')?.textContent).toContain('Email o password errate.');
  });

  it('shows a generic message when the server does not answer', async () => {
    const { fixture, page } = await submitValidForm();

    http.expectOne('/api/auth/login').error(new ProgressEvent('error'));
    await settle(fixture);

    expect(page.querySelector('.alert-danger')?.textContent).toContain(
      'Accesso non riuscito: riprova più tardi.',
    );
  });

  it('shows the message for too many attempts', async () => {
    const { fixture, page } = await submitValidForm();

    http.expectOne('/api/auth/login').flush(null, { status: 429, statusText: 'Too Many Requests' });
    await settle(fixture);

    expect(page.querySelector('.alert-danger')?.textContent).toContain(
      'Troppi tentativi: riprova tra qualche minuto.',
    );
  });

  it('sends again with the same data after the server did not answer', async () => {
    const { fixture, page } = await submitValidForm();
    http.expectOne('/api/auth/login').error(new ProgressEvent('error'));
    await settle(fixture);

    page.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();

    http.expectOne('/api/auth/login').flush({
      expiresAt: '2026-11-07T18:00:00Z',
      user: { id: '1', email: 'mario@example.com', username: 'mario' },
    });
    await settle(fixture);
    expect(TestBed.inject(AuthService).currentUser()?.username).toBe('mario');
  });

  it('goes to the home page after logging in', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const { fixture } = await submitValidForm();

    http.expectOne('/api/auth/login').flush({
      expiresAt: '2026-11-07T18:00:00Z',
      user: { id: '1', email: 'mario@example.com', username: 'mario' },
    });
    await settle(fixture);

    expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
  });

  it('stays on the page when the login fails', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const { fixture } = await submitValidForm();

    http.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });
    await settle(fixture);

    expect(navigate).not.toHaveBeenCalled();
  });
});
