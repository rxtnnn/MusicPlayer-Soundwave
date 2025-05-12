// search.page.ts
import { Component, OnInit, ViewChild } from '@angular/core';
import { IonSearchbar } from '@ionic/angular';
import { Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AudioService } from '../service/audio.service';
import { AudiusService } from '../service/audius.service';
import { StorageService } from '../service/storage.service';
import { ThemeService } from '../service/theme.service';
import { Track } from '../models/track.model';

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss'],
  standalone: false,
})
export class SearchPage implements OnInit {
  @ViewChild('searchBar', { static: false })
  searchBar!: IonSearchbar;

  isDarkMode$: Observable<boolean>;
  searchQuery = '';
  searchResults: Track[] = [];
  localResults: Track[] = [];
  onlineResults: Track[] = [];
  isLoading = false;
  activeSegment = 'all';

  // Genre categories for browsing
  genres = [
    { name: 'Electronic', color: '#4c8dff' },
    { name: 'Rock', color: '#ff4961' },
    { name: 'Hip Hop', color: '#7044ff' },
    { name: 'Pop', color: '#ffce00' },
    { name: 'Indie', color: '#10dc60' },
    { name: 'Jazz', color: '#ff9f43' },
    { name: 'Classical', color: '#8862e0' },
    { name: 'R&B', color: '#2dd36f' }
  ];

  constructor(
    private audioService: AudioService,
    private audiusService: AudiusService,
    private storageService: StorageService,
    private themeService: ThemeService
  ) {
    this.isDarkMode$ = this.themeService.darkMode$;
  }

  ngOnInit() {}

  ionViewDidEnter() {
    // Focus the search bar when view appears
    setTimeout(() => {
      this.searchBar?.setFocus();
    }, 150);
  }

  /**
   * Handle search input
   */
  async search(event: any) {
    const query = event.detail.value.trim();
    this.searchQuery = query;

    if (!query || query.length < 2) {
      this.searchResults = [];
      this.localResults = [];
      this.onlineResults = [];
      return;
    }

    this.isLoading = true;

    try {
      // Search local tracks
      await this.searchLocalTracks(query);

      // Search online tracks
      await this.searchOnlineTracks(query);

      // Combine results
      this.searchResults = [...this.localResults, ...this.onlineResults];
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Search local tracks
   */
  private async searchLocalTracks(query: string) {
    try {
      const allTracks = await this.storageService.getAllTracks();

      // Simple search by title or artist
      this.localResults = allTracks.filter(track =>
        track.title.toLowerCase().includes(query.toLowerCase()) ||
        track.artist.toLowerCase().includes(query.toLowerCase())
      );
    } catch (error) {
      console.error('Error searching local tracks', error);
      this.localResults = [];
    }
  }

  /**
   * Search online tracks via Audius
   */
  private async searchOnlineTracks(query: string) {
    try {
      const tracks = await this.audiusService.searchTracks(query, 20);
      this.onlineResults = tracks;
    } catch (error) {
      console.error('Error searching online tracks', error);
      this.onlineResults = [];
    }
  }

  /**
   * Clear search
   */
  clearSearch() {
    this.searchQuery = '';
    this.searchResults = [];
    this.localResults = [];
    this.onlineResults = [];
  }

  /**
   * Play a track
   */
  playTrack(track: Track) {
    this.audioService.playTrack(track);
  }

  /**
   * Change segment
   */
  segmentChanged(event: any) {
    this.activeSegment = event.detail.value;

    // Update displayed results based on segment
    if (this.activeSegment === 'all') {
      this.searchResults = [...this.localResults, ...this.onlineResults];
    } else if (this.activeSegment === 'local') {
      this.searchResults = [...this.localResults];
    } else if (this.activeSegment === 'streaming') {
      this.searchResults = [...this.onlineResults];
    }
  }

  /**
   * Search by genre
   */
  async searchGenre(genre: string) {
    this.searchQuery = `genre:${genre}`;
    this.isLoading = true;

    try {
      // For Audius, we'd use their genre-specific API endpoint
      // For now, we'll just use the search with the genre name
      const tracks = await this.audiusService.searchTracks(genre, 20);
      this.onlineResults = tracks;
      this.localResults = []; // No local genre filtering for now
      this.searchResults = [...this.onlineResults];

      // Switch to 'all' segment
      this.activeSegment = 'all';
    } catch (error) {
      console.error(`Error searching genre ${genre}`, error);
    } finally {
      this.isLoading = false;
    }
  }
}
