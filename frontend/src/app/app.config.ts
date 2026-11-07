import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch } from '@angular/common/http';
import localeIt from '@angular/common/locales/it';
import {
	ApplicationConfig,
	LOCALE_ID,
	inject,
	provideAppInitializer,
	provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { AuthService } from './auth/auth.service';

// Italian dates and decimals (date / number pipes)
registerLocaleData(localeIt);

export const appConfig: ApplicationConfig = {
	providers: [
		provideBrowserGlobalErrorListeners(),
		provideRouter(routes),
		provideHttpClient(withFetch()),
		// Waits for /api/auth/me, so the first page and route guard already know who is logged in.
		provideAppInitializer(() => inject(AuthService).loadCurrentUser()),
		{ provide: LOCALE_ID, useValue: 'it' },
	],
};