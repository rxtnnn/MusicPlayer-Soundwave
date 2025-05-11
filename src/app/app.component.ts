// app.component.ts
import { Component, OnInit } from '@angular/core';
import { Platform } from '@ionic/angular';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar } from '@ionic-native/status-bar/ngx';
import { ThemeService } from './core/services/theme.service';
import { StorageService } from './core/services/storage.service';
import { AudioService } from './core/services/audio.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  constructor(
    private platform: Platform,
    private splashScreen: SplashScreen,
    private statusBar: StatusBar,
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
    this.themeService.darkMode$.subscribe(isDark => {
      if (this.platform.is('cordova')) {
        if (isDark) {
          this.statusBar.styleLightContent();
        } else {
          this.statusBar.styleDefault();
        }
      }
    });

    // Hide splash screen
    this.splashScreen.hide();
  }

  ngOnInit() {
    // Initialize anything else needed
  }
}
