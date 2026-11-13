import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Game } from '../games/games.api';
import { FavoritesService } from '../favorites/favorites.service';
import { WishlistService } from '../wishlist/wishlist.service';

/* Reusable game card: cover, title, release date, average rating, main platforms.
   Used by the Home grid now and by the search results list later */
@Component({
	selector: 'app-game-card',
	imports: [RouterLink, DatePipe, DecimalPipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: './game-card.html',
	styleUrl: './game-card.css',
})
export class GameCard {
	// Inject FavoritesService & wishlistService to manage the favorite and wishlist state
	private readonly favoritesService = inject(FavoritesService);
	private readonly wishlistService = inject(WishlistService);

	readonly game = input.required<Game>();
	// Optional rank shown on the cover ("01", "02", ...)
	readonly index = input<number>();

	// 'wishlist' replaces the favorite heart with a quick "remove from wishlist" button
	readonly mode = input<'default' | 'wishlist'>('default');

	// Reactive computed signal to check if the current game is favorited
	protected readonly isFavorite = computed(() =>
		this.favoritesService.isFavorite(this.game().id)
	);

	protected readonly label = computed(() => {
		const i = this.index();
		return i === undefined ? '' : String(i).padStart(2, '0');
	});

	protected readonly platforms = computed(() =>
		(this.game().parentPlatforms ?? [])
			.slice(0, 3)
			.map((p) => p.platform.name)
			.join(' · '),
	);

	// Handles click on heart button, preventing navigation to the details page
	protected toggleFavorite(event: MouseEvent): void {
		event.preventDefault();
		event.stopPropagation();
		this.favoritesService.toggleFavorite(this.game());
	}
	// Removes the game from the wishlist, preventing navigation to the details page
	protected removeFromWishlist(event: MouseEvent): void {
		event.preventDefault();
		event.stopPropagation();
		this.wishlistService.toggleWishlist(this.game());
	}
}
