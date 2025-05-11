import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection} from '@capacitor-community/sqlite';
import { BehaviorSubject } from 'rxjs';
import { Track, Playlist } from '../models/track.model';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private database: SQLiteObject;
  private dbReady = new BehaviorSubject<boolean>(false);
  public dbReady$ = this.dbReady.asObservable();

  // Database tables
  private TRACKS_TABLE = 'tracks';
  private PLAYLISTS_TABLE = 'playlists';
  private PLAYLIST_TRACKS_TABLE = 'playlist_tracks';
  private SETTINGS_TABLE = 'settings';

  constructor(
    private platform: Platform,
    private sqlite: SQLite
  ) {}

  /**
   * Initialize the database
   */
  async init() {
    await this.platform.ready();

    // Create database
    try {
      this.database = await this.sqlite.create({
        name: 'melodify.db',
        location: 'default'
      });

      // Create tables
      await this.createTables();
      this.dbReady.next(true);
      console.log('Database ready');
    } catch (error) {
      console.error('Error initializing database', error);
    }
  }

  /**
   * Create database tables
   */
  private async createTables() {
    // Create tracks table
    await this.database.executeSql(`
      CREATE TABLE IF NOT EXISTS ${this.TRACKS_TABLE} (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT,
        duration INTEGER,
        artwork TEXT,
        url TEXT NOT NULL,
        format TEXT NOT NULL,
        isLocal INTEGER NOT NULL,
        source TEXT NOT NULL,
        metadata TEXT,
        isLiked INTEGER DEFAULT 0,
        dateAdded TEXT,
        lastPlayed TEXT
      )
    `, []);

    // Create playlists table
    await this.database.executeSql(`
      CREATE TABLE IF NOT EXISTS ${this.PLAYLISTS_TABLE} (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        coverArt TEXT,
        created TEXT NOT NULL,
        updated TEXT NOT NULL
      )
    `, []);

    // Create playlist_tracks table for many-to-many relationship
    await this.database.executeSql(`
      CREATE TABLE IF NOT EXISTS ${this.PLAYLIST_TRACKS_TABLE} (
        playlist_id TEXT NOT NULL,
        track_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (playlist_id, track_id),
        FOREIGN KEY (playlist_id) REFERENCES ${this.PLAYLISTS_TABLE} (id) ON DELETE CASCADE,
        FOREIGN KEY (track_id) REFERENCES ${this.TRACKS_TABLE} (id) ON DELETE CASCADE
      )
    `, []);

    // Create settings table
    await this.database.executeSql(`
      CREATE TABLE IF NOT EXISTS ${this.SETTINGS_TABLE} (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `, []);
  }

  /**
   * Get a value from settings table
   */
  async getItem(key: string): Promise<string | null> {
    try {
      const result = await this.database.executeSql(
        `SELECT value FROM ${this.SETTINGS_TABLE} WHERE key = ?`,
        [key]
      );

      if (result.rows.length > 0) {
        return result.rows.item(0).value;
      }
      return null;
    } catch (error) {
      console.error('Error getting item from storage', error);
      return null;
    }
  }

  /**
   * Set a value in settings table
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      await this.database.executeSql(
        `INSERT OR REPLACE INTO ${this.SETTINGS_TABLE} (key, value) VALUES (?, ?)`,
        [key, value]
      );
    } catch (error) {
      console.error('Error setting item in storage', error);
    }
  }

  /**
   * Save a track to the database
   */
  async saveTrack(track: Track): Promise<void> {
    try {
      await this.database.executeSql(
        `INSERT OR REPLACE INTO ${this.TRACKS_TABLE}
        (id, title, artist, album, duration, artwork, url, format, isLocal, source, metadata, isLiked, dateAdded, lastPlayed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          track.id,
          track.title,
          track.artist,
          track.album || null,
          track.duration || null,
          track.artwork || null,
          track.url,
          track.format,
          track.isLocal ? 1 : 0,
          track.source,
          track.metadata ? JSON.stringify(track.metadata) : null,
          track.isLiked ? 1 : 0,
          track.dateAdded ? track.dateAdded.toISOString() : new Date().toISOString(),
          track.lastPlayed ? track.lastPlayed.toISOString() : null
        ]
      );
    } catch (error) {
      console.error('Error saving track', error);
    }
  }

  /**
   * Get all tracks
   */
  async getAllTracks(): Promise<Track[]> {
    try {
      const result = await this.database.executeSql(
        `SELECT * FROM ${this.TRACKS_TABLE} ORDER BY dateAdded DESC`,
        []
      );

      const tracks: Track[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        const item = result.rows.item(i);
        tracks.push({
          id: item.id,
          title: item.title,
          artist: item.artist,
          album: item.album,
          duration: item.duration,
          artwork: item.artwork,
          url: item.url,
          format: item.format,
          isLocal: !!item.isLocal,
          source: item.source,
          metadata: item.metadata ? JSON.parse(item.metadata) : undefined,
          isLiked: !!item.isLiked,
          dateAdded: item.dateAdded ? new Date(item.dateAdded) : undefined,
          lastPlayed: item.lastPlayed ? new Date(item.lastPlayed) : undefined
        });
      }

      return tracks;
    } catch (error) {
      console.error('Error getting tracks', error);
      return [];
    }
  }

  /**
   * Get tracks by playlist ID
   */
  async getPlaylistTracks(playlistId: string): Promise<Track[]> {
    try {
      const result = await this.database.executeSql(
        `SELECT t.* FROM ${this.TRACKS_TABLE} t
        JOIN ${this.PLAYLIST_TRACKS_TABLE} pt ON t.id = pt.track_id
        WHERE pt.playlist_id = ?
        ORDER BY pt.position ASC`,
        [playlistId]
      );

      const tracks: Track[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        const item = result.rows.item(i);
        tracks.push({
          id: item.id,
          title: item.title,
          artist: item.artist,
          album: item.album,
          duration: item.duration,
          artwork: item.artwork,
          url: item.url,
          format: item.format,
          isLocal: !!item.isLocal,
          source: item.source,
          metadata: item.metadata ? JSON.parse(item.metadata) : undefined,
          isLiked: !!item.isLiked,
          dateAdded: item.dateAdded ? new Date(item.dateAdded) : undefined,
          lastPlayed: item.lastPlayed ? new Date(item.lastPlayed) : undefined
        });
      }

      return tracks;
    } catch (error) {
      console.error('Error getting playlist tracks', error);
      return [];
    }
  }

  /**
   * Save a playlist to the database
   */
  async savePlaylist(playlist: Playlist): Promise<void> {
    try {
      await this.database.executeSql(
        `INSERT OR REPLACE INTO ${this.PLAYLISTS_TABLE}
        (id, name, description, coverArt, created, updated)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          playlist.id,
          playlist.name,
          playlist.description || null,
          playlist.coverArt || null,
          playlist.created.toISOString(),
          playlist.updated.toISOString()
        ]
      );

      // Handle playlist tracks
      if (playlist.tracks && playlist.tracks.length > 0) {
        // First delete existing entries
        await this.database.executeSql(
          `DELETE FROM ${this.PLAYLIST_TRACKS_TABLE} WHERE playlist_id = ?`,
          [playlist.id]
        );

        // Then add new entries
        for (let i = 0; i < playlist.tracks.length; i++) {
          await this.database.executeSql(
            `INSERT INTO ${this.PLAYLIST_TRACKS_TABLE} (playlist_id, track_id, position)
            VALUES (?, ?, ?)`,
            [playlist.id, playlist.tracks[i], i]
          );
        }
      }
    } catch (error) {
      console.error('Error saving playlist', error);
    }
  }

  /**
   * Get all playlists
   */
  async getAllPlaylists(): Promise<Playlist[]> {
    try {
      const result = await this.database.executeSql(
        `SELECT p.*, COUNT(pt.track_id) as trackCount
        FROM ${this.PLAYLISTS_TABLE} p
        LEFT JOIN ${this.PLAYLIST_TRACKS_TABLE} pt ON p.id = pt.playlist_id
        GROUP BY p.id
        ORDER BY p.updated DESC`,
        []
      );

      const playlists: Playlist[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        const item = result.rows.item(i);

        // Get track IDs for this playlist
        const tracksResult = await this.database.executeSql(
          `SELECT track_id FROM ${this.PLAYLIST_TRACKS_TABLE}
          WHERE playlist_id = ?
          ORDER BY position ASC`,
          [item.id]
        );

        const trackIds: string[] = [];
        for (let j = 0; j < tracksResult.rows.length; j++) {
          trackIds.push(tracksResult.rows.item(j).track_id);
        }

        playlists.push({
          id: item.id,
          name: item.name,
          description: item.description,
          coverArt: item.coverArt,
          tracks: trackIds,
          created: new Date(item.created),
          updated: new Date(item.updated)
        });
      }

      return playlists;
    } catch (error) {
      console.error('Error getting playlists', error);
      return [];
    }
  }

  /**
   * Delete a track from the database
   */
  async deleteTrack(trackId: string): Promise<void> {
    try {
      await this.database.executeSql(
        `DELETE FROM ${this.TRACKS_TABLE} WHERE id = ?`,
        [trackId]
      );

      // Also remove from playlists
      await this.database.executeSql(
        `DELETE FROM ${this.PLAYLIST_TRACKS_TABLE} WHERE track_id = ?`,
        [trackId]
      );
    } catch (error) {
      console.error('Error deleting track', error);
    }
  }

  /**
   * Delete a playlist
   */
  async deletePlaylist(playlistId: string): Promise<void> {
    try {
      await this.database.executeSql(
        `DELETE FROM ${this.PLAYLISTS_TABLE} WHERE id = ?`,
        [playlistId]
      );

      // Delete playlist_tracks entries
      await this.database.executeSql(
        `DELETE FROM ${this.PLAYLIST_TRACKS_TABLE} WHERE playlist_id = ?`,
        [playlistId]
      );
    } catch (error) {
      console.error('Error deleting playlist', error);
    }
  }
}
