import { Routes } from '@angular/router';
import { Home } from './home/home';
import { GamesList } from './games/games-list';
import { GameDetail } from './game-detail/game-detail';
import { FavoritesList } from './favorites/favorites-list';

export const routes: Routes = [
	{ path: '', component: Home, title: 'Gaming Explorer' },
	// Route to the page with advanced search and grid
	{ path: 'games', component: GamesList, title: 'Ricerca Giochi' },
	// Route to the individual game detail sheet
	{ path: 'games/:id', component: GameDetail, title: 'Dettagli Gioco' },
	// Route to the user's favorite games section
	{ path: 'favorites', component: FavoritesList, title: 'I miei Preferiti' },
	{
		path: 'login',
		loadComponent: () => import('./auth/login/login').then((m) => m.Login),
		title: 'Accedi',
	},
	
	// NB: /games & /games/:id routes are now active. Unhandled routes land on Home without errors
	{ path: '**', redirectTo: '' },
];