import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import {
  FieldTree,
  FormField,
  FormRoot,
  TreeValidationResult,
  email,
  form,
  required,
  validate,
} from '@angular/forms/signals';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TOO_MANY_ATTEMPTS_MESSAGE, passwordRulesMessage } from '../auth-errors';
import { AuthService } from '../auth.service';
import { RecoveryCode } from '../recovery-code/recovery-code';

interface RecoverModel {
  email: string;
  code: string;
  password: string;
  confirmPassword: string;
}

@Component({
  selector: 'app-recover',
  imports: [FormField, FormRoot, RecoveryCode],
  templateUrl: './recover.html',
})
export class Recover {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly model = signal<RecoverModel>({
    email: '',
    code: '',
    password: '',
    confirmPassword: '',
  });

  // Field errors appear from the first submit, as in Login.
  protected readonly submitted = signal(false);

  // The new code: the one just used stops working.
  protected readonly recoveryCode = signal<string | null>(null);

  // As in Register: password rules are checked only by auth-service.
  protected readonly recoverForm = form(
    this.model,
    (field) => {
      required(field.email, { message: "Inserisci l'email." });
      email(field.email, { message: "L'email non è valida." });
      required(field.code, { message: 'Inserisci il codice di recupero.' });
      required(field.password, { message: 'Inserisci la nuova password.' });
      validate(field.confirmPassword, ({ value, valueOf }) =>
        value() === valueOf(field.password)
          ? null
          : { kind: 'mismatch', message: 'Le password non coincidono.' },
      );
    },
    {
      submission: {
        action: async (field) => {
          const { email, code, password } = this.model();
          try {
            // The server compares the code exactly, and a wrong one counts toward the lockout:
            // a space pasted by mistake must not cost an attempt.
            const newCode = await firstValueFrom(this.auth.recover(email, code.trim(), password));
            this.recoveryCode.set(newCode);
          } catch (error) {
            return recoverErrors(error, field);
          }
          return undefined;
        },
      },
    },
  );

  // No login after a recovery: the user signs in with the new password.
  protected continue(): void {
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}

function recoverErrors(error: unknown, form: FieldTree<RecoverModel>): TreeValidationResult {
  if (error instanceof HttpErrorResponse && error.status === 400) {
    const passwordMessage = passwordRulesMessage(Object.keys(error.error?.errors ?? {}));
    return passwordMessage
      ? { kind: 'password', message: passwordMessage, fieldTree: form.password }
      : { kind: 'server', message: 'Dati non validi: controlla i campi e riprova.' };
  }
  if (error instanceof HttpErrorResponse && error.status === 401) {
    // Unknown email, wrong code and locked account get the same answer from the server.
    return { kind: 'server', message: 'Email o codice di recupero errati.' };
  }
  if (error instanceof HttpErrorResponse && error.status === 429) {
    return { kind: 'server', message: TOO_MANY_ATTEMPTS_MESSAGE };
  }
  return { kind: 'server', message: 'Recupero non riuscito: riprova più tardi.' };
}
