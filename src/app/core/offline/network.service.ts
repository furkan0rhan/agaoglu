import { Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, Observable, shareReplay } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NetworkService {
  readonly isOnline$: Observable<boolean> = new Observable<boolean>(observer => {
    observer.next(navigator.onLine);
    const online = () => observer.next(true);
    const offline = () => observer.next(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }).pipe(distinctUntilChanged(), shareReplay(1));

  readonly isOnline = toSignal(this.isOnline$, { initialValue: navigator.onLine });
}
