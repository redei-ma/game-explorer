import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormField, FormRoot, email, form, required } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TOO_MANY_ATTEMPTS_MESSAGE } from '../auth-errors';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  imports: [FormField, FormRoot, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly model = signal({ email: '', password: '' });

  // Only "is it filled in": the password rules are checked at registration, and a wrong
  // password gets the same answer from the server as an unknown email.
  protected readonly loginForm = form(
    this.model,
    (field) => {
      required(field.email, { message: "Inserisci l'email." });
      email(field.email, { message: "L'email non è valida." });
      required(field.password, { message: 'Inserisci la password.' });
    },
    {
      submission: {
        action: async () => {
          const { email, password } = this.model();
          try {
            await firstValueFrom(this.auth.login(email, password));
          } catch (error) {
            return { kind: 'server', message: loginErrorMessage(error) };
          }
          // Replaces /login in the history, so Back goes to the page before it.
          await this.router.navigateByUrl('/', { replaceUrl: true });
          return undefined;
        },
      },
    },
  );
}

function loginErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 401) {
    return 'Email o password errate.';
  }
  if (error instanceof HttpErrorResponse && error.status === 429) {
    return TOO_MANY_ATTEMPTS_MESSAGE;
  }
  return 'Accesso non riuscito: riprova più tardi.';
}
