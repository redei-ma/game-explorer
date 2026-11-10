import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { csrfInterceptor } from './csrf.interceptor';

describe('csrfInterceptor', () => {
  let client: HttpClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('adds the header to a POST to our API', () => {
    client.post('/api/auth/login', {}).subscribe();
    const request = http.expectOne('/api/auth/login');

    expect(request.request.headers.get('X-CSRF-Token')).toBe('1');
    request.flush({});
  });

  it('does not add the header to a GET', () => {
    client.get('/api/games').subscribe();
    const request = http.expectOne('/api/games');

    expect(request.request.headers.has('X-CSRF-Token')).toBe(false);
    request.flush({});
  });

  it('does not send the header to another site', () => {
    client.post('https://example.com/data', {}).subscribe();
    const request = http.expectOne('https://example.com/data');

    expect(request.request.headers.has('X-CSRF-Token')).toBe(false);
    request.flush({});
  });
});
