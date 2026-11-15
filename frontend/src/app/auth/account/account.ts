import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, signal } from '@angular/core';
import { FieldTree, FormField, TreeValidationResult, form, required } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LibraryService } from '../../library/library.service';
import { TOO_MANY_ATTEMPTS_MESSAGE } from '../auth-errors';
import { AuthService } from '../auth.service';
import { FieldErrors } from '../field-errors/field-errors';
import { submitAgain } from '../submit-again';

@Component({
  selector: 'app-account',
  imports: [FieldErrors, FormField, RouterLink],
  templateUrl: './account.html',
})
export class Account {
  private readonly auth = inject(AuthService);
  private readonly library = inject(LibraryService);
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
          // The account is gone either way: if library fails, its data stays orphaned instead
          // of asking the user to retry.
          await firstValueFrom(this.library.deleteAll()).catch(() => undefined);
          await this.logout();
          return undefined;
        },
      },
    },
  );

  constructor() {
    // Also when the session ends from outside this page (another tab, expired cookie): a guest has
    // nothing to do here. Replaces /account in the history, so Back does not return to it.
    effect(() => {
      if (this.user() === null) {
        this.router.navigateByUrl('/', { replaceUrl: true });
      }
    });
  }

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
    }
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
  // The account is locked after too many wrong passwords, even if this one is right.
  if (error instanceof HttpErrorResponse && error.status === 429) {
    return { kind: 'server', message: TOO_MANY_ATTEMPTS_MESSAGE };
  }
  return { kind: 'server', message: 'Eliminazione non riuscita: riprova più tardi.' };
}
