-- AlterTable
ALTER TABLE "clerk_user" ADD COLUMN     "favorite_rapper_name" TEXT,
ADD COLUMN     "favorite_rapper_spotify_id" TEXT,
ADD COLUMN     "favorite_song_artist_name" TEXT,
ADD COLUMN     "favorite_song_name" TEXT,
ADD COLUMN     "favorite_song_spotify_id" TEXT,
ADD COLUMN     "instagram_handle" TEXT,
ADD COLUMN     "intro" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "location_latitude" TEXT,
ADD COLUMN     "location_longitude" TEXT,
ADD COLUMN     "location_name" TEXT,
ADD COLUMN     "soundcloud_handle" TEXT;
