import { Routes } from '@angular/router';
import { Home } from './home/home';
import { GamesList } from './games/games-list';
import { GameDetail } from './game-detail/game-detail';
import { FavoritesList } from './favorites/favorites-list';
import { WishlistList } from './wishlist/wishlist-list';
import { NotFound } from './not-found/not-found';
import { guestGuard, loggedInGuard } from './auth/auth.guards';

export const routes: Routes = [
	{ path: '', component: Home, title: 'Novaquest' },
	// Route to the page with advanced search and grid
	{ path: 'games', component: GamesList, title: 'Ricerca Giochi' },
	// Route to the individual game detail sheet
	{ path: 'games/:id', component: GameDetail, title: 'Dettagli Gioco' },
	// Route to the user's favorite games section
	{ path: 'favorites', component: FavoritesList, title: 'I miei Preferiti' },
	// Route to the user's wishlist
	{ path: 'wishlist', component: WishlistList, title: 'Wishlist' },
	{
		path: 'login',
		loadComponent: () => import('./auth/login/login').then((m) => m.Login),
		canActivate: [guestGuard],
		title: 'Accedi',
	},
	{
		path: 'register',
		loadComponent: () => import('./auth/register/register').then((m) => m.Register),
		canActivate: [guestGuard],
		title: 'Crea il tuo account',
	},
	{
		path: 'recover',
		loadComponent: () => import('./auth/recover/recover').then((m) => m.Recover),
		canActivate: [guestGuard],
		title: 'Password dimenticata',
	},
	{
		path: 'account',
		loadComponent: () => import('./auth/account/account').then((m) => m.Account),
		canActivate: [loggedInGuard],
		title: 'Il tuo account',
	},
	
	{ path: '**', component: NotFound, title: 'Pagina non trovata' },
];