// Manages the favorites reactively using Angular Signals: a guest's in Local Storage,
// a logged-in user's in library-service

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import {
	Observable,
	Subscription,
	catchError,
	concatMap,
	from,
	of,
	tap,
	throwError,
	toArray,
} from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { Game, GamePlatform } from '../games/games.api';

// Key used to store favorites in the browser's Local Storage
const STORAGE_KEY = 'ge_favorites';

interface FavoriteDto {
	gameId: number;
	name: string;
	coverUrl: string | null;
	rating: number | null;
	releaseDate: string | null;
	parentPlatforms: GamePlatform[];
	addedAt: string;
}

@Injectable({
	providedIn: 'root'
})
export class FavoritesService {
	private readonly http = inject(HttpClient);
	private readonly auth = inject(AuthService);

	// Reactive signal holding the current list of favorite games. Local Storage keeps only the
	// guest's list, so a logged-in user starts empty until the server answers.
	readonly favorites = signal<Game[]>(this.auth.currentUser() ? [] : this.loadFavorites());
	// For the favorites page: a logged-in user's list has to arrive from the server first.
	readonly status = signal<'loading' | 'ready' | 'error'>(this.auth.currentUser() ? 'loading' : 'ready');

	constructor() {
		// Runs again at every login and logout. A logged-in user first gets the guest's favorites,
		// then the account list. onCleanup drops requests still on their way when the session
		// changes again, so nothing lands in the wrong session.
		effect((onCleanup) => {
			const user = this.auth.currentUser();
			untracked(() => {
				if (user) {
					this.status.set('loading');
					const requests = new Subscription();
					requests.add(this.moveGuestFavorites().subscribe(() => requests.add(this.refresh())));
					onCleanup(() => requests.unsubscribe());
				} else {
					this.favorites.set(this.loadFavorites());
					this.status.set('ready');
				}
			});
		});
	}

	// Checks if a specific game is already in the favorites list
	isFavorite(gameId: number): boolean {
		return this.favorites().some(g => g.id === gameId);
	}

	// Adds the game to favorites if not present, or removes it if it already is
	toggleFavorite(game: Game): void {
		const current = this.favorites();
		const index = current.findIndex(g => g.id === game.id);
		const updated = index >= 0
			? current.filter(g => g.id !== game.id)
			: [...current, game];
		const wasFavorite = index >= 0;

		// Update the reactive signal; only a guest's list is persisted to Local Storage
		this.favorites.set(updated);
		if (!this.auth.currentUser()) {
			this.saveFavorites(updated);
			return;
		}

		// The X-CSRF-Token header is added by csrfInterceptor (app.config.ts)
		const request = wasFavorite
			? this.http.delete<void>(`/api/library/favorites/${game.id}`)
			: this.http.put<void>(`/api/library/favorites/${game.id}`, game);

		request.subscribe({
			error: (error: HttpErrorResponse) => {
				console.error('Could not update the favorites on the server', error);
				this.favorites.set(current);
			}
		});
	}

	/**
	 * Loads the account favorites. Called only for a logged-in user; the list is not
	 * saved to Local Storage, so it does not stay in the browser after logout.
	 */
	refresh(): Subscription {
		this.status.set('loading');
		return this.http.get<FavoriteDto[]>('/api/library/favorites').subscribe({
			next: favorites => {
				const cachedFavorites = this.favorites();
				const games = favorites.map(favorite => {
					const cachedGame = cachedFavorites.find(game => game.id === favorite.gameId);
					return this.toGame(favorite, cachedGame);
				});
				this.favorites.set(games);
				this.status.set('ready');
			},
			error: (error: HttpErrorResponse) => {
				this.status.set('error');
				if (error.status !== 401) {
					console.error('Could not load the favorites from the server', error);
				}
			}
		});
	}

	/**
	 * Moves the guest's favorites into the account, at login and at registration. One PUT at a
	 * time, each with the card saved in Local Storage, so the first failure stops the copy. Local
	 * Storage is emptied only when every game got there: a failed copy is tried again at the next
	 * login. A card the server rejects (400) counts as done, or the copy would never finish.
	 */
	private moveGuestFavorites(): Observable<unknown> {
		return from(this.loadFavorites()).pipe(
			concatMap(game => this.http.put<void>(`/api/library/favorites/${game.id}`, game).pipe(
				catchError((error: HttpErrorResponse) => error.status === 400 ? of(null) : throwError(() => error))
			)),
			toArray(),
			tap(() => this.saveFavorites([])),
			catchError(error => {
				console.error('Could not move the guest favorites to the account', error);
				return of(null);
			})
		);
	}

	// Used when the account is deleted: removes every favorite on the server, then the local copy
	deleteAll(): Observable<void> {
		return this.http.delete<void>('/api/library/favorites').pipe(
			tap(() => {
				this.favorites.set([]);
				this.saveFavorites([]);
			})
		);
	}

	// Retrieves the saved favorites from Local Storage on application startup
	private loadFavorites(): Game[] {
		try {
			const data = localStorage.getItem(STORAGE_KEY);
			return data ? JSON.parse(data) : [];
		} catch {
			return [];
		}
	}

	private toGame(favorite: FavoriteDto, cachedGame?: Game): Game {
		return {
			id: favorite.gameId,
			name: favorite.name || cachedGame?.name || 'Gioco senza nome',
			slug: cachedGame?.slug ?? '',
			released: favorite.releaseDate ?? cachedGame?.released ?? null,
			backgroundImage: favorite.coverUrl ?? cachedGame?.backgroundImage ?? null,
			rating: favorite.rating ?? cachedGame?.rating ?? 0,
			metacritic: cachedGame?.metacritic ?? null,
			parentPlatforms: favorite.parentPlatforms,
		};
	}

	// Persists the updated favorites list to Local Storage
	private saveFavorites(favs: Game[]): void {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
		} catch {
			// Silently fail if Local Storage is disabled or full
		}
	}
}
