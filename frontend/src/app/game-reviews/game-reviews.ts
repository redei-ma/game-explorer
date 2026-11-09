import { ChangeDetectionStrategy, Component, Input, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GamesApi, Review } from '../games/games.api';
import { AuthService } from '../auth/auth.service';

@Component({
	selector: 'app-game-reviews',
	standalone: true,
	imports: [CommonModule, FormsModule],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: './game-reviews.html',
	styleUrls: ['./game-reviews.css']
})
export class GameReviews {
	private readonly gamesApi = inject(GamesApi);
	readonly authService = inject(AuthService);

	// Input signal equivalent using modern Angular set setter
	readonly gameIdSignal = signal<number | null>(null);

	@Input({ required: true }) set gameId(value: number | null) {
		this.gameIdSignal.set(value);
	}

	// Internal state
	readonly reviews = signal<Review[]>([]);
	readonly isLoading = signal<boolean>(true);
	readonly hasError = signal<boolean>(false);
	readonly isSubmitting = signal<boolean>(false);
	readonly submitError = signal<string | null>(null);

	// Form fields
	newRating = 5;
	newComment = '';

	// Average rating calculation
	readonly averageRating = computed(() => {
		const list = this.reviews();
		if (!list.length) return 0;
		const sum = list.reduce((acc, r) => acc + r.rating, 0);
		return (sum / list.length).toFixed(1);
	});

	constructor() {
		// Automatically fetch reviews whenever gameIdSignal updates
		effect(() => {
			const id = this.gameIdSignal();
			if (id !== null) {
				this.fetchReviews(id);
			}
		});
	}

	fetchReviews(id: number): void {
		this.isLoading.set(true);
		this.hasError.set(false);

		this.gamesApi.getGameReviews(id).subscribe({
			next: (res) => {
				this.reviews.set(res.results || []);
				this.isLoading.set(false);
			},
			error: () => {
				this.isLoading.set(false);
				this.hasError.set(true);
			}
		});
	}

	submitReview(): void {
		const id = this.gameIdSignal();
		if (id === null || !this.newComment.trim() || this.isSubmitting()) return;

		this.isSubmitting.set(true);
		this.submitError.set(null);

		this.gamesApi.createReview(id, {
			rating: this.newRating,
			comment: this.newComment.trim()
		}).subscribe({
			next: (createdReview) => {
				// Optimistically update list or append response
				this.reviews.update(prev => [createdReview, ...prev]);
				this.newComment = '';
				this.newRating = 5;
				this.isSubmitting.set(false);
			},
			error: () => {
				this.submitError.set('Errore durante l’invio della recensione. Riprova.');
				this.isSubmitting.set(false);
			}
		});
	}
}