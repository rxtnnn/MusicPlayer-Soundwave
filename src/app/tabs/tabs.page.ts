// tabs.page.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ThemeService } from '../service/theme.service';
import { AudioService, PlayerState } from '../service/audio.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: false
})
export class TabsPage implements OnInit, OnDestroy {
  playerState$: Observable<PlayerState>;
  isDarkMode$: Observable<boolean>;

  constructor(
    private audioService: AudioService,
    private themeService: ThemeService
  ) {
    this.playerState$ = this.audioService.state$;
    this.isDarkMode$ = this.themeService.darkMode$;
  }

  ngOnInit() {
    // Any initialization logic
  }

  ngOnDestroy() {
    // Clean up any subscriptions if needed
  }

  togglePlayPause() {
    this.audioService.togglePlayPause();
  }

  playNext() {
    this.audioService.playNext();
  }

  playPrevious() {
    this.audioService.playPrevious();
  }

  // Format time for display (mm:ss)
  formatTime(time: number): string {
    if (isNaN(time)) {
      return '0:00';
    }

    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);

    return `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
  }

  // Calculate progress percentage
  getProgress(currentTime: number, duration: number): number {
    if (!duration) return 0;
    return (currentTime / duration) * 100;
  }

  // Handle progress bar click to seek
  seekToPosition(event: any, playerState: PlayerState) {
    const progressBar = event.target;
    const rect = progressBar.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const width = rect.width;

    // Calculate percentage and convert to time
    const percentage = offsetX / width;
    const seekTime = percentage * playerState.duration;

    this.audioService.seekTo(seekTime);
  }
}
