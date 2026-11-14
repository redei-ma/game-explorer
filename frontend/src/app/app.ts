import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './auth/auth.service';

@Component({
	imports: [RouterOutlet, RouterLink],
	selector: 'app-root',
	templateUrl: './app.html',
	styleUrl: './app.css',
	host: { '(document:visibilitychange)': 'onVisibilityChange()' },
})
export class App {
	private readonly router = inject(Router);
	private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

	private readonly auth = inject(AuthService);

	protected readonly currentUser = this.auth.currentUser;
	protected readonly sessionExpired = this.auth.sessionExpired;

	protected readonly menuOpen = signal(false);
	protected readonly searchOpen = signal(false);

	// Navigation links with currently available routes
	protected readonly navLinks = [
	{ label: 'Giochi', path: '/games' },
	{ label: 'Preferiti', path: '/favorites' },
	{ label: 'Wishlist', path: '/wishlist' },
	];
	protected readonly footerLinks = ['Chi siamo', 'Aiuto', 'Termini', 'Privacy', 'Contatti'];

	// A hidden tab does not see a logout or login made in another one: it asks again when shown.
	protected onVisibilityChange(): void {
	if (document.visibilityState === 'visible') {
		this.auth.recheckCurrentUser();
	}
	}

	protected dismissSessionExpired(): void {
	this.auth.dismissSessionExpired();
	}

	protected toggleSearch(): void {
	this.searchOpen.update((open) => !open);
	// The input exists only after the next render
	setTimeout(() => this.searchInput()?.nativeElement.focus());
	}

	// Basic search: hands the term to the games list page (/games?search=...)
	protected search(event: Event, term: string): void {
	event.preventDefault();
	const search = term.trim();
	if (!search) return;
	this.searchOpen.set(false);
	this.menuOpen.set(false);
	this.router.navigate(['/games'], { queryParams: { search } });
	}
}