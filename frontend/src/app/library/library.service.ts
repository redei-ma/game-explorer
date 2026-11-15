import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';

// Requests about everything library-service stores for the user, across all lists.
@Service()
export class LibraryService {
  private readonly http = inject(HttpClient);

  // Used when the account is deleted: library-service removes favorites and wishlist together.
  deleteAll(): Observable<void> {
    return this.http.delete<void>('/api/library');
  }
}
