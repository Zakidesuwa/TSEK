import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs/operators';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  const outgoing = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(outgoing).pipe(
    tap({
      error: (err) => {
        if (err.status === 401) {
          // Skip redirect for login/register/verify requests
          if (!req.url.includes('/api/login') && !req.url.includes('/api/register') && !req.url.includes('/api/verify')) {
            authService.logout();
          }
        }
      }
    })
  );
};
