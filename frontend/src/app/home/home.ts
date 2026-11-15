import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { GameCard } from '../game-card/game-card';
import { Game, GamesApi, GamesQuery } from '../games/games.api';
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

@Component({
	selector: 'app-home',
	imports: [RouterLink, GameCard, HeroParticles, DatePipe, NgTemplateOutlet],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: './home.html',
	styleUrl: './home.css',
})
export class Home {
	private readonly api = inject(GamesApi);
	protected readonly currentUser = inject(AuthService).currentUser;

	// Data layer: loaded from RAWG through the catalog-service
	protected readonly popular = rxResource({ stream: () => this.api.getGames(popularQuery()) });
	protected readonly skeletons = Array.from({ length: POPULAR_COUNT }, (_, i) => i);
	protected readonly upcoming = rxResource({ stream: () => this.api.getGames(upcomingQuery()) });
	protected readonly topOfYear = rxResource({ stream: () => this.api.getGames(topOfYearQuery()) });
	protected readonly rowSkeletons = Array.from({ length: LIST_COUNT }, (_, i) => i);
	protected readonly currentYear = new Date().getFullYear();

	// Static content
	protected readonly features = [
	{ n: '01', title: 'Naviga senza confini', text: 'Sfoglia un archivio sterminato di titoli e piattaforme per scovare subito l’esperienza giusta per te.' },
	{ n: '02', title: 'Fissa i tuoi punti cardinali', text: 'Aggiungi ai preferiti i giochi indimenticabili per ritrovarli in un attimo ogni volta che vuoi.' },
	{ n: '03', title: 'Traccia le prossime missioni', text: 'Salva in wishlist le uscite e i recuperi in programma per non perdere mai di vista il prossimo obiettivo.' },
	];

	protected readonly lists = [
	{ title: 'Giochi da riscoprire', desc: 'Una selezione di titoli da recuperare', count: 18, posters: [1, 2, 3] },
	{ title: 'Avventure da vivere', desc: 'Storie che meritano di essere vissute', count: 25, posters: [2, 3, 4] },
	{ title: 'Preferiti di sempre', desc: 'I titoli che non smettono di appassionarci', count: 32, posters: [3, 4, 5] },
	];

	protected platformNames(game: Game): string {
	return (game.parentPlatforms ?? []).slice(0, 3).map((p) => p.platform.name).join(' · ');
	}

	protected pad(n: number): string {
	return String(n).padStart(2, '0');
	}
}