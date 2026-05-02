import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent {
  @Output() loginSuccess = new EventEmitter<void>();

  username = '';
  password = '';
  loading = false;
  errorMsg = '';

  constructor(
    private authService: AuthService
  ) {}

  onLogin(): void {
    if (!this.username || !this.password) {
      this.errorMsg = '请输入用户名和密码';
      return;
    }

    this.loading = true;
    this.errorMsg = '';
    this.authService.login(this.username, this.password).subscribe({
      next: () => {
        console.log('Login successful');
        this.loading = false;
        this.loginSuccess.emit();
      },
      error: (err) => {
        console.error('Login error:', err);
        this.loading = false;
        this.errorMsg = err.error?.error || '用户名或密码错误';
      }
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.onLogin();
    }
  }
}
