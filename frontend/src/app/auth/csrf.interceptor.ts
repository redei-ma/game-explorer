import { HttpInterceptorFn } from '@angular/common/http';

// auth-service refuses a request that can change data without this header: another site
// cannot add a custom header without a CORS permission.
export const csrfInterceptor: HttpInterceptorFn = (req, next) =>
  req.url.startsWith('/api/') && req.method !== 'GET' && req.method !== 'HEAD'
    ? next(req.clone({ setHeaders: { 'X-CSRF-Token': '1' } }))
    : next(req);
