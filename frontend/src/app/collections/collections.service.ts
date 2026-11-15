import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, Subscription, catchError, map, retry, shareReplay, throwError, timer } from 'rxjs';
import { Game, GamesApi, Genre } from '../games/games.api';

// Games in each collection: a Top 10
export const COLLECTION_SIZE = 10;

// Throttle outbound catalog requests to avoid triggering upstream rate limits
const MAX_CONCURRENT_REQUESTS = 2;
const MIN_REQUEST_INTERVAL_MS = 350;
const RETRY_COUNT = 2;
const RETRY_DELAY_MS = 800;

// Collections are built from the catalog-service data: no list is written by hand here
@Injectable({ providedIn: 'root' })
export class CollectionsService {
	private readonly api = inject(GamesApi);

	// Session-level cache; failed entries are evicted so manual retries can re-fetch
	private genresCache$: Observable<Genre[]> | null = null;
	private readonly topGamesCache = new Map<string, Observable<Game[]>>();

	// Shared scheduler state across all collection requests (Home preview + Collections page)
	private readonly queue: Array<() => void> = [];
	private activeRequests = 0;
	private lastStartedAt = 0;
	private drainTimer: ReturnType<typeof setTimeout> | null = null;

	// Genres exactly as the API returns them, so a collection never names a genre the API does not know
	getGenres(): Observable<Genre[]> {
		if (!this.genresCache$) {
			this.genresCache$ = this.enqueue(() =>
				this.api.getGenres().pipe(
					map((page) => page.results ?? []),
					retry({ count: RETRY_COUNT, delay: shouldRetry }),
				),
			).pipe(
				catchError((error) => {
					this.genresCache$ = null;
					return throwError(() => error);
				}),
				shareReplay({ bufferSize: 1, refCount: false }),
			);
		}
		return this.genresCache$;
	}

	// Best games of a genre by Metacritic. Games with no Metascore are left out: the server is asked
	// for the 1-100 range, and the filter below also covers a backend that ignores that range
	getTopGames(genre: Genre, size = COLLECTION_SIZE): Observable<Game[]> {
		const cacheKey = `${genre.id}:${size}`;
		const cached = this.topGamesCache.get(cacheKey);
		if (cached) return cached;

		const request$ = this.enqueue(() =>
			this.api
				.getGames({ genres: String(genre.id), ordering: '-metacritic', metacritic: '1,100', pageSize: size })
				.pipe(
					map((page) => (page.results ?? []).filter(hasMetascore).slice(0, size)),
					retry({ count: RETRY_COUNT, delay: shouldRetry }),
				),
		).pipe(
			catchError((error) => {
				this.topGamesCache.delete(cacheKey);
				return throwError(() => error);
			}),
			shareReplay({ bufferSize: 1, refCount: false }),
		);

		this.topGamesCache.set(cacheKey, request$);
		return request$;
	}

	private enqueue<T>(factory: () => Observable<T>): Observable<T> {
		return new Observable<T>((subscriber) => {
			let started = false;
			let settled = false;
			let innerSub: Subscription | null = null;

			const finish = () => {
				if (settled) return;
				settled = true;
				this.activeRequests--;
				this.drain();
			};

			const run = () => {
				started = true;
				innerSub = factory().subscribe({
					next: (value) => subscriber.next(value),
					error: (err) => {
						finish();
						subscriber.error(err);
					},
					complete: () => {
						finish();
						subscriber.complete();
					},
				});
			};

			this.queue.push(run);
			this.drain();

			return () => {
				if (!started) {
					const idx = this.queue.indexOf(run);
					if (idx !== -1) this.queue.splice(idx, 1);
					return;
				}
				innerSub?.unsubscribe();
				finish();
			};
		});
	}

	// Drains the queue of pending requests, respecting the concurrency limit and
	// minimum interval between requests
	private drain(): void {
		if (this.drainTimer !== null) return;

		while (this.activeRequests < MAX_CONCURRENT_REQUESTS && this.queue.length > 0) {
			const now = Date.now();
			const wait = Math.max(0, MIN_REQUEST_INTERVAL_MS - (now - this.lastStartedAt));
			if (wait > 0) {
				this.drainTimer = setTimeout(() => {
					this.drainTimer = null;
					this.drain();
				}, wait);
				return ;
			}

			const nextTask = this.queue.shift()!;
			this.activeRequests++;
			this.lastStartedAt = now;
			nextTask();
		}
	}
}

function hasMetascore(game: Game): boolean {
	return game.metacritic !== null && game.metacritic > 0;
}

function shouldRetry(error: unknown): Observable<0> {
	if (error instanceof HttpErrorResponse && error.status >= 400 && error.status < 500 && error.status !== 429) {
		return throwError(() => error);
	}
	return timer(RETRY_DELAY_MS);
}