import { ChangeDetectionStrategy, Component, ElementRef, HostListener, OnDestroy, inject, signal, computed, viewChild } from '@angular/core';
import { CommonModule, DOCUMENT, Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { forkJoin, of, combineLatest, Observable } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';
import { GamesApi, GameDetailData, Screenshot, Game } from '../games/games.api';
import { FavoritesService } from '../favorites/favorites.service';
import { WishlistService } from '../wishlist/wishlist.service';

// Internal state interface for reactive HTTP calls
interface DetailState {
	gameId: number | null;
	game: GameDetailData | null;
	screenshots: Screenshot[];
	isLoading: boolean;
	error: 'not-found' | 'load' | null;
}

@Component({
	selector: 'app-game-detail',
	standalone: true,
	imports: [CommonModule, RouterModule],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: './game-detail.html',
	styleUrls: ['./game-detail.css']
})
export class GameDetail implements OnDestroy {
	private readonly gamesApi = inject(GamesApi);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	readonly location = inject(Location);
	private readonly favoritesService = inject(FavoritesService);
	private readonly wishlistService = inject(WishlistService);
	private readonly document = inject(DOCUMENT);
	private readonly closeLightboxButton = viewChild<ElementRef<HTMLButtonElement>>('closeLightboxButton');
	private lightboxTrigger: HTMLElement | null = null;
	private previousBodyOverflow = '';

	// Trigger to manually re-fetch data from the UI (error banner)
	private readonly refreshTrigger = signal(0);

	// Reloads when the id in the URL changes or Riprova is pressed
	private readonly detailState = toSignal(
		combineLatest([
			this.route.paramMap,
			toObservable(this.refreshTrigger)
		]).pipe(
			switchMap(([params]): Observable<DetailState> => {
				const idParam = params.get('id');
				if (!idParam) {
					return of({ gameId: null, game: null, screenshots: [], isLoading: false, error: 'not-found' as const });
				}
				const id = parseInt(idParam, 10);

				// Detail and screenshots in parallel: a failed screenshots request must not hide the game
				return forkJoin({
					detail: this.gamesApi.getGame(id),
					screenshotsRes: this.gamesApi.getScreenshots(id).pipe(catchError(() => of(null)))
				}).pipe(
					map(({ detail, screenshotsRes }) => ({
						gameId: id,
						game: detail,
						screenshots: screenshotsRes?.results || [],
						isLoading: false,
						error: null
					})),
					catchError((error: HttpErrorResponse) => of({
						gameId: id,
						game: null,
						screenshots: [],
						isLoading: false,
						error: error.status === 404 ? 'not-found' as const : 'load' as const
					})),
					startWith({ gameId: id, game: null, screenshots: [], isLoading: true, error: null })
				);
			})
		),
		{ initialValue: { gameId: null, game: null, screenshots: [], isLoading: true, error: null } satisfies DetailState }
	);

	readonly gameId = computed(() => this.detailState().gameId);
	readonly game = computed(() => this.detailState().game);
	readonly screenshots = computed(() => this.detailState().screenshots);
	readonly isLoading = computed(() => this.detailState().isLoading);
	readonly error = computed(() => this.detailState().error);
	readonly hasError = computed(() => this.error() !== null);
	readonly selectedScreenshotIndex = signal<number | null>(null);
	readonly selectedScreenshot = computed(() => {
		const index = this.selectedScreenshotIndex();
		return index === null ? null : this.screenshots()[index] ?? null;
	});

	// Reactive signal to compute favorite status
	readonly isFavorite = computed(() => {
		const g = this.game();
		return g ? this.favoritesService.isFavorite(g.id) : false;
	});

	// Reactive signal to compute wishlist status independently from favorites.
	readonly isInWishlist = computed(() => {
		const g = this.game();
		return g ? this.wishlistService.isInWishlist(g.id) : false;
	});

	fetchGameDetails(): void {
		this.refreshTrigger.update(v => v + 1);
	}

	openScreenshot(index: number, event: Event): void {
		this.selectedScreenshotIndex.set(index);
		this.lightboxTrigger = event.currentTarget as HTMLElement;
		this.previousBodyOverflow = this.document.body.style.overflow;
		this.document.body.style.overflow = 'hidden';
		setTimeout(() => this.closeLightboxButton()?.nativeElement.focus());
	}

	closeScreenshot(): void {
		this.selectedScreenshotIndex.set(null);
		this.document.body.style.overflow = this.previousBodyOverflow;
		this.lightboxTrigger?.focus();
		this.lightboxTrigger = null;
	}

	// Leaving the page with the lightbox open (e.g. the browser's Back) skips closeScreenshot
	ngOnDestroy(): void {
		if (this.selectedScreenshotIndex() !== null) {
			this.document.body.style.overflow = this.previousBodyOverflow;
		}
	}

	showPreviousScreenshot(): void {
		const index = this.selectedScreenshotIndex();
		if (index === null || this.screenshots().length === 0) return;
		this.selectedScreenshotIndex.set((index - 1 + this.screenshots().length) % this.screenshots().length);
	}

	showNextScreenshot(): void {
		const index = this.selectedScreenshotIndex();
		if (index === null || this.screenshots().length === 0) return;
		this.selectedScreenshotIndex.set((index + 1) % this.screenshots().length);
	}

	@HostListener('document:keydown', ['$event'])
	handleLightboxKeydown(event: KeyboardEvent): void {
		if (this.selectedScreenshotIndex() === null) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			this.closeScreenshot();
		} else if (event.key === 'ArrowLeft') {
			event.preventDefault();
			this.showPreviousScreenshot();
		} else if (event.key === 'ArrowRight') {
			event.preventDefault();
			this.showNextScreenshot();
		}
	}

	// Builds the same shape as a list item (cover + platform groups), so the favorite's
	// card looks exactly like the card in the game list
	toggleFavorite(): void {
		const g = this.game();
		if (!g) return;

		const card: Game = {
			id: g.id,
			name: g.name,
			slug: g.slug,
			released: g.released,
			backgroundImage: g.coverImage ?? null,
			rating: g.rating,
			metacritic: g.metacritic,
			parentPlatforms: g.parentPlatforms
		};

		this.favoritesService.toggleFavorite(card);
	}

	// Uses the same lightweight card shape as favorites for the wishlist request.
	toggleWishlist(): void {
		const g = this.game();
		if (!g) return;

		const card: Game = {
			id: g.id,
			name: g.name,
			slug: g.slug,
			released: g.released,
			backgroundImage: g.coverImage ?? null,
			rating: g.rating,
			metacritic: g.metacritic,
			parentPlatforms: g.parentPlatforms,
		};

		this.wishlistService.toggleWishlist(card);
	}

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
