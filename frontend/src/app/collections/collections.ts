import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, from, map, mergeMap, of } from 'rxjs';
import { Game, Genre } from '../games/games.api';
import { CollectionsService } from './collections.service';

type SectionStatus = 'loading' | 'ready' | 'error';

interface Section {
	genre: Genre;
	status: SectionStatus;
	games: Game[];
}

interface SectionResult {
	id: number;
	status: SectionStatus;
	games: Game[];
}

// One request per genre, a few at a time: the page does not fire them all together
const MAX_PARALLEL_REQUESTS = 4;

@Component({
	selector: 'app-collections',
	imports: [RouterLink, DatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: './collections.html',
	styleUrl: './collections.css',
})
export class Collections {
	private readonly collections = inject(CollectionsService);
	private readonly destroyRef = inject(DestroyRef);

	// Coming from a home block the link is /collections?genre=<slug>: that genre's Top 10 opens by itself
	private readonly requestedSlug = inject(ActivatedRoute).snapshot.queryParamMap.get('genre');
	private requestHandled = false;
	private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

	protected readonly genresStatus = signal<SectionStatus>('loading');
	protected readonly sections = signal<Section[]>([]);

	// Covers shown on each card, and the placeholders shown while a genre is loading
	protected readonly previewCount = 3;
	protected readonly posterSkeletons = Array.from({ length: this.previewCount }, (_, i) => i);

	// A genre with no game that has a Metascore would be an empty card: it is not shown
	protected readonly visibleSections = computed(() =>
		this.sections().filter((section) => section.status !== 'ready' || section.games.length > 0),
	);

	// Genre whose Top 10 is open in the dialog. Only the id is kept, so the dialog reads the live section
	protected readonly selectedId = signal<number | null>(null);
	protected readonly selected = computed(() => {
		const id = this.selectedId();
		return id === null ? null : (this.sections().find((section) => section.genre.id === id) ?? null);
	});

	constructor() {
		this.load();
	}

	protected load(): void {
		this.genresStatus.set('loading');
		this.collections
			.getGenres()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (genres) => {
					this.sections.set(genres.map((genre): Section => ({ genre, status: 'loading', games: [] })));
					this.genresStatus.set('ready');
					this.loadGames(genres);
				},
				error: () => this.genresStatus.set('error'),
			});
	}

	protected retry(genre: Genre): void {
		this.updateSection({ id: genre.id, status: 'loading', games: [] });
		this.loadGames([genre]);
	}

	protected open(id: number, dialog: HTMLDialogElement): void {
		this.selectedId.set(id);
		dialog.showModal();
	}

	// Each card fills in as soon as its own answer arrives, and a failed one does not block the others
	private loadGames(genres: Genre[]): void {
		from(genres)
			.pipe(
				mergeMap(
					(genre) =>
						this.collections.getTopGames(genre).pipe(
							map((games): SectionResult => ({ id: genre.id, status: 'ready', games })),
							catchError(() => of<SectionResult>({ id: genre.id, status: 'error', games: [] })),
						),
					MAX_PARALLEL_REQUESTS,
				),
				takeUntilDestroyed(this.destroyRef),
			)
			.subscribe((result) => this.updateSection(result));
	}

	private updateSection(result: SectionResult): void {
		this.sections.update((sections) =>
			sections.map((section) =>
				section.genre.id === result.id ? { ...section, status: result.status, games: result.games } : section,
			),
		);
		this.openRequested();
	}

	// Runs after every answer: opens the requested genre once, as soon as its data is in
	private openRequested(): void {
		const dialog = this.dialog()?.nativeElement;
		if (this.requestHandled || !this.requestedSlug || !dialog) return;
		const section = this.sections().find((s) => s.genre.slug === this.requestedSlug);
		if (section?.status !== 'ready') return;
		this.requestHandled = true;
		if (section.games.length > 0) this.open(section.genre.id, dialog);
	}

	protected platformNames(game: Game): string {
		return (game.parentPlatforms ?? []).slice(0, 3).map((p) => p.platform.name).join(' · ');
	}

	protected pad(n: number): string {
		return String(n).padStart(2, '0');
	}
}