import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'wzos-token';
  private readonly USER_KEY = 'wzos-user';
  private authenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
  private usernameSubject = new BehaviorSubject<string>(this.getStoredUsername() ?? '');

  constructor(private http: HttpClient) {}

  login(username: string, password: string): Observable<{ token: string }> {
    return this.http.post<{ token: string }>('/api/login', { username, password }).pipe(
      tap(res => {
        localStorage.setItem(this.TOKEN_KEY, res.token);
        localStorage.setItem(this.USER_KEY, username);
        this.authenticatedSubject.next(true);
        this.usernameSubject.next(username);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.authenticatedSubject.next(false);
    this.usernameSubject.next('');
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    return this.hasToken();
  }

  get authenticated$(): Observable<boolean> {
    return this.authenticatedSubject.asObservable();
  }

  get username$(): Observable<string> {
    return this.usernameSubject.asObservable();
  }

  get username(): string {
    return localStorage.getItem(this.USER_KEY) ?? '';
  }

  private hasToken(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY);
  }

  private getStoredUsername(): string | null {
    return localStorage.getItem(this.USER_KEY);
  }
}
