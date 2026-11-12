// defines the RAWG data types (Game, GamesPage, GamesQuery) and a class with only
// one method, getGames(query), which calls GET/api/games with the parameters to
// keep API calls separate from graphics
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/*******************************************************************************
 *   Models (subset of the RAWG /games payload)                                *
 ******************************************************************************/
export interface Platform {
	id: number;
	name: string;
	slug: string;
}

export interface ParentPlatform extends Platform {}

export interface GamePlatform {
	platform: Platform;
}

export interface Game {
	id: number;
	name: string;
	slug: string;
	released: string | null;// yyyy-mm-dd
	backgroundImage: string | null;
	rating: number;// 0-5, 0 when nobody rated it yet
	metacritic: number | null;
	parentPlatforms?: GamePlatform[];
}

export interface GamesPage {
	count: number;
	next: string | null;
	previous: string | null;
	results: Game[];
}

// Templates for Genres and Platforms (required for search filters)
export interface Genre {
	id: number;
	name: string;
	slug: string;
}
export interface PlatformItem {
	id: number;
	name: string;
	slug: string;
}
// Pagination for Genres and Platforms following the GamesPage pattern
export interface GenresPage {
	count: number;
	results: Genre[];
}
export interface PlatformsPage {
	count: number;
	results: PlatformItem[];
}

// Templates for the detail card and screenshots
export interface Developer {
	id: number;
	name: string;
	slug: string;
}
export interface Publisher {
	id: number;
	name: string;
	slug: string;
}
export interface Screenshot {
	id: number;
	image: string;
}
export interface GameDetailData extends Game {
	descriptionRaw?: string;
	developers?: Developer[];
	publishers?: Publisher[];
	genres?: Genre[];
	/** The cover, the same image the list shows on the card. backgroundImage (inherited) is the banner. */
	coverImage?: string | null;
	/** Specific platforms (PS4, PS5...), shown only on the detail page. */
	platforms?: GamePlatform[];
}
export interface ScreenshotsResponse {
	count?: number;
	results: Screenshot[];
}

// Query parameters accepted by GET /api/games (same names as RAWG's /games)
export interface GamesQuery {
	search?: string;
	genres?: string;
	platforms?: string;// Specific consoles (PS4, PS5, Xbox One...)
	parentPlatforms?: string;// Platform families (PlayStation, Xbox, PC...)
	dates?: string;// "yyyy-mm-dd,yyyy-mm-dd"
	ordering?: string;// e.g. "-added", "-rating", "name"
	metacritic?: string;// "80,100"
	page?: number;
	pageSize?: number;
}

/*******************************************************************************
 *   API layer                                                                 *
 ******************************************************************************/
/* Single entry point to the catalog-service. The RAWG key lives in the backend,
 * so the browser only ever talks to our own /api (proxy.conf.json in dev, nginx in Docker).
 * Components never build URLs: they call a method here */
@Injectable({ providedIn: 'root' })
export class GamesApi {
	private readonly http = inject(HttpClient);

	getGames(query: GamesQuery = {}): Observable<GamesPage> {
		const params: Record<string, string | number> = {};
		const { metacritic, ...backendQuery } = query;
		for (const [key, value] of Object.entries(backendQuery)) {
			if (value !== undefined && value !== '')
					params[key] = value;
		}
		if (metacritic) {
			const [min, max] = metacritic.split(',');
			if (min) params['minMetacritic'] = Number(min);
			if (max) params['maxMetacritic'] = Number(max);
		}
		return this.http.get<GamesPage>('/api/games', { params });
	}

	// Methods for retrieving curtain filter data
	getGenres(): Observable<GenresPage> {
		return this.http.get<GenresPage>('/api/genres');
	}
	getPlatforms(): Observable<PlatformsPage> {
		// page_size=40 is the maximum allowed by RAWG, so we can get all platforms in one call
		const params = new HttpParams().set('page_size', '40');
		return this.http.get<PlatformsPage>('/api/platforms', { params });
	}
	getParentPlatforms(): Observable<PlatformsPage> {
		return this.http.get<PlatformsPage>('/api/parent-platforms');
	}

	// Methods for retrieving detail information and screenshots of the individual game
	getGame(id: number): Observable<GameDetailData> {
		return this.http.get<GameDetailData>(`/api/games/${id}`);
	}
	getScreenshots(id: number): Observable<ScreenshotsResponse> {
		return this.http.get<ScreenshotsResponse>(`/api/games/${id}/screenshots`);
	}
}
