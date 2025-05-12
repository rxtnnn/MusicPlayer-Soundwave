// home.page.ts
import { Component, OnInit } from '@angular/core';
import { AudioService } from '../service/audio.service';
import { AudiusService } from '../service/audius.service';
import { StorageService } from '../service/storage.service';
import { ThemeService } from '../service/theme.service';
import { Track } from '../models/track.model';
import { Observable } from 'rxjs';
import { ToastController, Platform } from '@ionic/angular';
import { v4 as uuidv4 } from 'uuid';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false
})
export class HomePage implements OnInit {
  localTracks: Track[] = [];
  streamingTracks: Track[] = [];
  recentlyPlayed: Track[] = [];
  isDarkMode$: Observable<boolean>;
  isLoading = false;
  isNative = false;

  constructor(
    private audioService: AudioService,
    private audiusService: AudiusService,
    private storageService: StorageService,
    private themeService: ThemeService,
    private platform: Platform,
    private toastController: ToastController
  ) {
    this.isDarkMode$ = this.themeService.darkMode$;
    this.isNative = Capacitor.isNativePlatform();
  }

  async ngOnInit() {
    // Load local tracks from storage
    await this.loadLocalTracks();

    // Load recent tracks
    this.recentlyPlayed = this.audioService.getRecentlyPlayed();

    // Load featured/trending tracks from Audius
    await this.loadTrendingTracks();
  }

  async loadLocalTracks() {
    try {
      const tracks = await this.storageService.getAllTracks();
      this.localTracks = tracks.filter(track => track.isLocal);
    } catch (error) {
      console.error('Error loading local tracks', error);
    }
  }

  async loadTrendingTracks() {
    try {
      this.isLoading = true;
      const tracks = await this.audiusService.getTrendingTracks(10);
      this.streamingTracks = tracks;
    } catch (error) {
      console.error('Error loading trending tracks', error);
      await this.showToast('Failed to load trending tracks');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Play a track
   */
  playTrack(track: Track) {
    this.audioService.playTrack(track);
  }

  /**
   * Add local music files
   */
  async addLocalMusic() {
    if (this.isNative) {
      try {
        // For native platforms, we would use the Filesystem API
        // Note: this is a simplified implementation
        // In a real app, you would need to request file permissions and
        // possibly use a third-party plugin for file picking

        await this.showToast('File picking in native apps requires additional plugins');

        // For a real implementation, you would do something like:
        // const result = await FilePicker.pickFiles({
        //   types: ['audio/*'],
        //   multiple: false
        // });
        //
        // Then process the file
      } catch (error) {
        console.error('Error adding local music', error);
        await this.showToast('Failed to add music file');
      }
    } else {
      // Web platform - use File API
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*';
      input.multiple = true;

      input.onchange = async (event) => {
        const files = (event.target as HTMLInputElement).files;
        if (!files || files.length === 0) return;

        let addedCount = 0;

        for (let i = 0; i < files.length; i++) {
          const file = files[i];

          // Check file type
          const fileExt = file.name.substr(file.name.lastIndexOf('.') + 1).toLowerCase();
          const supportedFormats = ['mp3', 'aac', 'wav', 'ogg', 'flac', 'opus', 'm4a'];

          if (!supportedFormats.includes(fileExt)) {
            continue;
          }

          // Create object URL
          const url = URL.createObjectURL(file);

          // Create temporary audio element to get duration
          const audio = new Audio();
          audio.src = url;

          // Wait for metadata to load
          await new Promise<void>((resolve) => {
            audio.addEventListener('loadedmetadata', () => {
              resolve();
            });

            // Handle error
            audio.addEventListener('error', () => {
              resolve();
            });
          });

          // Create track object
          const id = uuidv4();
          const title = file.name.substr(0, file.name.lastIndexOf('.'));

          // Map file extension to audio format
          let format: any = fileExt;
          if (fileExt === 'm4a') {
            format = 'aac';
          }

          const track: Track = {
            id,
            title,
            artist: 'Unknown Artist', // Would be read from metadata
            album: 'Unknown Album',   // Would be read from metadata
            duration: audio.duration || 0,
            url,
            format,
            isLocal: true,
            source: 'local',
            dateAdded: new Date()
          };

          // Save to storage
          await this.storageService.saveTrack(track);
          addedCount++;
        }

        // Reload local tracks
        await this.loadLocalTracks();

        await this.showToast(`Added ${addedCount} music file(s) successfully`);
      };

      input.click();
    }
  }

  /**
   * Refresh trending tracks
   */
  async refreshTrendingTracks(event: any) {
    try {
      await this.loadTrendingTracks();
    } finally {
      event.target.complete();
    }
  }

  /**
   * Show a toast message
   */
  private async showToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom'
    });
    await toast.present();
  }
}
