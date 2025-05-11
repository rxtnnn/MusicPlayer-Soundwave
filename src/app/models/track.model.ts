/**
 * Track model representing a music track
 */
export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  artwork?: string;
  url: string;
  format: AudioFormat;
  isLocal: boolean;
  source: 'local' | 'audius';
  metadata?: any;
  playlists?: string[];
  isLiked?: boolean;
  dateAdded?: Date;
  lastPlayed?: Date;
}

/**
 * Supported audio formats
 */
export type AudioFormat =
  | 'mp3'   // MPEG-1 Audio Layer III (.mp3)
  | 'aac'   // Advanced Audio Codec (.m4a, .aac)
  | 'wav'   // Waveform Audio File Format (.wav)
  | 'ogg'   // Ogg Vorbis (.ogg)
  | 'flac'  // Free Lossless Audio Codec (.flac)
  | 'opus'  // Opus (.opus)
  | 'streaming'; // For streaming formats

/**
 * Playlist model
 */
export interface Playlist {
  id: string;
  name: string;
  description?: string;
  tracks: string[]; // Array of track IDs
  coverArt?: string;
  created: Date;
  updated: Date;
}
