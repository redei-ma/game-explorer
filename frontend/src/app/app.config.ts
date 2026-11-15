import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeIt from '@angular/common/locales/it';
import {
	ApplicationConfig,
	LOCALE_ID,
	inject,
	provideAppInitializer,
	provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling, withRouterConfig } from '@angular/router';
import { routes } from './app.routes';
import { AuthService } from './auth/auth.service';
import { csrfInterceptor } from './auth/csrf.interceptor';
import { sessionInterceptor } from './auth/session.interceptor';

// Italian dates and decimals (date / number pipes)
registerLocaleData(localeIt);

export const appConfig: ApplicationConfig = {
	providers: [
		provideBrowserGlobalErrorListeners(),
		provideRouter(
			routes,
			withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
			withRouterConfig({ onSameUrlNavigation: 'reload' }),
		),
		provideHttpClient(withInterceptors([csrfInterceptor])),
		// Waits for /api/auth/me, so the first page and route guard already know who is logged in.
		provideAppInitializer(() => inject(AuthService).loadCurrentUser()),
		{ provide: LOCALE_ID, useValue: 'it' },
	],
};