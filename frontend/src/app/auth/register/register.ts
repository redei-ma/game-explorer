import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import {
  FieldTree,
  FormField,
  TreeValidationResult,
  ValidationError,
  email,
  form,
  required,
  validate,
} from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  PASSWORD_RULES_HINT,
  TOO_MANY_ATTEMPTS_MESSAGE,
  isPasswordRule,
  passwordRulesMessage,
} from '../auth-errors';
import { AuthService } from '../auth.service';
import { FieldErrors } from '../field-errors/field-errors';
import { submitAgain } from '../submit-again';
import { RecoveryCode } from '../recovery-code/recovery-code';

interface RegisterModel {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

@Component({
  selector: 'app-register',
  imports: [FieldErrors, FormField, RecoveryCode, RouterLink],
  templateUrl: './register.html',
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly model = signal<RegisterModel>({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  protected readonly passwordHint = PASSWORD_RULES_HINT;

  // Field errors appear from the first submit, as in Login.
  protected readonly submitted = signal(false);

  // Only in this page: the server keeps just a hash, so the code cannot be shown again.
  protected readonly recoveryCode = signal<string | null>(null);

  // Password and username rules are checked only by auth-service.
  // The confirmation is not a server rule: it only catches a typo before the request.
  protected readonly registerForm = form(
    this.model,
    (field) => {
      required(field.email, { message: "Inserisci l'email." });
      email(field.email, { message: "L'email non è valida." });
      required(field.username, { message: 'Inserisci uno username.' });
      required(field.password, { message: 'Inserisci una password.' });
      validate(field.confirmPassword, ({ value, valueOf }) =>
        value() === valueOf(field.password)
          ? null
          : { kind: 'mismatch', message: 'Le password non coincidono.' },
      );
    },
    {
      submission: {
        action: async (field) => {
          const { email, username, password } = this.model();
          try {
            const response = await firstValueFrom(this.auth.register(email, username, password));
            this.recoveryCode.set(response.recoveryCode);
          } catch (error) {
            return registerErrors(error, field);
          }
          return undefined;
        },
      },
    },
  );

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitted.set(true);
    await submitAgain(this.model, this.registerForm);
  }

  // No automatic redirect after registering: the user leaves only after saving the code.
  // Replaces /register in the history, so Back goes to the page before it.
  protected continue(): void {
    this.router.navigateByUrl('/', { replaceUrl: true });
  }
}

// Keys of auth-service's 400 besides the password rules: field names from DataAnnotations,
// InvalidUserName from Identity. The numbers repeat [Length(3, 30)] on the username
// (AuthModels.cs) only in the text: the server still decides.
const fieldErrors: Record<string, { field: 'email' | 'username'; message: string }> = {
  Email: { field: 'email', message: "L'email non è valida." },
  Username: { field: 'username', message: 'Lo username deve avere da 3 a 30 caratteri.' },
  InvalidUserName: {
    field: 'username',
    message: 'Lo username può contenere solo lettere, numeri e i simboli - . _ @ +',
  },
};

function registerErrors(error: unknown, form: FieldTree<RegisterModel>): TreeValidationResult {
  if (error instanceof HttpErrorResponse && error.status === 400) {
    return validationErrors(Object.keys(error.error?.errors ?? {}), form);
  }
  if (error instanceof HttpErrorResponse && error.status === 409) {
    // Only the server's English text says which one is taken. A shared message does not hide
    // an existing email anyway: the same email with an unused username still gets 409.
    return { kind: 'server', message: 'Email o username già in uso.' };
  }
  if (error instanceof HttpErrorResponse && error.status === 429) {
    return { kind: 'server', message: TOO_MANY_ATTEMPTS_MESSAGE };
  }
  return { kind: 'server', message: 'Registrazione non riuscita: riprova più tardi.' };
}

// One message per key: a key can carry more than one text for the same rule.
function validationErrors(
  codes: string[],
  form: FieldTree<RegisterModel>,
): ValidationError.WithOptionalFieldTree[] {
  const errors: ValidationError.WithOptionalFieldTree[] = codes
    .filter((code) => !isPasswordRule(code))
    .map((code) => {
      const known = fieldErrors[code];
      return known
        ? { kind: code, message: known.message, fieldTree: form[known.field] }
        : { kind: code, message: 'Dati non validi: controlla i campi e riprova.' };
    });

  const passwordMessage = passwordRulesMessage(codes);
  if (passwordMessage) {
    errors.push({ kind: 'password', message: passwordMessage, fieldTree: form.password });
  }
  return errors;
}
