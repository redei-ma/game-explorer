import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterModule } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, map, switchMap, takeUntil } from 'rxjs/operators';
import { GamesApi, Game, Genre, PlatformItem, GamesQuery } from './games.api';
import { GameCard } from '../game-card/game-card';

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

	// Filter Status mapped to your GamesQuery
	currentQuery: GamesQuery = {
		page: 1,
		pageSize: 24,
		ordering: '-rating'
	};

	years: number[] = [];
	selectedYear = '';// Support variable to generate GamesQuery "dates"

	ngOnInit(): void {
		this.initYears();
		this.loadGenresAndPlatforms();

		// Keep the URL as the source of truth and cancel stale requests on new filters.
		this.route.queryParams.pipe(
			map(params => {
				const query = this.queryFromParams(params);
				this.currentQuery = query;
				this.selectedYear = params['year'] || '';
				this.isLoading.set(true);
				this.hasError.set(false);
				return query;
			}),
			switchMap(query => this.gamesApi.getGames(query).pipe(
				map(response => ({ query, response })),
				catchError(() => of({ query, response: null })),
			)),
			takeUntil(this.destroy$),
		).subscribe(({ query, response }) => {
			if (response === null) {
				this.games.set([]);
				this.totalResults.set(0);
				this.totalPages.set(1);
				this.hasError.set(true);
			} else {
				this.games.set(response.results || []);
				this.totalResults.set(response.count || 0);
				this.totalPages.set(Math.ceil((response.count || 0) / (query.pageSize || 24)) || 1);
			}
			this.isLoading.set(false);
		});
	}

	ngOnDestroy(): void {
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

	fetchGames(): void {
		this.isLoading.set(true);
		this.hasError.set(false);

		this.gamesApi.getGames(this.currentQuery).subscribe({
			next: res => {
				this.games.set(res.results || []);
				this.totalResults.set(res.count || 0);
				this.totalPages.set(Math.ceil((res.count || 0) / (this.currentQuery.pageSize || 24)) || 1);
				this.isLoading.set(false);
			},
			error: () => {
				this.isLoading.set(false);
				this.hasError.set(true);
			}
		});
	}

	// Event handlers for filter changes, search submission, and pagination
	onFilterChange(): void {
		this.updateQueryParams(1);
	}

	onSearchSubmit(): void {
		this.updateQueryParams(1);
	}

	onPageChange(newPage: number): void {
		if (newPage < 1 || newPage > this.totalPages()) return;
		this.updateQueryParams(newPage);
		window.scrollTo({ top: 0, behavior: 'smooth' });
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
			page: params['page'] ? parseInt(params['page'], 10) : 1,
			pageSize: this.pageSize,
			dates: selectedYear
				? `${selectedYear}-01-01,${selectedYear}-12-31`
				: undefined,
		};
	}
}