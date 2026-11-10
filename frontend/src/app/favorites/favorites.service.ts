// Manages localStorage reactively using Angular Signals

import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Game } from '../games/games.api';

// Key used to store favorites in the browser's Local Storage
const STORAGE_KEY = 'ge_favorites';

interface FavoriteDto {
	gameId: number;
	name: string;
	coverUrl: string | null;
	rating: number | null;
	releaseDate: string | null;
	addedAt: string;
}

@Injectable({
	providedIn: 'root'
})
export class FavoritesService {
	private readonly http = inject(HttpClient);

	// Reactive signal holding the current list of favorite games
	readonly favorites = signal<Game[]>(this.loadFavorites());

	constructor() {
		this.refresh();
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

		// Update the reactive signal and persist to Local Storage
		this.favorites.set(updated);
		this.saveFavorites(updated);

		const request = wasFavorite
			? this.http.delete<void>(`/api/library/favorites/${game.id}`, {
				headers: this.csrfHeaders,
				withCredentials: true
			})
			: this.http.put<void>(`/api/library/favorites/${game.id}`, null, {
				headers: this.csrfHeaders,
				withCredentials: true
			});

		request.subscribe({
			error: (error: HttpErrorResponse) => {
				// A 401 means the visitor is a guest: localStorage is the intended store.
				if (error.status === 401) return;

				console.error('Impossibile aggiornare i preferiti sul server', error);
				this.favorites.set(current);
				this.saveFavorites(current);
			}
		});
	}

	/**
	 * Loads the account favorites. Guests keep using their local favorites when
	 * the library service answers 401.
	 */
	refresh(): void {
		this.http.get<FavoriteDto[]>('/api/library/favorites', {
			withCredentials: true
		}).subscribe({
			next: favorites => {
				const cachedFavorites = this.favorites();
				const games = favorites.map(favorite => {
					const cachedGame = cachedFavorites.find(game => game.id === favorite.gameId);
					return this.toGame(favorite, cachedGame);
				});
				this.favorites.set(games);
				this.saveFavorites(games);
			},
			error: (error: HttpErrorResponse) => {
				if (error.status !== 401) {
					console.error('Impossibile caricare i preferiti dal server', error);
				}
			}
		});
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

	private readonly csrfHeaders = new HttpHeaders({ 'X-CSRF-Token': 'frontend' });

	private toGame(favorite: FavoriteDto, cachedGame?: Game): Game {
		return {
			id: favorite.gameId,
			name: favorite.name || cachedGame?.name || 'Gioco senza nome',
			slug: cachedGame?.slug ?? '',
			released: favorite.releaseDate ?? cachedGame?.released ?? null,
			backgroundImage: favorite.coverUrl ?? cachedGame?.backgroundImage ?? null,
			rating: favorite.rating ?? cachedGame?.rating ?? 0,
			metacritic: cachedGame?.metacritic ?? null,
			parentPlatforms: cachedGame?.parentPlatforms,
			platforms: cachedGame?.platforms
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