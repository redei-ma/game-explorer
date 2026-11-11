import { WritableSignal } from '@angular/core';
import { FieldTree, submit } from '@angular/forms/signals';

// Errors returned by the last submit keep a form invalid until a value changes, and Angular
// skips the action of an invalid form. Copying the model clears them, so pressing the button
// again retries with the same data, for example after "server unreachable".
export function submitAgain<T extends object>(
  model: WritableSignal<T>,
  form: FieldTree<T>,
): Promise<boolean> {
  model.update((value) => ({ ...value }));
  return submit(form);
}
