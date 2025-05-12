import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection, capSQLiteSet } from '@capacitor-community/sqlite';
import { BehaviorSubject } from 'rxjs';
import { Track, Playlist } from '../models/track.model';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private sqlite: SQLiteConnection;
  private db: SQLiteDBConnection | any;
  private dbReady = new BehaviorSubject<boolean>(false);
  private isNative: boolean;
  private dbName = 'melodify';

  public dbReady$ = this.dbReady.asObservable();

  // Database tables
  private TRACKS_TABLE = 'tracks';
  private PLAYLISTS_TABLE = 'playlists';
  private PLAYLIST_TRACKS_TABLE = 'playlist_tracks';
  private SETTINGS_TABLE = 'settings';

  constructor(
    private platform: Platform
  ) {
    this.sqlite = new SQLiteConnection(CapacitorSQLite);
    this.isNative = Capacitor.isNativePlatform();
  }

  /**
   * Initialize the database
   */
  async init() {
    await this.platform.ready();

    try {
      if (this.isNative) {
        // Native environment - use native SQLite
        await this.sqlite.closeConnection(this.dbName, false);
        this.db = await this.sqlite.createConnection(
          this.dbName,
          false,
          'no-encryption',
          1,
          false
        );
      } else {
        // Browser environment - use Web Assembly SQLite
        await this.sqlite.initWebStore();
        this.db = await this.sqlite.createConnection(
          this.dbName,
          false,
          'no-encryption',
          1,
          false
        );
      }

      // Open database connection
      await this.db.open();

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
    const tracksTableQuery = `
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
    `;

    // Create playlists table
    const playlistsTableQuery = `
      CREATE TABLE IF NOT EXISTS ${this.PLAYLISTS_TABLE} (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        coverArt TEXT,
        created TEXT NOT NULL,
        updated TEXT NOT NULL
      )
    `;

    // Create playlist_tracks table for many-to-many relationship
    const playlistTracksTableQuery = `
      CREATE TABLE IF NOT EXISTS ${this.PLAYLIST_TRACKS_TABLE} (
        playlist_id TEXT NOT NULL,
        track_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (playlist_id, track_id),
        FOREIGN KEY (playlist_id) REFERENCES ${this.PLAYLISTS_TABLE} (id) ON DELETE CASCADE,
        FOREIGN KEY (track_id) REFERENCES ${this.TRACKS_TABLE} (id) ON DELETE CASCADE
      )
    `;

    // Create settings table
    const settingsTableQuery = `
      CREATE TABLE IF NOT EXISTS ${this.SETTINGS_TABLE} (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `;

    // Execute all table creation queries
    const statements: capSQLiteSet[] = [
      { statement: tracksTableQuery, values: [] },
      { statement: playlistsTableQuery, values: [] },
      { statement: playlistTracksTableQuery, values: [] },
      { statement: settingsTableQuery, values: [] }
    ];

    await this.db.executeSet( statements );
  }

  /**
   * Get a value from settings table
   */
  async getItem(key: string): Promise<string | null> {
    try {
      const query = `SELECT value FROM ${this.SETTINGS_TABLE} WHERE key = ?`;
      const result = await this.db.query(query, [key]);

      if (result.values && result.values.length > 0) {
        return result.values[0].value;
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
      const query = `
        INSERT OR REPLACE INTO ${this.SETTINGS_TABLE} (key, value)
        VALUES (?, ?)
      `;
      await this.db.run(query, [key, value]);
    } catch (error) {
      console.error('Error setting item in storage', error);
    }
  }

  /**
   * Save a track to the database
   */
  async saveTrack(track: Track): Promise<void> {
    try {
      const query = `
        INSERT OR REPLACE INTO ${this.TRACKS_TABLE}
        (id, title, artist, album, duration, artwork, url, format, isLocal, source, metadata, isLiked, dateAdded, lastPlayed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.db.run(query, [
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
      ]);
    } catch (error) {
      console.error('Error saving track', error);
    }
  }

  /**
   * Get all tracks
   */
  async getAllTracks(): Promise<Track[]> {
    try {
      const query = `SELECT * FROM ${this.TRACKS_TABLE} ORDER BY dateAdded DESC`;
      const result = await this.db.query(query);

      const tracks: Track[] = [];
      if (result.values && result.values.length > 0) {
        for (const item of result.values) {
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
      const query = `
        SELECT t.* FROM ${this.TRACKS_TABLE} t
        JOIN ${this.PLAYLIST_TRACKS_TABLE} pt ON t.id = pt.track_id
        WHERE pt.playlist_id = ?
        ORDER BY pt.position ASC
      `;
      const result = await this.db.query(query, [playlistId]);

      const tracks: Track[] = [];
      if (result.values && result.values.length > 0) {
        for (const item of result.values) {
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
      // Begin transaction
      await this.db.execute('BEGIN TRANSACTION');

      // Save playlist details
      const savePlaylistQuery = `
        INSERT OR REPLACE INTO ${this.PLAYLISTS_TABLE}
        (id, name, description, coverArt, created, updated)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      await this.db.run(savePlaylistQuery, [
        playlist.id,
        playlist.name,
        playlist.description || null,
        playlist.coverArt || null,
        playlist.created.toISOString(),
        playlist.updated.toISOString()
      ]);

      // Handle playlist tracks
      if (playlist.tracks && playlist.tracks.length > 0) {
        // First delete existing entries
        const deleteTracksQuery = `
          DELETE FROM ${this.PLAYLIST_TRACKS_TABLE} WHERE playlist_id = ?
        `;
        await this.db.run(deleteTracksQuery, [playlist.id]);

        // Then add new entries
        const insertTrackQuery = `
          INSERT INTO ${this.PLAYLIST_TRACKS_TABLE}
          (playlist_id, track_id, position) VALUES (?, ?, ?)
        `;

        // Prepare statements for batch execution
        const statements: capSQLiteSet[] = [];

        for (let i = 0; i < playlist.tracks.length; i++) {
          statements.push({
            statement: insertTrackQuery,
            values: [playlist.id, playlist.tracks[i], i]
          });
        }

        // Execute batch insert
        if (statements.length > 0) {
          await this.db.executeSet(statements);
        }
      }

      // Commit transaction
      await this.db.execute('COMMIT');
    } catch (error) {
      // Rollback on error
      await this.db.execute('ROLLBACK');
      console.error('Error saving playlist', error);
    }
  }

  /**
   * Get all playlists
   */
  async getAllPlaylists(): Promise<Playlist[]> {
    try {
      // Get all playlists
      const playlistQuery = `
        SELECT p.*, COUNT(pt.track_id) as trackCount
        FROM ${this.PLAYLISTS_TABLE} p
        LEFT JOIN ${this.PLAYLIST_TRACKS_TABLE} pt ON p.id = pt.playlist_id
        GROUP BY p.id
        ORDER BY p.updated DESC
      `;

      const result = await this.db.query(playlistQuery);

      const playlists: Playlist[] = [];
      if (result.values && result.values.length > 0) {
        for (const item of result.values) {
          // Get track IDs for this playlist
          const tracksQuery = `
            SELECT track_id FROM ${this.PLAYLIST_TRACKS_TABLE}
            WHERE playlist_id = ?
            ORDER BY position ASC
          `;

          const tracksResult = await this.db.query(tracksQuery, [item.id]);

          const trackIds: string[] = [];
          if (tracksResult.values && tracksResult.values.length > 0) {
            for (const track of tracksResult.values) {
              trackIds.push(track.track_id);
            }
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
      await this.db.execute('BEGIN TRANSACTION');

      // Delete track
      const deleteTrackQuery = `DELETE FROM ${this.TRACKS_TABLE} WHERE id = ?`;
      await this.db.run(deleteTrackQuery, [trackId]);

      // Also remove from playlists
      const deletePlaylistTrackQuery = `DELETE FROM ${this.PLAYLIST_TRACKS_TABLE} WHERE track_id = ?`;
      await this.db.run(deletePlaylistTrackQuery, [trackId]);

      await this.db.execute('COMMIT');
    } catch (error) {
      await this.db.execute('ROLLBACK');
      console.error('Error deleting track', error);
    }
  }

  /**
   * Delete a playlist
   */
  async deletePlaylist(playlistId: string): Promise<void> {
    try {
      await this.db.execute('BEGIN TRANSACTION');

      // Delete playlist
      const deletePlaylistQuery = `DELETE FROM ${this.PLAYLISTS_TABLE} WHERE id = ?`;
      await this.db.run(deletePlaylistQuery, [playlistId]);

      // Delete playlist_tracks entries
      const deletePlaylistTracksQuery = `DELETE FROM ${this.PLAYLIST_TRACKS_TABLE} WHERE playlist_id = ?`;
      await this.db.run(deletePlaylistTracksQuery, [playlistId]);

      await this.db.execute('COMMIT');
    } catch (error) {
      await this.db.execute('ROLLBACK');
      console.error('Error deleting playlist', error);
    }
  }

  /**
   * Close the database when app is closed
   */
  async closeDatabase() {
    if (this.db) {
      await this.sqlite.closeConnection(this.dbName, false);
    }
  }
}
