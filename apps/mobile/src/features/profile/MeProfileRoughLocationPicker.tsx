import * as React from 'react';
import { useCallback, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';

import { BarzAPI, RoughLocation } from '@barz/mobile/src/lib/api';
import ListItem from '@barz/mobile/src/ui/ListItem';
import SearchableListItemPicker from '@barz/mobile/src/components/SearchableListItemPicker';

import { PageProps } from '.';

const MeProfileRoughLocationPicker: React.FunctionComponent<{
  // FIXME: navigation is being specified this way so that this component can be used in the
  // battle feature during the battle intro workflow to require a user to set their location before
  // battling
  //
  // This probably needs to be refactored into a shared component both features can pull in!
  navigation: PageProps<'Profile > Rough Location Picker'>['navigation'];

  onResolve: ((value: RoughLocation | null) => void) | null;
  onReject: ((err: Error) => void) | null;
  searchText: string;
  onChangeSearchText: (text: string) => void;
}> = ({ navigation, onResolve, onReject, searchText, onChangeSearchText }) => {
  const { getToken } = useAuth();

  const [licenseText, setLicenseText] = useState('');

  const onFetchData = useCallback(
    async (_page: number, value: string) => {
      setLicenseText('');

      if (value.length === 0) {
        return null;
      }

      return BarzAPI.geocodeAddress(getToken, value).then((response) => {
        setLicenseText((response[0] && response[0].licence) || '');

        return {
          next: false,
          total: response.length,
          results: response.map((result) => {
            return {
              id: `${result.osm_id}`,
              name: `${result.name}`,
              latitude: parseFloat(result.lat),
              longitude: parseFloat(result.lon),
              fullName: `${result.display_name}`,
            };
          }),
        };
      });
    },
    [getToken, setLicenseText],
  );

  if (!onResolve || !onReject) {
    return null;
  }

  return (
    <SearchableListItemPicker
      onFetchData={onFetchData}
      onRenderItem={(item, onPress, disabled, testID) => (
        <ListItem description={item.fullName} onPress={onPress} testID={testID} disabled={disabled}>
          {item.name}
        </ListItem>
      )}
      onSelectItem={(item) => {
        navigation.goBack();
        onResolve({
          name: item.name,
          latitude: item.latitude,
          longitude: item.longitude,
        });
      }}
      searchText={searchText}
      onChangeSearchText={onChangeSearchText}
      searchBoxPlaceholder="Add your location"
      emptyPlaceholderText="Search for location"
      notFoundPlaceholderText="No locations found"
      licenseText={licenseText}
      testID="user-bio-edit-rough-location-picker"
    />
  );
};

export default MeProfileRoughLocationPicker;
