import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { forkJoin, of, combineLatest } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';
import { GamesApi, GameDetailData, Screenshot, Game } from '../games/games.api';
import { FavoritesService } from '../favorites/favorites.service';

// Internal state interface for reactive HTTP calls
interface DetailState {
	gameId: number | null;
	game: GameDetailData | null;
	screenshots: Screenshot[];
	isLoading: boolean;
	hasError: boolean;
}

@Component({
	selector: 'app-game-detail',
	standalone: true,
	imports: [CommonModule, RouterModule],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: './game-detail.html',
	styleUrls: ['./game-detail.css']
})
export class GameDetail {
	private readonly gamesApi = inject(GamesApi);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	readonly location = inject(Location);
	private readonly favoritesService = inject(FavoritesService);

	// Trigger to manually re-fetch data from the UI (error banner)
	private readonly refreshTrigger = signal(0);

	// Main declarative data pipeline replacing ngOnInit and manual subscriptions
	private readonly detailState = toSignal(
		combineLatest([
			this.route.paramMap,
			toObservable(this.refreshTrigger)
		]).pipe(
			switchMap(([params]) => {
				const idParam = params.get('id');
				if (!idParam) {
					return of({ gameId: null, game: null, screenshots: [], isLoading: false, hasError: true });
				}
				const id = parseInt(idParam, 10);

				// Run the request for basic information and screenshots in parallel
				// Added catchError to screenshots to prevent the entire page from failing if images fail
				return forkJoin({
					detail: this.gamesApi.getGame(id),
					screenshotsRes: this.gamesApi.getScreenshots(id).pipe(catchError(() => of(null)))
				}).pipe(
					map(({ detail, screenshotsRes }) => ({
						gameId: id,
						game: detail,
						screenshots: screenshotsRes?.results || [],
						isLoading: false,
						hasError: false
					})),
					catchError(() => of({ gameId: id, game: null, screenshots: [], isLoading: false, hasError: true })),
					startWith({ gameId: id, game: null, screenshots: [], isLoading: true, hasError: false })
				);
			})
		),
		{ initialValue: { gameId: null, game: null, screenshots: [], isLoading: true, hasError: false } }
	);

	// State exposed to the template as computed signals to keep HTML bindings working perfectly
	readonly gameId = computed(() => this.detailState().gameId);
	readonly game = computed(() => this.detailState().game);
	readonly screenshots = computed(() => this.detailState().screenshots);
	readonly isLoading = computed(() => this.detailState().isLoading);
	readonly hasError = computed(() => this.detailState().hasError);

	// Reactive signal to compute favorite status
	readonly isFavorite = computed(() => {
		const g = this.game();
		return g ? this.favoritesService.isFavorite(g.id) : false;
	});

	// Triggered by the "Riprova" button in the template
	fetchGameDetails(): void {
		this.refreshTrigger.update(v => v + 1);
	}

	// Extracts base game data to store in favorites without unnecessary heavy details
	toggleFavorite(): void {
		const g = this.game();
		if (!g) return;

		const gameSummary: Game = {
			id: g.id,
			name: g.name,
			slug: g.slug,
			released: g.released,
			backgroundImage: g.backgroundImage,
			rating: g.rating,
			metacritic: g.metacritic,
			platforms: g.platforms,
			parentPlatforms: g.parentPlatforms
		};

		this.favoritesService.toggleFavorite(gameSummary);
	}

/* 	MI SERVIVA PER TESTARE, DA TOGLIERE POI
	fetchGameDetails(id: number): void {
	this.isLoading = false;
	this.hasError = false;
	this.game = {
		id: id,
		name: 'The Legend of Zelda: Tears of the Kingdom',		slug: 'zelda-totk',
		released: '2023-05-12',
		backgroundImage: 'https://media.rawg.io/media/games/f99/f997966e3f22d05779ec364bc9a5f22e.jpg',
		rating: 4.8,
		metacritic: 96,
		descriptionRaw: 'An epic adventure across the land and skies of Hyrule awaits in The Legend of Zelda: Tears of the Kingdom for Nintendo Switch. In this sequel to Breath of the Wild, you’ll decide your own path through the sprawling landscapes of Hyrule and the mysterious islands floating in the vast skies above.',
		developers: [{ id: 1, name: 'Nintendo EPD', slug: 'nintendo-epd' }],
		publishers: [{ id: 1, name: 'Nintendo', slug: 'nintendo' }],
		genres: [
		{ id: 1, name: 'Action', slug: 'action' },
		{ id: 2, name: 'Adventure', slug: 'adventure' }
		],
		parentPlatforms: [
		{ platform: { id: 1, name: 'Nintendo Switch', slug: 'switch' } }
		]
	};
	this.screenshots = [
		{ id: 1, image: 'https://media.rawg.io/media/screenshots/a7e/a7e289f6479f8263884d5df656c9a3eb.jpg' },
		{ id: 2, image: 'https://media.rawg.io/media/screenshots/030/03080b0e50f5550a256f642a8b9e6040.jpg' },
		{ id: 3, image: 'https://media.rawg.io/media/screenshots/81d/81d2f785a21e64627d72111867dd1f68.jpg' },
		{ id: 4, image: 'https://media.rawg.io/media/screenshots/39a/39a66420e6e76d9bf84594689dd8880d.jpg' }
	];
	} */

	goBack(): void {
		// Navigation id 1 means the detail page was opened directly
		if (history.state?.navigationId > 1) {
			this.location.back();
			return ;
		}
		this.router.navigate(['/games']);
	}

	// Utility to determine the CSS class for the Metacritic score
	getMetacriticClass(score: number | null | undefined): string {
		if (score === null || score === undefined) return 'score-neutral';
		if (score >= 75) return 'score-high';
		if (score >= 50) return 'score-medium';
		return 'score-low';
	}
}