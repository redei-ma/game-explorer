import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Observable, Subscription, catchError, of, tap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { Game, GamePlatform } from '../games/games.api';

const STORAGE_KEY = 'ge_wishlist';

// Shape returned by library-service for a saved wishlist game
interface WishlistItemDto {
	gameId: number;
	name: string;
	coverUrl: string | null;
	rating: number | null;
	releaseDate: string | null;
	parentPlatforms: GamePlatform[];
	addedAt: string;
}

@Injectable({
	providedIn: 'root',
})
export class WishlistService {
	private readonly http = inject(HttpClient);
	private readonly auth = inject(AuthService);

	// Guests keep their wishlist locally; authenticated users load it from the server
	readonly wishlist = signal<Game[]>(this.auth.currentUser() ? [] : this.loadWishlist());
	// The wishlist page uses this state to distinguish loading, empty and failed requests
	readonly status = signal<'loading' | 'ready' | 'error'>(
		this.auth.currentUser() ? 'loading' : 'ready',
	);

	constructor() {
		// Login imports the guest wishlist before loading the account wishlist
		effect((onCleanup) => {
			const user = this.auth.currentUser();
			untracked(() => {
				if (user) {
					this.status.set('loading');
					const requests = new Subscription();
					requests.add(this.importGuestWishlist().subscribe(() => requests.add(this.refresh())));
					onCleanup(() => requests.unsubscribe());
				} else {
					this.wishlist.set(this.loadWishlist());
					this.status.set('ready');
				}
			});
		});
	}

	isInWishlist(gameId: number): boolean {
		return this.wishlist().some((game) => game.id === gameId);
	}

	// Optimistically updates the UI, then persists the change locally or on the server
	toggleWishlist(game: Game): void {
		const current = this.wishlist();
		const index = current.findIndex((item) => item.id === game.id);
		const updated = index >= 0
			? current.filter((item) => item.id !== game.id)
			: [...current, game];
		const wasInWishlist = index >= 0;

		this.wishlist.set(updated);
		if (!this.auth.currentUser()) {
			this.saveWishlist(updated);
			return;
		}

		// The CSRF interceptor adds the required X-CSRF-Token header
		const request = wasInWishlist
			? this.http.delete<void>(`/api/library/wishlist/${game.id}`)
			: this.http.put<void>(`/api/library/wishlist/${game.id}`, game);

		request.subscribe({
			error: (error: HttpErrorResponse) => {
				console.error('Could not update the wishlist on the server', error);
				this.wishlist.set(current);
			},
		});
	}

	// Loads the authenticated user's wishlist
	refresh(): Subscription {
		this.status.set('loading');
		return this.http.get<WishlistItemDto[]>('/api/library/wishlist').subscribe({
			next: (items) => {
				const cachedWishlist = this.wishlist();
				const games = items.map((item) => {
					const cachedGame = cachedWishlist.find((game) => game.id === item.gameId);
					return this.toGame(item, cachedGame);
				});
				this.wishlist.set(games);
				this.status.set('ready');
			},
			error: (error: HttpErrorResponse) => {
				this.status.set('error');
				if (error.status !== 401) {
					console.error('Could not load the wishlist from the server', error);
				}
			},
		});
	}

	// Imports guest cards in one request. A rejected card list is considered handled,
	// while network/server failures keep the local copy for the next login
	private importGuestWishlist(): Observable<unknown> {
		const guestWishlist = this.loadWishlist();
		if (guestWishlist.length === 0) {
			return of(null);
		}

		return this.http.post<WishlistItemDto[]>('/api/library/wishlist/import', guestWishlist).pipe(
			catchError((error: HttpErrorResponse) =>
				error.status === 400 ? of(null) : throwError(() => error),
			),
			tap(() => this.saveWishlist([])),
			catchError((error) => {
				console.error('Could not move the guest wishlist to the account', error);
				return of(null);
			}),
		);
	}

	// Reads the guest wishlist from Local Storage
	private loadWishlist(): Game[] {
		try {
			const data = localStorage.getItem(STORAGE_KEY);
			return data ? JSON.parse(data) : [];
		} catch {
			return [];
		}
	}

	// Persists only the guest wishlist; authenticated data remains server-side
	private saveWishlist(wishlist: Game[]): void {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(wishlist));
		} catch {
			// Silently fail if Local Storage is disabled or full
		}
	}

	// Reconstructs the Game shape expected by the existing cards and list components
	private toGame(item: WishlistItemDto, cachedGame?: Game): Game {
		return {
			id: item.gameId,
			name: item.name || cachedGame?.name || 'Gioco senza nome',
			slug: cachedGame?.slug ?? '',
			released: item.releaseDate ?? cachedGame?.released ?? null,
			backgroundImage: item.coverUrl ?? cachedGame?.backgroundImage ?? null,
			rating: item.rating ?? cachedGame?.rating ?? 0,
			metacritic: cachedGame?.metacritic ?? null,
			parentPlatforms: item.parentPlatforms,
		};
	}
}
