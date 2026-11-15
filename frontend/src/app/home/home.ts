import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { RouterLink } from '@angular/router';
import { GameCard } from '../game-card/game-card';
import { Game, GamesApi, GamesQuery, Genre } from '../games/games.api';
import { CollectionsService } from '../collections/collections.service';
import { AuthService } from '../auth/auth.service';
import { HeroParticles } from '../hero-particles/hero-particles';


// Popular this week = most added games released in the last N days
const POPULAR_WINDOW_DAYS = 7;
const POPULAR_COUNT = 6;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function popularQuery(): GamesQuery {
	const end = new Date();
	const start = new Date();
	start.setDate(end.getDate() - POPULAR_WINDOW_DAYS);
	return { dates: `${isoDay(start)},${isoDay(end)}`, ordering: '-added', pageSize: POPULAR_COUNT };
}

// Upcoming = most added games releasing in the next N days
const UPCOMING_WINDOW_DAYS = 30;
const LIST_COUNT = 6;

function upcomingQuery(): GamesQuery {
	const start = new Date();
	const end = new Date();
	end.setDate(start.getDate() + UPCOMING_WINDOW_DAYS);
	return { dates: `${isoDay(start)},${isoDay(end)}`, ordering: '-added', pageSize: LIST_COUNT };
}

// Best of the current year by Metacritic (60+ keeps unrated games out)
function topOfYearQuery(): GamesQuery {
	const year = new Date().getFullYear();
	return { dates: `${year}-01-01,${year}-12-31`, ordering: '-metacritic', metacritic: '60,100', pageSize: LIST_COUNT };
}

// Collections preview: the most mainstream IGDB genres, by id, in the order shown.
// IGDB has no "Action" genre. 31 = Adventure, 12 = Role-playing (RPG), 5 = Shooter, 15 = Strategy
const PREVIEW_GENRE_IDS = [31, 12, 5, 15];
const PREVIEW_COVERS = 3;

interface CollectionPreview {
	genre: Genre;
	games: Game[];
}

@Component({
	selector: 'app-home',
	imports: [RouterLink, GameCard, HeroParticles, DatePipe, NgTemplateOutlet],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: './home.html',
	styleUrl: './home.css',
})
export class Home {
	private readonly api = inject(GamesApi);
	private readonly collectionsService = inject(CollectionsService);
	protected readonly currentUser = inject(AuthService).currentUser;

	// Data layer: loaded from RAWG through the catalog-service
	protected readonly popular = rxResource({ stream: () => this.api.getGames(popularQuery()) });
	protected readonly skeletons = Array.from({ length: POPULAR_COUNT }, (_, i) => i);
	protected readonly upcoming = rxResource({ stream: () => this.api.getGames(upcomingQuery()) });
	protected readonly topOfYear = rxResource({ stream: () => this.api.getGames(topOfYearQuery()) });
	protected readonly rowSkeletons = Array.from({ length: LIST_COUNT }, (_, i) => i);
	protected readonly currentYear = new Date().getFullYear();
	// Collections preview: top games of a few genres, from the same data as /collections
	protected readonly collectionsPreview = rxResource({
		stream: () =>
			this.collectionsService.getGenres().pipe(
				switchMap((genres) => {
					const picked = PREVIEW_GENRE_IDS
						.map((id) => genres.find((genre) => genre.id === id))
						.filter((genre): genre is Genre => genre !== undefined);
					if (picked.length === 0) return of<CollectionPreview[]>([]);
					return forkJoin(
						picked.map((genre) =>
							this.collectionsService.getTopGames(genre).pipe(map((games): CollectionPreview => ({ genre, games }))),
						),
					);
				}),
				// A genre with no game that has a Metascore would be an empty card
				map((items) => items.filter((item) => item.games.length > 0)),
			),
	});
	protected readonly previewSkeletons = Array.from({ length: PREVIEW_GENRE_IDS.length }, (_, i) => i);
	protected readonly previewCovers = PREVIEW_COVERS;
	protected readonly coverSkeletons = Array.from({ length: PREVIEW_COVERS }, (_, i) => i);

	// Static content
	protected readonly features = [
	{ n: '01', title: 'Naviga senza confini', text: 'Sfoglia un archivio sterminato di titoli e piattaforme per scovare subito l’esperienza giusta per te.' },
	{ n: '02', title: 'Fissa i tuoi punti cardinali', text: 'Aggiungi ai preferiti i giochi indimenticabili per ritrovarli in un attimo ogni volta che vuoi.' },
	{ n: '03', title: 'Traccia le prossime missioni', text: 'Salva in wishlist le uscite e i recuperi in programma per non perdere mai di vista il prossimo obiettivo.' },
	];

	protected platformNames(game: Game): string {
	return (game.parentPlatforms ?? []).slice(0, 3).map((p) => p.platform.name).join(' · ');
	}

	protected pad(n: number): string {
	return String(n).padStart(2, '0');
	}
}