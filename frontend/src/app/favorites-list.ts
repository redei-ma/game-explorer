import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FavoritesService } from './favorites.service';
import { GameCard } from './game-card';

// Component responsible for displaying the user's favorite games grid
@Component({
	selector: 'app-favorites-list',
	standalone: true,
	imports: [RouterLink, GameCard],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: './favorites-list.html',
	styleUrl: './favorites-list.css'
})
export class FavoritesList {
	protected readonly favoritesService = inject(FavoritesService);
	// Bind directly to the service's reactive signal
	protected readonly favorites = this.favoritesService.favorites;
}