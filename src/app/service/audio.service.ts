import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { Media, MediaObject } from '@capacitor/media';
import { Filesystem } from '@capacitor/filesystem';
import { BehaviorSubject, Observable } from 'rxjs';
import { Track } from '../models/track.model';
import { StorageService } from './storage.service';

export interface PlayerState {
  isPlaying: boolean;
  currentTrack: Track | null;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
  error: string | null;
  playbackRate: number;
  repeatMode: 'off' | 'all' | 'one';
  shuffleMode: boolean;
  queue: Track[];
  queueIndex: number;
}

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  // Player state
  private state = new BehaviorSubject<PlayerState>({
    isPlaying: false,
    currentTrack: null,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
    isLoading: false,
    error: null,
    playbackRate: 1,
    repeatMode: 'off',
    shuffleMode: false,
    queue: [],
    queueIndex: -1
  });

  public state$ = this.state.asObservable();

  // Audio player instance
  private mediaObject: MediaObject | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private updateTimer: any = null;
  private recentlyPlayed: Track[] = [];
  private maxRecentlyPlayed = 20;
  private lastPosition: number = 0; // To save position for resuming

  constructor(
    private platform: Platform,
    private media: Media,
    private fileSystem: Filesystem,
    private storage: StorageService
  ) {
    this.initialize();
  }

  /**
   * Initialize the audio service
   */
  private async initialize() {
    await this.platform.ready();

    // Load recently played from storage
    const recentlyPlayed = await this.storage.getItem('recently_played');
    if (recentlyPlayed) {
      try {
        this.recentlyPlayed = JSON.parse(recentlyPlayed);
      } catch (e) {
        console.error('Failed to parse recently played tracks', e);
      }
    }

    // Initialize HTML5 Audio player for web/PWA
    if (this.platform.is('mobileweb') || this.platform.is('desktop')) {
      this.audioElement = new Audio();

      // Setup event listeners
      this.audioElement.addEventListener('play', () => this.updatePlayerState({ isPlaying: true }));
      this.audioElement.addEventListener('pause', () => this.updatePlayerState({ isPlaying: false }));
      this.audioElement.addEventListener('ended', () => this.handleTrackEnded());
      this.audioElement.addEventListener('loadstart', () => this.updatePlayerState({ isLoading: true }));
      this.audioElement.addEventListener('canplay', () => this.updatePlayerState({ isLoading: false }));
      this.audioElement.addEventListener('timeupdate', () => {
        if (this.audioElement) {
          this.updatePlayerState({
            currentTime: this.audioElement.currentTime,
            duration: this.audioElement.duration || 0
          });
        }
      });
      this.audioElement.addEventListener('error', (e) => {
        console.error('Audio playback error', e);
        this.updatePlayerState({
          error: 'Error playing audio file',
          isLoading: false,
          isPlaying: false
        });
      });
    }
  }

  /**
   * Play a track
   */
  async playTrack(track: Track, addToQueue = true): Promise<void> {
    try {
      this.stopCurrentTrack();

      // Update state right away for UI responsiveness
      this.updatePlayerState({
        currentTrack: track,
        isLoading: true,
        error: null,
        currentTime: 0
      });

      // Add to recently played
      this.addToRecentlyPlayed(track);

      // Add to queue if needed
      if (addToQueue) {
        const currentState = this.state.value;
        const queue = [...currentState.queue];
        const queueIndex = queue.findIndex(t => t.id === track.id);

        if (queueIndex === -1) {
          // Track not in queue, add it
          queue.push(track);
          this.updatePlayerState({
            queue,
            queueIndex: queue.length - 1
          });
        } else {
          // Track exists in queue, update the index
          this.updatePlayerState({
            queueIndex
          });
        }
      }

      // Update track's last played timestamp
      await this.updateTrackLastPlayed(track);

      if (this.platform.is('mobileweb') || this.platform.is('desktop')) {
        await this.playHtml5Audio(track);
      } else {
        await this.playNativeAudio(track);
      }
    } catch (error) {
      console.error('Error playing track', error);
      this.updatePlayerState({
        isLoading: false,
        isPlaying: false
      });
    }
  }

  /**
   * Play audio using HTML5 Audio for web/PWA
   */
  private async playHtml5Audio(track: Track): Promise<void> {
    if (!this.audioElement) {
      throw new Error('Audio element not initialized');
    }

    // Set audio source
    if (track.isLocal) {
      // For local files, we need to handle differently based on platform
      if (this.platform.is('desktop')) {
        // Desktop PWA - hopefully using File System Access API
        this.audioElement.src = track.url;
      } else {
        // Mobile web might need to convert blob URL
        this.audioElement.src = track.url;
      }
    } else {
      // Remote audio (streaming)
      this.audioElement.src = track.url;
    }

    // Load and play
    this.audioElement.load();
    await this.audioElement.play();
  }

  /**
   * Play audio using native Media plugin for mobile
   */
  private async playNativeAudio(track: Track): Promise<void> {
    if (track.isLocal) {
      // For local files on the device
      this.mediaObject = this.media.create(track.url);
    } else {
      // For remote files (streaming)
      this.mediaObject = this.media.create(track.url);
    }

    // Setup event listeners for cordova media
    this.mediaObject.onStatusUpdate.subscribe((status: any) => {
      switch (status) {
        case this.media.MEDIA_RUNNING:
          this.updatePlayerState({ isPlaying: true, isLoading: false });
          break;
        case this.media.MEDIA_PAUSED:
          this.updatePlayerState({ isPlaying: false });
          break;
        case this.media.MEDIA_STOPPED:
          this.updatePlayerState({ isPlaying: false, currentTime: 0 });
          break;
      }
    });

    this.mediaObject.onSuccess.subscribe(() => {
      console.log('Media playback finished successfully');
      this.handleTrackEnded();
    });

    this.mediaObject.onError.subscribe((error: any) => {
      console.error('Error playing media', error);
      this.updatePlayerState({
        error: 'Error playing audio file',
        isLoading: false,
        isPlaying: false
      });
    });

    // Start playback
    this.mediaObject.play();

    // Start a timer to update current time (not provided by media plugin)
    this.startTimeUpdateTimer();
  }

  /**
   * Start a timer to update playback position (for native playback)
   */
  private startTimeUpdateTimer(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }

    this.updateTimer = setInterval(() => {
      if (this.mediaObject && this.state.value.isPlaying) {
        this.mediaObject.getCurrentPosition().then((position: number) => {
          if (position >= 0) {
            this.updatePlayerState({
              currentTime: position,
              // We might not know duration initially with media plugin
              duration: this.state.value.duration || 0
            });
          }
        });
      }
    }, 1000);
  }

  /**
   * Stop the current track
   */
  private stopCurrentTrack(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    if (this.mediaObject) {
      this.mediaObject.stop();
      this.mediaObject.release();
      this.mediaObject = null;
    }

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.audioElement.src = '';
    }
  }

  /**
   * Handle when track ends
   */
  private handleTrackEnded(): void {
    const currentState = this.state.value;

    // Based on repeat mode, choose what to do
    switch (currentState.repeatMode) {
      case 'one':
        // Repeat the same track
        if (currentState.currentTrack) {
          this.playTrack(currentState.currentTrack, false);
        }
        break;
      case 'all':
        // Go to next track or back to beginning
        this.playNext(true);
        break;
      case 'off':
      default:
        // Go to next track if available
        this.playNext(false);
        break;
    }
  }

  /**
   * Add track to recently played
   */
  private addToRecentlyPlayed(track: Track): void {
    // Remove track if already in the list
    this.recentlyPlayed = this.recentlyPlayed.filter(t => t.id !== track.id);

    // Add to the beginning
    this.recentlyPlayed.unshift(track);

    // Limit size
    if (this.recentlyPlayed.length > this.maxRecentlyPlayed) {
      this.recentlyPlayed = this.recentlyPlayed.slice(0, this.maxRecentlyPlayed);
    }

    // Save to storage
    this.storage.setItem('recently_played', JSON.stringify(this.recentlyPlayed));
  }

  /**
   * Update player state
   */
  private updatePlayerState(updates: Partial<PlayerState>): void {
    const currentState = this.state.value;
    this.state.next({ ...currentState, ...updates });
  }

  /**
   * Play next track in queue
   */
  public playNext(loopToBeginning: boolean = true): void {
    const currentState = this.state.value;

    if (currentState.queue.length === 0) {
      return;
    }

    let nextIndex = currentState.queueIndex + 1;

    // Handle shuffle mode
    if (currentState.shuffleMode) {
      nextIndex = Math.floor(Math.random() * currentState.queue.length);
      // Avoid playing the same track again in shuffle
      if (nextIndex === currentState.queueIndex && currentState.queue.length > 1) {
        nextIndex = (nextIndex + 1) % currentState.queue.length;
      }
    }
    // Normal sequential playback
    else if (nextIndex >= currentState.queue.length) {
      if (loopToBeginning) {
        nextIndex = 0; // Loop back to beginning
      } else {
        // Stop at the end
        this.stop();
        return;
      }
    }

    // Play the track at the new index
    this.updatePlayerState({ queueIndex: nextIndex });
    this.playTrack(currentState.queue[nextIndex], false);
  }

  /**
   * Play previous track in queue
   */
  public playPrevious(): void {
    const currentState = this.state.value;

    if (currentState.queue.length === 0) {
      return;
    }

    // If we're past 3 seconds in the current track, restart it instead
    if (currentState.currentTime > 3) {
      this.seekTo(0);
      return;
    }

    let prevIndex = currentState.queueIndex - 1;

    // Handle shuffle mode
    if (currentState.shuffleMode) {
      prevIndex = Math.floor(Math.random() * currentState.queue.length);
      // Avoid playing the same track again in shuffle
      if (prevIndex === currentState.queueIndex && currentState.queue.length > 1) {
        prevIndex = (prevIndex - 1 + currentState.queue.length) % currentState.queue.length;
      }
    }
    // Normal sequential playback
    else if (prevIndex < 0) {
      prevIndex = currentState.queue.length - 1; // Loop to the end
    }

    // Play the track at the new index
    this.updatePlayerState({ queueIndex: prevIndex });
    this.playTrack(currentState.queue[prevIndex], false);
  }

  /**
   * Toggle play/pause
   */
  public togglePlayPause(): void {
    const currentState = this.state.value;

    if (!currentState.currentTrack) {
      // Nothing to play
      return;
    }

    if (currentState.isPlaying) {
      this.pause();
    } else {
      this.resume();
    }
  }

  /**
   * Pause playback
   */
  public pause(): void {
    const currentState = this.state.value;

    if (!currentState.isPlaying) {
      return;
    }

    if (this.mediaObject) {
      this.mediaObject.pause();
      // Save current position for resuming
      this.mediaObject.getCurrentPosition().then((position: number) => {
        this.lastPosition = position;
      });
    }

    if (this.audioElement) {
      this.audioElement.pause();
      this.lastPosition = this.audioElement.currentTime;
    }

    this.updatePlayerState({ isPlaying: false });
  }

  /**
   * Resume playback
   */
  public resume(): void {
    const currentState = this.state.value;

    if (currentState.isPlaying) {
      return;
    }

    if (this.mediaObject) {
      this.mediaObject.play();
      // No need to manually seek, the Media plugin remembers position
    }

    if (this.audioElement) {
      this.audioElement.play();
    }

    this.updatePlayerState({ isPlaying: true });
  }

  /**
   * Stop playback completely
   */
  public stop(): void {
    this.stopCurrentTrack();

    this.updatePlayerState({
      isPlaying: false,
      currentTime: 0,
      currentTrack: null
    });
  }

  /**
   * Seek to a specific position
   */
  public seekTo(position: number): void {
    if (position < 0) {
      position = 0;
    }

    const currentState = this.state.value;
    if (position > currentState.duration) {
      position = currentState.duration;
    }

    if (this.mediaObject) {
      this.mediaObject.seekTo(position * 1000); // Convert to milliseconds
    }

    if (this.audioElement) {
      this.audioElement.currentTime = position;
    }

    this.updatePlayerState({ currentTime: position });
  }

  /**
   * Set volume level (0-1)
   */
  public setVolume(level: number): void {
    if (level < 0) level = 0;
    if (level > 1) level = 1;

    if (this.mediaObject) {
      // Media plugin doesn't have volume control, would need to use native audio APIs
    }

    if (this.audioElement) {
      this.audioElement.volume = level;
    }

    this.updatePlayerState({
      volume: level,
      isMuted: level === 0
    });
  }

  /**
   * Toggle mute status
   */
  public toggleMute(): void {
    const currentState = this.state.value;

    if (currentState.isMuted) {
      // Unmute - restore previous volume
      this.setVolume(currentState.volume > 0 ? currentState.volume : 1);
      this.updatePlayerState({ isMuted: false });
    } else {
      // Mute - set volume to 0 but remember level
      if (this.audioElement) {
        this.audioElement.volume = 0;
      }
      this.updatePlayerState({ isMuted: true });
    }
  }

  /**
   * Set playback rate
   */
  public setPlaybackRate(rate: number): void {
    if (rate < 0.25) rate = 0.25;
    if (rate > 2) rate = 2;

    if (this.audioElement) {
      this.audioElement.playbackRate = rate;
    }

    // Note: Media plugin doesn't support playback rate adjustment

    this.updatePlayerState({ playbackRate: rate });
  }

  /**
   * Toggle shuffle mode
   */
  public toggleShuffle(): void {
    const currentState = this.state.value;
    this.updatePlayerState({ shuffleMode: !currentState.shuffleMode });
  }

  /**
   * Cycle through repeat modes
   */
  public cycleRepeatMode(): void {
    const currentState = this.state.value;
    let nextMode: 'off' | 'all' | 'one';

    switch (currentState.repeatMode) {
      case 'off':
        nextMode = 'all';
        break;
      case 'all':
        nextMode = 'one';
        break;
      case 'one':
      default:
        nextMode = 'off';
        break;
    }

    this.updatePlayerState({ repeatMode: nextMode });
  }

  /**
   * Set queue and optionally start playing
   */
  public setQueue(tracks: Track[], startIndex: number = 0, autoPlay: boolean = true): void {
    if (tracks.length === 0) {
      return;
    }

    // Update queue
    this.updatePlayerState({
      queue: [...tracks],
      queueIndex: startIndex
    });

    // Start playing if needed
    if (autoPlay) {
      this.playTrack(tracks[startIndex], false);
    }
  }

  /**
   * Add tracks to the end of the queue
   */
  public addToQueue(tracks: Track[]): void {
    const currentState = this.state.value;
    const updatedQueue = [...currentState.queue, ...tracks];

    this.updatePlayerState({ queue: updatedQueue });
  }

  /**
   * Update track's last played timestamp
   */
  private async updateTrackLastPlayed(track: Track): Promise<void> {
    const updatedTrack = {
      ...track,
      lastPlayed: new Date()
    };

    await this.storage.saveTrack(updatedTrack);
  }

  /**
   * Get the recently played tracks
   */
  public getRecentlyPlayed(): Track[] {
    return [...this.recentlyPlayed];
  }

  /**
   * Clean up resources when service is destroyed
   */
  ngOnDestroy() {
    this.stopCurrentTrack();
  }
}
