import { Routes } from '@angular/router';
import { Home } from './home';
// We import the new page following the same style used for 'Home'
import { GamesList } from './games-list';

export const routes: Routes = [
	{ path: '', component: Home, title: 'Gaming Explorer' },
	// Route to the page with advanced search and grid
	{ path: 'games', component: GamesList, title: 'Ricerca Giochi' },
	
	// NB: /games/:id does not exist yet. Remove this fallback when it is added;
	// the redirect keeps query params, so unhandled routes land on Home without errors
	{ path: '**', redirectTo: '' },
];