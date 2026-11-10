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
});
