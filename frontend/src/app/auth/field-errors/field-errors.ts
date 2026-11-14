import { Component, input } from '@angular/core';
import { FieldTree } from '@angular/forms/signals';

// Every auth form shows a field's errors the same way, only after the first submit.
@Component({
  selector: 'app-field-errors',
  templateUrl: './field-errors.html',
})
export class FieldErrors {
  readonly field = input.required<FieldTree<string>>();
  readonly show = input(false);
}
