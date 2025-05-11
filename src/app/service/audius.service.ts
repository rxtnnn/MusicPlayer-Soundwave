import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Track } from '../models/track.model';

/**
 * Service for interacting with the Audius API
 * Documentation: https://audiusproject.github.io/api-docs/
 */
@Injectable({
  providedIn: 'root'
})
export class AudiusService {
  // Audius API hosts - will be populated on init
  private hosts: string[] = [];
  private selectedHost: string | any;

  // Tracks found from search or browse
  private tracksSubject = new BehaviorSubject<Track[]>([]);
  public tracks$ = this.tracksSubject.asObservable();

  // Loading state
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient) {
    this.initializeApiHosts();
  }

  /**
   * Initialize API hosts from Audius
   */
  private async initializeApiHosts() {
    try {
      // Get available API hosts
      const response = await fetch('https://api.audius.co');
      const { data } = await response.json();

      if (data && Array.isArray(data) && data.length > 0) {
        this.hosts = data;
        this.selectedHost = data[0];
        console.log('Audius API host selected:', this.selectedHost);
      } else {
        console.error('Failed to get valid Audius API hosts');
      }
    } catch (error) {
      console.error('Error initializing Audius API hosts', error);
    }
  }

  /**
   * Get a new API host if current one fails
   */
  private selectNewHost() {
    if (this.hosts.length <= 1) {
      // Try to refresh the hosts
      this.initializeApiHosts();
      return;
    }

    // Get current index
    const currentIndex = this.hosts.indexOf(this.selectedHost);
    const nextIndex = (currentIndex + 1) % this.hosts.length;

    this.selectedHost = this.hosts[nextIndex];
    console.log('Switched to new Audius API host:', this.selectedHost);
  }

  /**
   * Make a request to the Audius API
   */
  private async makeRequest<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    if (!this.selectedHost) {
      await this.initializeApiHosts();
      if (!this.selectedHost) {
        throw new Error('No Audius API host available');
      }
    }

    // Build query string
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      queryParams.append(key, value.toString());
    }

    const url = `${this.selectedHost}${endpoint}?${queryParams.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error(`Error making request to ${endpoint}`, error);

      // Try a different host for next request
      this.selectNewHost();

      throw error;
    }
  }

  /**
   * Search for tracks
   */
  public async searchTracks(query: string, limit: number = 10): Promise<Track[]> {
    this.loadingSubject.next(true);

    try {
      const data = await this.makeRequest<any[]>('/v1/tracks/search', {
        query,
        limit
      });

      const tracks = this.mapAudiusTracks(data);
      this.tracksSubject.next(tracks);
      return tracks;
    } catch (error) {
      console.error('Error searching tracks', error);
      return [];
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Get trending tracks
   */
  public async getTrendingTracks(limit: number = 20, time: 'week' | 'month' | 'year' = 'week'): Promise<Track[]> {
    this.loadingSubject.next(true);

    try {
      const data = await this.makeRequest<any[]>('/v1/tracks/trending', {
        limit,
        time
      });

      const tracks = this.mapAudiusTracks(data);
      this.tracksSubject.next(tracks);
      return tracks;
    } catch (error) {
      console.error('Error getting trending tracks', error);
      return [];
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Get track by ID
   */
  public async getTrack(trackId: string): Promise<Track | null> {
    this.loadingSubject.next(true);

    try {
      const data = await this.makeRequest<any>(`/v1/tracks/${trackId}`);

      if (data) {
        const tracks = this.mapAudiusTracks([data]);
        if (tracks.length > 0) {
          return tracks[0];
        }
      }

      return null;
    } catch (error) {
      console.error(`Error getting track ${trackId}`, error);
      return null;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Get streaming URL for a track
   */
  public getStreamUrl(trackId: string): string {
    if (!this.selectedHost) {
      console.error('No Audius API host available for streaming');
      return '';
    }

    return `${this.selectedHost}/v1/tracks/${trackId}/stream`;
  }

  /**
   * Map Audius API track objects to our Track model
   */
  private mapAudiusTracks(audiusTracks: any[]): Track[] {
    return audiusTracks.map(track => {
      // Build track artwork URL
      let artworkUrl = track.artwork?.['150x150'] || track.artwork?.['480x480'] || '';

      // If using CID format, convert to URL
      if (artworkUrl && !artworkUrl.startsWith('http')) {
        artworkUrl = `https://creatornode.audius.co/content/${artworkUrl}`;
      }

      return {
        id: `audius-${track.id}`,
        title: track.title || 'Unknown Title',
        artist: track.user?.name || 'Unknown Artist',
        album: '',
        duration: track.duration || 0,
        artwork: artworkUrl,
        url: this.getStreamUrl(track.id),
        format: 'streaming',
        isLocal: false,
        source: 'audius',
        metadata: {
          audius_id: track.id,
          play_count: track.play_count,
          permalink: track.permalink,
          genre: track.genre,
          mood: track.mood,
          tags: track.tags,
          release_date: track.release_date,
          user_id: track.user?.id
        }
      } as Track;
    });
  }
}
