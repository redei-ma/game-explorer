import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameCard } from '../game-card/game-card';
import { WishlistService } from './wishlist.service';

// Component responsible for displaying the user's wishlist games grid
@Component({
	selector: 'app-wishlist-list',
	standalone: true,
	imports: [RouterLink, GameCard],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: './wishlist-list.html',
	styleUrl: './wishlist-list.css',
})
export class WishlistList {
	protected readonly wishlistService = inject(WishlistService);
	protected readonly wishlist = this.wishlistService.wishlist;
}
