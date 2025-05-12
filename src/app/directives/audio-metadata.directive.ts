import { Directive, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
// Import jsmediatags for metadata extraction
import * as jsmediatags from 'jsmediatags';
import { Track } from '../models/track.model';
// Define our metadata result interface
interface MetadataResult {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  genre?: string;
  picture?: {
    format: string;
    data: number[];
  };
}

@Directive({
  selector: '[appAudioMetadata]'
})
export class AudioMetadataDirective implements OnChanges {
  @Input() audioFilePath: string = ''; // Initialize with empty string
  @Input() track: Track | any;
  @Output() metadataLoaded = new EventEmitter<Partial<Track>>();

  isNative: boolean;

  constructor(private platform: Platform) {
    this.isNative = Capacitor.isNativePlatform();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['audioFilePath'] && this.audioFilePath) {
      this.extractMetadata();
    }
  }

  /**
   * Extract metadata from audio file
   */
  private async extractMetadata() {
    try {
      if (!this.audioFilePath) {
        console.warn('No audio file path provided');
        return;
      }

      if (this.isNative) {
        // Native solution (for Capacitor)
        await this.extractMetadataNative();
      } else {
        // Web solution
        await this.extractMetadataWeb();
      }
    } catch (error) {
      console.error('Error extracting metadata', error);
    }
  }

  /**
   * Extract metadata using native capabilities
   */
  private async extractMetadataNative() {
    try {
      // Ensure we have a valid file path
      if (!this.audioFilePath) {
        throw new Error('No audio file path provided');
      }

      // Create an audio element to get basic duration info
      const audio = new Audio();
      audio.src = this.audioFilePath;

      // Set up a promise to wait for metadata loading
      const durationPromise = new Promise<number>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Timeout waiting for metadata'));
        }, 5000); // 5 second timeout

        audio.addEventListener('loadedmetadata', () => {
          clearTimeout(timeoutId);
          if (audio.duration && audio.duration !== Infinity) {
            resolve(audio.duration);
          } else {
            reject(new Error('Invalid duration'));
          }
        });

        audio.addEventListener('error', (err) => {
          clearTimeout(timeoutId);
          reject(err);
        });
      });

      // Try to get the duration
      try {
        const duration = await durationPromise;

        const updatedTrack: Partial<Track> = {
          duration: duration
        };

        this.metadataLoaded.emit(updatedTrack);
      } catch (err) {
        console.error('Error getting duration', err);
      }
    } catch (error) {
      console.error('Error extracting native metadata', error);
    }
  }

  /**
   * Extract metadata using web APIs (jsmediatags and audio element)
   */
  private async extractMetadataWeb() {
    if (!this.audioFilePath) {
      console.warn('No audio file path provided');
      return;
    }

    // If we have a file URL, we can use jsmediatags to extract metadata
    if (this.audioFilePath.startsWith('blob:') || this.audioFilePath.startsWith('http')) {
      try {
        jsmediatags.read(this.audioFilePath, {
          onSuccess: (result) => {
            const tags = result.tags;
            const metadata: MetadataResult = {};

            if (tags.title) metadata.title = tags.title;
            if (tags.artist) metadata.artist = tags.artist;
            if (tags.album) metadata.album = tags.album;
            if (tags.year) metadata.year = tags.year;
            if (tags.genre) metadata.genre = tags.genre;

            // Safely handle picture metadata
            if (tags.picture) {
              metadata.picture = {
                format: tags.picture.format,
                data: tags.picture.data
              };
            }

            let artworkUrl: string | undefined;

            // Convert picture data to URL if available
            if (metadata.picture) {
              // Use a different method to convert number[] to base64
              const base64String = this.numberArrayToBase64(metadata.picture.data);
              artworkUrl = `data:${metadata.picture.format};base64,${base64String}`;
            }

            const updatedTrack: Partial<Track> = {};

            if (metadata.title) updatedTrack.title = metadata.title;
            if (metadata.artist) updatedTrack.artist = metadata.artist;
            if (metadata.album) updatedTrack.album = metadata.album;
            if (artworkUrl) updatedTrack.artwork = artworkUrl;

            this.metadataLoaded.emit(updatedTrack);
          },
          onError: (error) => {
            console.error('Error reading tags', error);
          }
        });
      } catch (error) {
        console.error('Error with jsmediatags', error);
      }
    }

    // Get audio duration using the audio element for web-based files (remote or local)
    try {
      const audio = new Audio();
      audio.src = this.audioFilePath; // Safe now because we checked above

      audio.addEventListener('loadedmetadata', () => {
        if (audio.duration && audio.duration !== Infinity) {
          const updatedTrack: Partial<Track> = {
            duration: audio.duration
          };

          this.metadataLoaded.emit(updatedTrack);
        }
      });

      audio.load();
    } catch (error) {
      console.error('Error getting audio duration', error);
    }
  }

  /**
   * Convert a number array (from jsmediatags) to base64 string
   * This is a separate method specifically for handling jsmediatags picture data
   */
  private numberArrayToBase64(data: number[]): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    let i;

    // Convert from number[] to Uint8Array
    const bytes = new Uint8Array(data);

    // Base64 encoding logic
    for (i = 0; i < bytes.length; i += 3) {
      const byte1 = bytes[i];
      const byte2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
      const byte3 = i + 2 < bytes.length ? bytes[i + 2] : 0;

      const triplet = (byte1 << 16) | (byte2 << 8) | byte3;

      result += charset[(triplet >> 18) & 0x3F];
      result += charset[(triplet >> 12) & 0x3F];

      if (i + 1 < bytes.length) {
        result += charset[(triplet >> 6) & 0x3F];
      } else {
        result += '=';
      }

      if (i + 2 < bytes.length) {
        result += charset[triplet & 0x3F];
      } else {
        result += '=';
      }
    }

    return result;
  }

  /**
   * Convert array buffer to base64 string
   * This method is kept for potential future use with actual Uint8Array inputs
   */
  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    const len = buffer.byteLength;

    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(buffer[i]);
    }

    return window.btoa(binary);
  }
}
