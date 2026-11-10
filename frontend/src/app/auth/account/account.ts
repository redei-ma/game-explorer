import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-account',
  imports: [RouterLink],
  templateUrl: './account.html',
})
export class Account {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly user = this.auth.currentUser;
  protected readonly loggingOut = signal(false);
  protected readonly logoutError = signal<string | null>(null);

  protected async logout(): Promise<void> {
    this.loggingOut.set(true);
    this.logoutError.set(null);
    try {
      await firstValueFrom(this.auth.logout());
    } catch {
      this.logoutError.set('Uscita non riuscita: riprova.');
      this.loggingOut.set(false);
      return;
    }
    // Replaces /account in the history, so Back does not return to a page for logged-in users.
    await this.router.navigateByUrl('/', { replaceUrl: true });
  }
}
