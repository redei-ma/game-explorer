import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Register } from './register';

const registered = {
  expiresAt: '2026-11-10T18:00:00Z',
  user: { id: '1', email: 'mario@example.com', username: 'mario' },
  recoveryCode: '3f9a1c0be47d52a86e1f0c9b7d24a6e5',
};

describe('Register', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function render() {
    const fixture = TestBed.createComponent(Register);
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

  async function submitValidForm() {
    const { fixture, page } = await render();
    type(page.querySelector('#register-email')!, 'mario@example.com');
    type(page.querySelector('#register-username')!, 'mario');
    type(page.querySelector('#register-password')!, 'Secret1!');
    type(page.querySelector('#register-confirm-password')!, 'Secret1!');
    submit(page);
    await fixture.whenStable();
    return { fixture, page };
  }

  // The errors shown under one input, inside its .mb-3 block.
  function fieldText(page: HTMLElement, id: string) {
    return page.querySelector(`#${id}`)!.closest('.mb-3')!.textContent;
  }

  function validationProblem(errors: Record<string, string[]>) {
    return { title: 'One or more validation errors occurred.', status: 400, errors };
  }

  it('shows no error before the user touches a field', async () => {
    const { page } = await render();

    expect(page.querySelectorAll('.text-danger').length).toBe(0);
  });

  it('sends nothing and shows every error when submitted empty', async () => {
    const { fixture, page } = await render();

    submit(page);
    await fixture.whenStable();

    http.expectNone('/api/auth/register');
    expect(page.textContent).toContain("Inserisci l'email.");
    expect(page.textContent).toContain('Inserisci uno username.');
    expect(page.textContent).toContain('Inserisci una password.');
  });

  it('sends the data without the confirmation and disables the button meanwhile', async () => {
    const { page } = await submitValidForm();
    const button = page.querySelector<HTMLButtonElement>('button[type="submit"]')!;

    const request = http.expectOne('/api/auth/register');
    expect(request.request.body).toEqual({
      email: 'mario@example.com',
      username: 'mario',
      password: 'Secret1!',
    });
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Registrazione in corso…');
    request.flush(registered);
  });

  it('shows the recovery code instead of the form and stays on the page', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const { fixture, page } = await submitValidForm();

    http.expectOne('/api/auth/register').flush(registered);
    await settle(fixture);

    expect(page.textContent).toContain(registered.recoveryCode);
    expect(page.querySelector('form')).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('goes to the home page once the user has saved the code', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const { fixture, page } = await submitValidForm();
    http.expectOne('/api/auth/register').flush(registered);
    await settle(fixture);

    page.querySelector<HTMLButtonElement>('button')!.click();

    expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
  });

  it('shows the password rules that failed under the password', async () => {
    const { fixture, page } = await submitValidForm();

    http.expectOne('/api/auth/register').flush(
      validationProblem({
        PasswordTooShort: ['Passwords must be at least 6 characters.'],
        PasswordRequiresDigit: ["Passwords must have at least one digit ('0'-'9')."],
      }),
      { status: 400, statusText: 'Bad Request' },
    );
    await settle(fixture);

    expect(fieldText(page, 'register-password')).toContain(
      'La password deve avere almeno 6 caratteri.',
    );
    expect(fieldText(page, 'register-password')).toContain('Serve almeno un numero.');
  });

  it('shows the username length error once under the username', async () => {
    const { fixture, page } = await submitValidForm();

    http.expectOne('/api/auth/register').flush(
      validationProblem({
        Username: [
          'The Username field is required.',
          "The field Username must be a string or collection type with a minimum length of '3' and maximum length of '30'.",
        ],
      }),
      { status: 400, statusText: 'Bad Request' },
    );
    await settle(fixture);

    const text = fieldText(page, 'register-username')!;
    expect(text.split('Lo username deve avere da 3 a 30 caratteri.').length).toBe(2);
  });

  it('shows a generic message for an error code it does not know', async () => {
    const { fixture, page } = await submitValidForm();

    http.expectOne('/api/auth/register').flush(
      validationProblem({
        PasswordRequiresUniqueChars: ['Passwords must use at least 2 different characters.'],
      }),
      { status: 400, statusText: 'Bad Request' },
    );
    await settle(fixture);

    expect(page.querySelector('.alert-danger')?.textContent).toContain(
      'Dati non validi: controlla i campi e riprova.',
    );
  });

  it('shows one message when the email or the username is taken', async () => {
    const { fixture, page } = await submitValidForm();

    http
      .expectOne('/api/auth/register')
      .flush(
        { title: 'Conflict', status: 409, detail: "Email 'mario@example.com' is already taken." },
        { status: 409, statusText: 'Conflict' },
      );
    await settle(fixture);

    expect(page.querySelector('.alert-danger')?.textContent).toContain(
      'Email o username già in uso.',
    );
  });

  it('shows the message for too many attempts', async () => {
    const { fixture, page } = await submitValidForm();

    http
      .expectOne('/api/auth/register')
      .flush(null, { status: 429, statusText: 'Too Many Requests' });
    await settle(fixture);

    expect(page.querySelector('.alert-danger')?.textContent).toContain(
      'Troppi tentativi: riprova tra un minuto.',
    );
  });

  it('shows a generic message when the server does not answer', async () => {
    const { fixture, page } = await submitValidForm();

    http.expectOne('/api/auth/register').error(new ProgressEvent('error'));
    await settle(fixture);

    expect(page.querySelector('.alert-danger')?.textContent).toContain(
      'Registrazione non riuscita: riprova più tardi.',
    );
  });

  it('rejects an email without @ on submit', async () => {
    const { fixture, page } = await render();

    type(page.querySelector('#register-email')!, 'mario');
    submit(page);
    await fixture.whenStable();

    http.expectNone('/api/auth/register');
    expect(page.textContent).toContain("L'email non è valida.");
  });

  it('shows no error when a field is left before the first submit', async () => {
    const { fixture, page } = await render();

    type(page.querySelector('#register-password')!, 'Secret1!');
    type(page.querySelector('#register-confirm-password')!, 'Secret2!');
    await fixture.whenStable();

    expect(page.querySelectorAll('.text-danger').length).toBe(0);
  });

  it('shows an error on submit when the two passwords differ', async () => {
    const { fixture, page } = await render();

    type(page.querySelector('#register-password')!, 'Secret1!');
    type(page.querySelector('#register-confirm-password')!, 'Secret2!');
    submit(page);
    await fixture.whenStable();

    expect(page.textContent).toContain('Le password non coincidono.');
  });

  it('clears the error while typing when the passwords match again', async () => {
    const { fixture, page } = await render();

    type(page.querySelector('#register-password')!, 'Secret1!');
    type(page.querySelector('#register-confirm-password')!, 'Secret2!');
    submit(page);
    type(page.querySelector('#register-password')!, 'Secret2!');
    await fixture.whenStable();

    expect(page.textContent).not.toContain('Le password non coincidono.');
  });
});
