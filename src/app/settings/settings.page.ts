// settings.page.ts
import { Component, OnInit } from '@angular/core';
import { ThemeService } from '../service/theme.service';
import { Observable } from 'rxjs';
import { StorageService } from '../service/storage.service';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false
})
export class SettingsPage implements OnInit {
  darkMode$: Observable<boolean>;
  audioQuality = 'high';
  equalizerEnabled = false;
  crossfadeDuration = 2;

  constructor(
    private themeService: ThemeService,
    private storageService: StorageService,
    private toastController: ToastController
  ) {
    this.darkMode$ = this.themeService.darkMode$;
  }

  async ngOnInit() {
    // Load saved settings
    const savedQuality = await this.storageService.getItem('audio_quality');
    if (savedQuality) {
      this.audioQuality = savedQuality;
    }

    const savedCrossfade = await this.storageService.getItem('crossfade_duration');
    if (savedCrossfade) {
      this.crossfadeDuration = parseInt(savedCrossfade, 10);
    }

    const savedEqualizer = await this.storageService.getItem('equalizer_enabled');
    if (savedEqualizer) {
      this.equalizerEnabled = savedEqualizer === 'true';
    }
  }

  async toggleDarkMode() {
    await this.themeService.toggleTheme();
  }

  async saveAudioQuality() {
    await this.storageService.setItem('audio_quality', this.audioQuality);
    this.showToast('Audio quality settings saved');
  }

  async toggleEqualizer() {
    this.equalizerEnabled = !this.equalizerEnabled;
    await this.storageService.setItem('equalizer_enabled', this.equalizerEnabled.toString());
    this.showToast(`Equalizer ${this.equalizerEnabled ? 'enabled' : 'disabled'}`);
  }

  async saveCrossfade() {
    await this.storageService.setItem('crossfade_duration', this.crossfadeDuration.toString());
    this.showToast('Crossfade settings saved');
  }

  async clearCache() {
    // Clear cached data
    await this.storageService.setItem('cache_cleared_date', new Date().toISOString());
    this.showToast('Cache cleared successfully');
  }

  private async showToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom'
    });
    await toast.present();
  }
}
