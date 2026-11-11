import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FieldTree, FormField, TreeValidationResult, form, required } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FavoritesService } from '../../favorites/favorites.service';
import { AuthService } from '../auth.service';
import { submitAgain } from '../submit-again';

@Component({
  selector: 'app-account',
  imports: [FormField, RouterLink],
  templateUrl: './account.html',
})
export class Account {
  private readonly auth = inject(AuthService);
  private readonly favorites = inject(FavoritesService);
  private readonly router = inject(Router);

  protected readonly user = this.auth.currentUser;
  protected readonly loggingOut = signal(false);
  protected readonly logoutError = signal<string | null>(null);

  private readonly deleteModel = signal({ password: '' });

  // Field errors appear from the first submit, as in Login.
  protected readonly submitted = signal(false);

  protected readonly deleteForm = form(
    this.deleteModel,
    (field) => {
      required(field.password, { message: 'Inserisci la password per confermare.' });
    },
    {
      submission: {
        action: async (field) => {
          try {
            await firstValueFrom(this.auth.deleteAccount(this.deleteModel().password));
          } catch (error) {
            return deleteAccountError(error, field);
          }
          // The account is gone either way: if library fails, its favorites stay orphaned (a known
          // limit in decisions.md) instead of asking the user to retry.
          await firstValueFrom(this.favorites.deleteAll()).catch(() => undefined);
          await this.logout();
          return undefined;
        },
      },
    },
  );

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitted.set(true);
    await submitAgain(this.deleteModel, this.deleteForm);
  }

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

function deleteAccountError(
  error: unknown,
  form: FieldTree<{ password: string }>,
): TreeValidationResult {
  // 403 and not 401: the session is valid, only the password is wrong (auth-service).
  if (error instanceof HttpErrorResponse && error.status === 403) {
    return { kind: 'server', message: 'Password errata.', fieldTree: form.password };
  }
  return { kind: 'server', message: 'Eliminazione non riuscita: riprova più tardi.' };
}
