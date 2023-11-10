import * as React from 'react';
import { useCallback } from 'react';
import { useAuth } from '@clerk/clerk-expo';

import { BarzAPI, FavoriteArtist, Paginated } from '@barz/mobile/src/lib/api';
import ListItem from '@barz/mobile/src/ui/ListItem';
import SearchableListItemPicker from '@barz/mobile/src/components/SearchableListItemPicker';

import { PageProps } from '.';

const MeProfileFavoriteArtistPicker: React.FunctionComponent<{
  // FIXME: navigation is being specified this way so that this component can be used in the
  // battle feature during the battle intro workflow to require a user to set their favorite artist before
  // battling
  //
  // This probably needs to be refactored into a shared component both features can pull in!
  navigation: PageProps<'Profile > Favorite Artist Picker'>['navigation'];

  onResolve: ((value: FavoriteArtist | null) => void) | null;
  onReject: ((err: Error) => void) | null;
  searchText: string;
  onChangeSearchText: (text: string) => void;
}> = ({ navigation, onResolve, onReject, searchText, onChangeSearchText }) => {
  const { getToken } = useAuth();

  const onFetchData = useCallback(
    async (page: number, value: string): Promise<Paginated<FavoriteArtist> | null> => {
      if (value.length === 0) {
        return null;
      }
      return BarzAPI.searchSpotifyArtists(getToken, value, page).then((response) => {
        return {
          ...response,
          results: response.results.map((item) => {
            return {
              id: item.id,
              name: item.name,
            };
          }),
        };
      });
    },
    [getToken],
  );

  if (!onResolve || !onReject) {
    return null;
  }

  return (
    <SearchableListItemPicker
      onFetchData={onFetchData}
      onRenderItem={(item, onPress, disabled, testID) => (
        <ListItem onPress={onPress} testID={testID} disabled={disabled}>
          {item.name}
        </ListItem>
      )}
      onSelectItem={(item) => {
        navigation.goBack();
        onResolve(item);
      }}
      searchText={searchText}
      searchBoxPlaceholder="Search for your favorite artist"
      onChangeSearchText={onChangeSearchText}
      emptyPlaceholderText="Search for rappers"
      notFoundPlaceholderText="No rappers found"
      testID="user-bio-edit-favorite-artist-picker"
    />
  );
};

export default MeProfileFavoriteArtistPicker;
