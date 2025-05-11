import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { StorageService } from './storage.service';
import { Platform } from '@ionic/angular';

export type AppTheme = 'dark' | 'light';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private darkMode = new BehaviorSubject<boolean>(true);
  public darkMode$ = this.darkMode.asObservable();

  constructor(
    private storage: StorageService,
    private platform: Platform
  ) {}

  /**
   * Initialize theme from storage or system preference
   */
  async initialize() {
    // Wait for platform to be ready
    await this.platform.ready();

    // First try to get from storage
    const storedTheme = await this.storage.getItem('app_theme');

    if (storedTheme) {
      this.setTheme(storedTheme === 'dark');
    } else {
      // Use system preference as fallback
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
      this.setTheme(prefersDark.matches);

      // Listen for changes in system preference
      prefersDark.addEventListener('change', (mediaQuery) => this.setTheme(mediaQuery.matches));
    }
  }

  /**
   * Set the app theme
   * @param isDark Whether to use dark theme
   */
  async setTheme(isDark: boolean) {
    // Update document body with theme class
    document.body.classList.toggle('dark', isDark);

    // Save to observable
    this.darkMode.next(isDark);

    // Save to storage
    await this.storage.setItem('app_theme', isDark ? 'dark' : 'light');
  }

  /**
   * Toggle between light and dark themes
   */
  async toggleTheme() {
    const isDark = !this.darkMode.value;
    await this.setTheme(isDark);
    return isDark;
  }

  /**
   * Get current theme
   */
  getCurrentTheme(): AppTheme {
    return this.darkMode.value ? 'dark' : 'light';
  }
}
