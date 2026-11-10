import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// Component used to display a "Not Found" page when the user navigates to a route
// that does not exist in the application
@Component({
	selector: 'app-not-found',
	imports: [RouterLink],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: './not-found.html',
	styleUrl: './not-found.css',
})
export class NotFound {}
