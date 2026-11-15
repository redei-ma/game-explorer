import { Component, input } from '@angular/core';

// Registration and recovery both show a new code that the server keeps only as a hash.
@Component({
  selector: 'app-recovery-code',
  templateUrl: './recovery-code.html',
})
export class RecoveryCode {
  readonly code = input.required<string>();
}
