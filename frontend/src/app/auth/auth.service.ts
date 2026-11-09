/* TEMPORARY MOCK AUTHENTICATION SERVICE
 * -----------------------------------------------------------------------------
 * This service provides a dummy user state using Angular Signals for UI development 
 * and testing purposes (e.g., toggling between logged-in user and anonymous visitor).
 * 
 * Once real backend authentication (JWT/OAuth) is ready, replace the mock signal 
 * updates in this file with real auth logic. The public interface (`currentUser`, 
 * `isLoggedIn`) should remain unchanged to avoid breaking dependent UI components.*/

import { Injectable, signal, computed } from '@angular/core';

export interface UserProfile {
	id: string;
	name: string;
	email: string;
}

@Injectable({
	providedIn: 'root'
})
export class AuthService {
	// Mock user state: set to null to test anonymous visitor mode
	readonly currentUser = signal<UserProfile | null>({
		id: 'usr-123',
		name: 'Mario Rossi',
		email: 'mario.rossi@example.com'
	});

	// Reactive boolean signal for fast status check in components
	readonly isLoggedIn = computed(() => this.currentUser() !== null);

	// Helper methods to manually toggle state while testing UI
	loginAsMockUser(): void {
		this.currentUser.set({
			id: 'usr-123',
			name: 'Mario Rossi',
			email: 'mario.rossi@example.com'
		});
	}

	logout(): void {
		this.currentUser.set(null);
	}
}