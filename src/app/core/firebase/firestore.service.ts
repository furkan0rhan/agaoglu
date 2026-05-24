import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  QueryConstraint,
  DocumentData,
  CollectionReference,
  DocumentReference,
} from '@angular/fire/firestore';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { LoggerService } from '../logging/logger.service';

@Injectable({ providedIn: 'root' })
export class FirestoreService {
  private readonly firestore = inject(Firestore);
  private readonly logger = inject(LoggerService);

  col<T>(path: string): CollectionReference<T> {
    return collection(this.firestore, path) as CollectionReference<T>;
  }

  docRef<T>(path: string): DocumentReference<T> {
    return doc(this.firestore, path) as DocumentReference<T>;
  }

  add<T extends DocumentData>(colPath: string, data: Omit<T, 'id'>): Observable<string> {
    const payload = { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    return from(addDoc(this.col(colPath), payload)).pipe(
      map(ref => ref.id),
      catchError(err => {
        this.logger.error('Firestore add error', colPath, err);
        return throwError(() => err);
      })
    );
  }

  update(colPath: string, id: string, data: Partial<DocumentData>): Observable<void> {
    const payload = { ...data, updatedAt: serverTimestamp() };
    return from(updateDoc(this.docRef(`${colPath}/${id}`), payload)).pipe(
      catchError(err => {
        this.logger.error('Firestore update error', colPath, id, err);
        return throwError(() => err);
      })
    );
  }

  delete(colPath: string, id: string): Observable<void> {
    return from(deleteDoc(this.docRef(`${colPath}/${id}`))).pipe(
      catchError(err => {
        this.logger.error('Firestore delete error', colPath, id, err);
        return throwError(() => err);
      })
    );
  }

  getById<T>(colPath: string, id: string): Observable<T | null> {
    return from(getDoc(this.docRef<T>(`${colPath}/${id}`))).pipe(
      map(snap => (snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null)),
      catchError(err => {
        this.logger.error('Firestore getById error', colPath, id, err);
        return throwError(() => err);
      })
    );
  }

  query$<T>(colPath: string, ...constraints: QueryConstraint[]): Observable<T[]> {
    return new Observable<T[]>(observer => {
      const q = query(this.col<T>(colPath), ...constraints);
      const unsub = onSnapshot(
        q,
        snap => observer.next(snap.docs.map(d => ({ id: d.id, ...d.data() } as T))),
        err => {
          this.logger.error('Firestore query$ error', colPath, err);
          observer.error(err);
        }
      );
      return () => unsub();
    });
  }

  batch() {
    return writeBatch(this.firestore);
  }
}
