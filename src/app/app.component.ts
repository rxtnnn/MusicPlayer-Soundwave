import { Component, OnInit } from '@angular/core';
import { Platform } from '@ionic/angular';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { ThemeService } from './service/theme.service';
import { StorageService } from './service/storage.service';
import { AudioService } from './service/audio.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {

  constructor(
    private platform: Platform,
    private themeService: ThemeService,
    private storageService: StorageService,
    private audioService: AudioService
  ) {
    this.initializeApp();
  }

  async initializeApp() {
    await this.platform.ready();

    // Initialize services
    await this.storageService.init();
    await this.themeService.initialize();

    // Set status bar style based on theme
    this.themeService.darkMode$.subscribe(async (isDark) => {
      if (this.platform.is('capacitor')) {
        try {
          if (isDark) {
            await StatusBar.setStyle({ style: Style.Dark });
          } else {
            await StatusBar.setStyle({ style: Style.Light });
          }
        } catch (error) {
          console.error('Error setting status bar style', error);
        }
      }
    });

    // Hide splash screen
    try {
      await SplashScreen.hide();
    } catch (error) {
      console.error('Error hiding splash screen', error);
    }

  async function setupCustomSplashScreen() {
  // Create the splash screen element
  const splashElement = document.createElement('div');
  splashElement.className = 'custom-splash';

  // Logo element
  const logoElement = document.createElement('div');
  logoElement.className = 'splash-logo';

  // App name
  const nameElement = document.createElement('div');
  nameElement.className = 'splash-name';
  nameElement.textContent = 'Melodify';

  // Loading spinner
  const spinnerElement = document.createElement('div');
  spinnerElement.className = 'splash-spinner';

  // Append elements
  splashElement.appendChild(logoElement);
  splashElement.appendChild(nameElement);
  splashElement.appendChild(spinnerElement);

  // Add to document
  document.body.appendChild(splashElement);

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .custom-splash {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: linear-gradient(135deg, #6200EA 0%, #B388FF 100%);
      z-index: 999999;
      transition: opacity 0.5s ease-out;
    }

    .splash-logo {
      width: 120px;
      height: 120px;
      background-color: white;
      border-radius: 50%;
      margin-bottom: 24px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      position: relative;
      overflow: hidden;
    }

    .splash-logo:before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 40px;
      height: 40px;
      background-color: #6200EA;
      transform: translate(-50%, -50%);
      mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z'/%3E%3C/svg%3E");
      mask-size: contain;
      mask-repeat: no-repeat;
      mask-position: center;
    }

    .splash-name {
      color: white;
      font-size: 32px;
      font-weight: bold;
      margin-bottom: 32px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .splash-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 1s infinite linear;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .fade-out {
      opacity: 0;
    }
  `;

  document.head.appendChild(style);

  // Return a function to hide the splash screen
  return function hideSplash() {
    splashElement.classList.add('fade-out');
    setTimeout(() => {
      if (splashElement.parentNode) {
        splashElement.parentNode.removeChild(splashElement);
      }
    }, 500);
  };
}

// Usage in app.component.ts
const hideSplash = await setupCustomSplashScreen();

// Later, when app is ready (after platform.ready() and services initialization):
  hideSplash();
}

  ngOnInit() {
    // Initialize anything else needed
  }


}
