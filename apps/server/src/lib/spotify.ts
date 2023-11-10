import fetch from 'node-fetch';
import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } from '@barz/server/src/config.ts';
import { FixMe } from '@barz/server/src/lib/fixme.ts';
import { addSeconds, isBefore } from 'date-fns';

let accessToken: string | null = null;
let accessTokenExpiresAt: Date | null = null;

// This constant defines a number of seconds that the spotify token should be refetched before it
// expires to account for slop in timestamp generation between spotify and barz
const SPOTIFY_EXPIRES_AT_TOLERANCE_SECONDS = 60;

const Spotify = {
  async generateNewToken() {
    // ref: https://developer.spotify.com/documentation/web-api/tutorials/getting-started#request-an-access-token
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=client_credentials&client_id=${SPOTIFY_CLIENT_ID}&client_secret=${SPOTIFY_CLIENT_SECRET}`,
    });

    if (!response.ok) {
      accessToken = null;
      accessTokenExpiresAt = null;
      throw new Error(
        `Unable to get access token from spotify api: ${response.status} ${await response.text()}`,
      );
    }

    const json = (await response.json()) as {
      access_token: string;
      token_type: 'Bearer';
      expires_in: number;
    };
    accessToken = json['access_token'];
    accessTokenExpiresAt = addSeconds(
      new Date(),
      json['expires_in'] - SPOTIFY_EXPIRES_AT_TOLERANCE_SECONDS,
    );

    return accessToken;
  },
  async refreshTokenIfRequired() {
    const now = new Date();
    if (accessToken && accessTokenExpiresAt && isBefore(now, accessTokenExpiresAt)) {
      return accessToken;
    }

    return Spotify.generateNewToken();
  },

  // When called, makes a request to the spotify api to get a list of artists that match the search
  // query
  async searchForArtist(artistName: string, limit?: number, offset?: number) {
    let token;
    try {
      token = await Spotify.refreshTokenIfRequired();
    } catch (err: FixMe) {
      throw new Error(`Error refreshing token: ${err.message}`);
    }

    let url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist`;
    if (typeof limit === 'number') {
      url += `&limit=${limit}`;
    }
    if (typeof offset === 'number') {
      url += `&offset=${offset}`;
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Error searching for artist: ${response.status} ${await response.text()}`);
    }

    const json = (await response.json()) as {
      artists: {
        href: string;
        limit: number;
        next: string | null;
        offset: number;
        previous: string | null;
        total: number;
        items: Array<{
          external_urls: { [key: string]: string };
          followers: { href: string | null; total: number };
          genres: Array<string>;
          href: string;
          id: string;
          images: Array<{ url: string; height: number; width: number }>;
          name: string;
          popularity: number;
          type: 'artist';
          uri: string;
        }>;
      };
    };

    return {
      total: json.artists.total,
      next: json.artists.next !== null,
      results: json.artists.items,
    };
  },

  // When called, makes a request to the spotify api to get a list of tracks that match the search
  // query
  async searchForTrack(songName: string, limit?: number, offset?: number) {
    let token;
    try {
      token = await Spotify.refreshTokenIfRequired();
    } catch (err: FixMe) {
      throw new Error(`Error refreshing token: ${err.message}`);
    }

    let url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(songName)}&type=track`;
    if (typeof limit === 'number') {
      url += `&limit=${limit}`;
    }
    if (typeof offset === 'number') {
      url += `&offset=${offset}`;
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Error searching for track: ${response.status} ${await response.text()}`);
    }

    const json = (await response.json()) as {
      tracks: {
        href: string;
        limit: number;
        next: string | null;
        offset: number;
        previous: string | null;
        total: number;
        items: Array<{
          album: {
            album_type: 'album' | 'single' | 'compilation';
            total_tracks: number;
            external_urls: { [key: string]: string };
            href: string;
            id: string;
            images: Array<{ url: string; height: number; width: number }>;
            name: string;
            release_date: string;
            release_date_precision: string;
            type: 'album';
            uri: string;
            artists: Array<{
              external_urls: { [key: string]: string };
              href: string;
              id: string;
              name: string;
              type: 'artist';
              uri: string;
            }>;
            is_playable: boolean;
          };
          artists: Array<{
            external_urls: { [key: string]: string };
            href: string;
            id: string;
            name: string;
            type: 'artist';
            uri: string;
          }>;
          disc_number: number;
          duration_ms: number;
          explicit: boolean;
          external_ids: { [key: string]: any };
          external_urls: { [key: string]: string };
          href: string;
          id: string;
          is_playable: boolean;
          name: string;
          popularity: number;
          preview_url: string | null;
          track_number: number;
          type: 'track';
          uri: string;
          is_local: false;
        }>;
      };
    };

    return {
      total: json.tracks.total,
      next: json.tracks.next !== null,
      results: json.tracks.items,
    };
  },
};

export default Spotify;
