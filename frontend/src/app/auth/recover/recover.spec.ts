import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Recover } from './recover';

const newCode = '7c1e9a24f05b3d68e2a91c4f0b7d5e36';

describe('Recover', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function render() {
    const fixture = TestBed.createComponent(Recover);
    await fixture.whenStable();
    return { fixture, page: fixture.nativeElement as HTMLElement };
  }

  function type(input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
  }

  function submit(page: HTMLElement) {
    page.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
  }

  // The submit action awaits a Promise: let it settle before checking the page.
  async function settle(fixture: { whenStable(): Promise<unknown> }) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  async function submitValidForm(code = 'old-code') {
    const { fixture, page } = await render();
    type(page.querySelector('#recover-email')!, 'mario@example.com');
    type(page.querySelector('#recover-code')!, code);
    type(page.querySelector('#recover-password')!, 'NewSecret1!');
    type(page.querySelector('#recover-confirm-password')!, 'NewSecret1!');
    submit(page);
    await fixture.whenStable();
    return { fixture, page };
  }

  // The errors shown under one input, inside its .mb-3 block.
  function fieldText(page: HTMLElement, id: string) {
    return page.querySelector(`#${id}`)!.closest('.mb-3')!.textContent;
  }

  it('links back to the login page', async () => {
    const { page } = await render();

    expect(page.querySelector('a[href="/login"]')?.textContent).toContain("Torna all'accesso");
  });

  it('sends nothing and shows every error when submitted empty', async () => {
    const { fixture, page } = await render();

    submit(page);
    await fixture.whenStable();

    http.expectNone('/api/auth/recover');
    expect(page.textContent).toContain("Inserisci l'email.");
    expect(page.textContent).toContain('Inserisci il codice di recupero.');
    expect(page.textContent).toContain('Inserisci la nuova password.');
  });

  it('shows an error on submit when the two passwords differ', async () => {
    const { fixture, page } = await render();

    type(page.querySelector('#recover-password')!, 'NewSecret1!');
    type(page.querySelector('#recover-confirm-password')!, 'NewSecret2!');
    submit(page);
    await fixture.whenStable();

    expect(page.textContent).toContain('Le password non coincidono.');
  });

  it('sends the code without spaces and disables the button meanwhile', async () => {
    const { page } = await submitValidForm('  old-code ');
    const button = page.querySelector<HTMLButtonElement>('button[type="submit"]')!;

    const request = http.expectOne('/api/auth/recover');
    expect(request.request.body).toEqual({
      email: 'mario@example.com',
      code: 'old-code',
      newPassword: 'NewSecret1!',
    });
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Cambio in corso…');
    request.flush({ recoveryCode: newCode });
  });

  it('shows the new code instead of the form and stays on the page', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const { fixture, page } = await submitValidForm();

    http.expectOne('/api/auth/recover').flush({ recoveryCode: newCode });
    await settle(fixture);

    expect(page.textContent).toContain(newCode);
    expect(page.querySelector('form')).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('goes to the login page once the user has saved the code', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const { fixture, page } = await submitValidForm();
    http.expectOne('/api/auth/recover').flush({ recoveryCode: newCode });
    await settle(fixture);

    page.querySelector<HTMLButtonElement>('button')!.click();

    expect(navigate).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });

  it('shows one message for a wrong email or code', async () => {
    const { fixture, page } = await submitValidForm();

    http.expectOne('/api/auth/recover').flush(null, { status: 401, statusText: 'Unauthorized' });
    await settle(fixture);

    expect(page.querySelector('.alert-danger')?.textContent).toContain(
      'Email o codice di recupero errati.',
    );
  });

  it('shows the failed password rules under the new password', async () => {
    const { fixture, page } = await submitValidForm();

    http.expectOne('/api/auth/recover').flush(
      {
        status: 400,
        errors: { PasswordRequiresDigit: ["Passwords must have at least one digit ('0'-'9')."] },
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await settle(fixture);

    expect(fieldText(page, 'recover-password')).toContain('La password deve avere un numero.');
  });

  it('shows the message for too many attempts', async () => {
    const { fixture, page } = await submitValidForm();

    http
      .expectOne('/api/auth/recover')
      .flush(null, { status: 429, statusText: 'Too Many Requests' });
    await settle(fixture);

    expect(page.querySelector('.alert-danger')?.textContent).toContain(
      'Troppi tentativi: riprova tra un minuto.',
    );
  });

  it('shows a generic message when the server does not answer', async () => {
    const { fixture, page } = await submitValidForm();

    http.expectOne('/api/auth/recover').error(new ProgressEvent('error'));
    await settle(fixture);

    expect(page.querySelector('.alert-danger')?.textContent).toContain(
      'Recupero non riuscito: riprova più tardi.',
    );
  });
});
