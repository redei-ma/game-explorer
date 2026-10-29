// Manages localStorage reactively using Angular Signals

import { Injectable, signal } from '@angular/core';
import { Game } from './games.api';

// Key used to store favorites in the browser's Local Storage
const STORAGE_KEY = 'ge_favorites';

@Injectable({
	providedIn: 'root'
})
export class FavoritesService {
	// Reactive signal holding the current list of favorite games
	readonly favorites = signal<Game[]>(this.loadFavorites());

	// Checks if a specific game is already in the favorites list
	isFavorite(gameId: number): boolean {
		return this.favorites().some(g => g.id === gameId);
	}

	// Adds the game to favorites if not present, or removes it if it already is
	toggleFavorite(game: Game): void {
		const current = this.favorites();
		const index = current.findIndex(g => g.id === game.id);
		let updated: Game[];

		if (index >= 0) {
			updated = current.filter(g => g.id !== game.id);// Remove from favorites
		}
		else {
			updated = [...current, game];// Add to favorites
		}
		// Update the reactive signal and persist to Local Storage
		this.favorites.set(updated);
		this.saveFavorites(updated);
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

	// Persists the updated favorites list to Local Storage
	private saveFavorites(favs: Game[]): void {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
		} catch {
			// Silently fail if Local Storage is disabled or full
		}
	}
}