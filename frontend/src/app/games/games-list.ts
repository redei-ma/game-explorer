// The catalog page: filters on top, the grid of game cards, and the page bar at the bottom.
// The URL (?search=...&page=3) is the source of truth: every change of filter or page
// rewrites the URL, and a single listener on the URL loads the games.
import {
	ChangeDetectionStrategy, Component, ElementRef, Injector, OnDestroy, OnInit,
	afterNextRender, computed, inject, signal, viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterModule } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, map, switchMap, takeUntil } from 'rxjs/operators';
import { GamesApi, Game, Genre, PlatformItem, GamesQuery } from './games.api';
import { GameCard } from '../game-card/game-card';

/**
 * Highest page the catalog lets you open. Same value as GamesController.MaxPage
 * in catalog-service: change both together.
 */
export const MAX_PAGE = 800;

/** One entry of the numbered row: a page number, or 'gap' for a clickable "…". */
type PageItem = number | 'gap';

/** On screens this narrow the row shows 1 neighbour on each side of the current page instead of 2. */
const NARROW_SCREEN = '(max-width: 576px)';

/**
 * Catalog page component. Reads the filters and the page from the URL, asks catalog-service
 * for that page of games, and draws the cards plus the page bar.
 */
@Component({
	selector: 'app-games-list',
	standalone: true,
	imports: [CommonModule, FormsModule, RouterModule, GameCard],
	templateUrl: './games-list.html',
	styleUrls: ['./games-list.css'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class GamesList implements OnInit, OnDestroy {
	private readonly gamesApi = inject(GamesApi);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly injector = inject(Injector); // needed by afterNextRender in openJump
	private readonly destroy$ = new Subject<void>();

	readonly games = signal<Game[]>([]);
	readonly genres = signal<Genre[]>([]);
	readonly platforms = signal<PlatformItem[]>([]);
	readonly specificPlatforms = signal<PlatformItem[]>([]);

	readonly totalResults = signal(0);
	readonly totalPages = signal(1);
	pageSize = 24;

	readonly isLoading = signal(true);
	readonly hasError = signal(false);
	showMobileFilters = false;

	readonly currentPage = signal(1);

	/** Position (in pageItems) of the "…" that is currently a typing box, or null if none is. */
	readonly editingGap = signal<number | null>(null);

	/** True when the typed page is not valid: the box gets a red border. */
	readonly jumpInvalid = signal(false);

	/** The typing box, when it exists. Used only to put the cursor in it. */
	private readonly jumpInputRef = viewChild<ElementRef<HTMLInputElement>>('jumpInput');

	private readonly narrowQuery = window.matchMedia(NARROW_SCREEN);
	private readonly isNarrow = signal(this.narrowQuery.matches);
	private readonly onScreenChange = (e: MediaQueryListEvent) => this.isNarrow.set(e.matches);

	readonly pageItems = computed<PageItem[]>(() => {
		const current = this.currentPage();
		const last = this.totalPages();
		const radius = this.isNarrow() ? 1 : 2;

		const wanted = new Set<number>([1, last]);
		for (let p = current - radius; p <= current + radius; p++) wanted.add(p);
		const pages = [...wanted].filter(p => p >= 1 && p <= last).sort((a, b) => a - b);

		const items: PageItem[] = [];
		pages.forEach((p, i) => {
			const previous = pages[i - 1];
			if (i > 0 && p - previous === 2) items.push(previous + 1); // one hidden page: show it
			else if (i > 0 && p - previous > 2) items.push('gap');     // several: show "…"
			items.push(p);
		});
		return items;
	});

	// Filter Status mapped to your GamesQuery
	currentQuery: GamesQuery = {
		page: 1,
		pageSize: 24,
		ordering: '-rating'
	};

	years: number[] = [];
	selectedYear = '';// Support variable to generate GamesQuery "dates"

	/** Fills the dropdowns and starts listening to the URL: every URL change loads a page of games. */
	ngOnInit(): void {
		this.initYears();
		this.loadGenresAndPlatforms();
		this.narrowQuery.addEventListener('change', this.onScreenChange);

		// Keep the URL as the source of truth and cancel stale requests on new filters.
		this.route.queryParams.pipe(
			map(params => {
				const query = this.queryFromParams(params);
				this.currentQuery = query;
				this.selectedYear = params['year'] || '';
				this.currentPage.set(query.page ?? 1);
				this.closeJump();
				this.isLoading.set(true);
				this.hasError.set(false);
				return query;
			}),
			switchMap(query => this.gamesApi.getGames(query).pipe(
				map(response => ({ query, response })),
				catchError(() => of({ query, response: null })),
			)),
			takeUntil(this.destroy$),
		).subscribe(({ response }) => {
			if (response === null) {
				this.setResults([], 0);
				this.hasError.set(true);
			} else {
				this.setResults(response.results || [], response.count || 0); // CHANGED
			}
			this.isLoading.set(false);
		});
	}

	/** Stops the URL listener and the screen-size listener when the page is closed. */
	ngOnDestroy(): void {
		this.narrowQuery.removeEventListener('change', this.onScreenChange); // NEW
		this.destroy$.next();
		this.destroy$.complete();
	}

	private initYears(): void {
		const currentYear = new Date().getFullYear();
		for (let year = currentYear; year >= 1990; year--) {
			this.years.push(year);
		}
	}

	private loadGenresAndPlatforms(): void {
		this.gamesApi.getGenres().subscribe({
			next: res => this.genres.set(res.results || []),
			error: () => console.error('Errore nel caricamento dei generi')
		});

		this.gamesApi.getParentPlatforms().subscribe({
			next: res => this.platforms.set(res.results || []),
			error: () => console.error('Errore nel caricamento delle famiglie di piattaforme')
		});

		this.gamesApi.getPlatforms().subscribe({
			next: res => this.specificPlatforms.set(res.results || []),
			error: () => console.error('Errore nel caricamento delle piattaforme')
		});
	}

	/** Reloads the current page without touching the URL (used by the "Riprova" button). */
	fetchGames(): void {
		this.isLoading.set(true);
		this.hasError.set(false);

		this.gamesApi.getGames(this.currentQuery).subscribe({
			next: res => {
				this.setResults(res.results || [], res.count || 0);
				this.isLoading.set(false);
			},
			error: () => {
				this.isLoading.set(false);
				this.hasError.set(true);
			}
		});
	}

	private setResults(results: Game[], count: number): void {
		this.games.set(results);
		this.totalResults.set(count);
		this.totalPages.set(Math.min(MAX_PAGE, Math.max(1, Math.ceil(count / this.pageSize))));
	}

	// Event handlers for filter changes, search submission, and pagination
	onFilterChange(): void {
		this.updateQueryParams(1);
	}

	onSearchSubmit(): void {
		this.updateQueryParams(1);
	}

	onPageChange(newPage: number): void {
		if (newPage === this.currentPage() || newPage < 1 || newPage > this.totalPages()) return; // CHANGED
		this.updateQueryParams(newPage);
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	openJump(index: number): void {
		this.jumpInvalid.set(false);
		this.editingGap.set(index);
		// The box only exists after Angular redraws the bar, so wait for that before focusing it.
		afterNextRender(() => this.jumpInputRef()?.nativeElement.focus(), { injector: this.injector });
	}

	jump(raw: string): void {
		const n = Number(raw);
		if (raw.trim() === '' || !Number.isInteger(n) || n < 1 || n > this.totalPages()) {
			this.jumpInvalid.set(true);
			return;
		}
		this.closeJump();
		this.onPageChange(n);
	}

	closeJump(): void {
		this.editingGap.set(null);
		this.jumpInvalid.set(false);
	}

	goToLastPage(): void {
		this.onPageChange(this.totalPages());
	}

	resetFilters(): void {
		this.currentQuery.search = undefined;
		this.currentQuery.genres = undefined;
		this.currentQuery.parentPlatforms = undefined;
		this.currentQuery.platforms = undefined;
		this.selectedYear = '';
		this.currentQuery.metacritic = undefined;
		this.currentQuery.ordering = '-rating';
		this.updateQueryParams(1);
	}

	toggleMobileFilters(): void {
		this.showMobileFilters = !this.showMobileFilters;
	}

	private updateQueryParams(page: number): void {
		const queryParams = {
			search: this.currentQuery.search || null,
			genres: this.currentQuery.genres || null,
			parentPlatforms: this.currentQuery.parentPlatforms || null,
			platforms: this.currentQuery.platforms || null,
			year: this.selectedYear || null,
			metacritic: this.currentQuery.metacritic || null,
			ordering: this.currentQuery.ordering !== '-rating' ? this.currentQuery.ordering : null,
			page: page > 1 ? page : null
		};

		this.router.navigate([], {
			relativeTo: this.route,
			queryParams,
			queryParamsHandling: 'merge'
		});
	}

	private queryFromParams(params: Params): GamesQuery {
		const selectedYear = params['year'] || '';
		return {
			search: params['search'] || undefined,
			genres: params['genres'] || undefined,
			parentPlatforms: params['parentPlatforms'] || undefined,
			platforms: params['platforms'] || undefined,
			metacritic: params['metacritic'] || undefined,
			ordering: params['ordering'] || '-rating',
			page: this.parsePage(params['page']), // CHANGED
			pageSize: this.pageSize,
			dates: selectedYear
				? `${selectedYear}-01-01,${selectedYear}-12-31`
				: undefined,
		};
	}

	private parsePage(raw: string | undefined): number {
		const n = Number(raw);
		return Number.isInteger(n) && n >= 1 ? Math.min(n, MAX_PAGE) : 1;
	}
}
