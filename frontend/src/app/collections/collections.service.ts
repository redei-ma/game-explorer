import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Game, GamesApi, Genre } from '../games/games.api';

// Games in each collection: a Top 10
export const COLLECTION_SIZE = 10;

// Collections are built from the catalog-service data: no list is written by hand here
@Injectable({ providedIn: 'root' })
export class CollectionsService {
	private readonly api = inject(GamesApi);

	// Genres exactly as the API returns them, so a collection never names a genre the API does not know
	getGenres(): Observable<Genre[]> {
		return this.api.getGenres().pipe(map((page) => page.results ?? []));
	}

	// Best games of a genre by Metacritic. Games with no Metascore are left out: the server is asked
	// for the 1-100 range, and the filter below also covers a backend that ignores that range
	getTopGames(genre: Genre, size = COLLECTION_SIZE): Observable<Game[]> {
		return this.api
			.getGames({ genres: String(genre.id), ordering: '-metacritic', metacritic: '1,100', pageSize: size })
			.pipe(map((page) => (page.results ?? []).filter(hasMetascore).slice(0, size)));
	}
}

function hasMetascore(game: Game): boolean {
	return game.metacritic !== null && game.metacritic > 0;
}