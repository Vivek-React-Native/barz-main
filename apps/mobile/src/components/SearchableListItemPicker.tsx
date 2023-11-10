import * as React from 'react';
import { Fragment, useEffect, useRef, useState, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  SafeAreaView,
  StyleSheet,
  TextInput,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import debounce from 'lodash.debounce';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import { Paginated } from '@barz/mobile/src/lib/api';
import { Color, Typography } from '@barz/mobile/src/ui/tokens';
import TextField from '@barz/mobile/src/ui/TextField';
import { InfiniteScrollListState } from '@barz/mobile/src/lib/infinite-scroll-list';
import ListItemContainer from '@barz/mobile/src/ui/ListItemContainer';

const styles = StyleSheet.create({
  wrapper: {
    height: '100%',
    position: 'relative',
  },
  searchFieldWrapper: {
    padding: 16,
  },
  centeredWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 300,
  },
  licenseText: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    ...Typography.Body3,
    color: Color.Gray.Dark9,
  },
});

const SearchableListItemPicker = <T extends { id: any }>(props: {
  onFetchData: (page: number, value: string, signal: AbortSignal) => Promise<Paginated<T> | null>;
  onRenderItem: (
    item: T,
    onPress: () => void,
    disabled: boolean,
    testID: string,
  ) => React.ReactNode;
  onSelectItem: (item: T) => void;
  searchText: string;
  disabled?: boolean;
  onChangeSearchText: (searchText: string) => void;
  searchBoxPlaceholder?: string;
  emptyPlaceholderText: string;
  notFoundPlaceholderText: string;
  licenseText?: string;
  testID?: string;
  keyboardAppearance?: 'default' | 'light' | 'dark';
  autoFocus?: boolean;
}) => {
  const [itemListState, setItemListState] = useState<InfiniteScrollListState<T>>({
    status: 'IDLE',
  });

  // Abort any in flight requests when the component unmounts
  const abortControllersRef = useRef<Set<AbortController>>(new Set());
  useEffect(() => {
    return () => {
      for (const abortController of abortControllersRef.current) {
        abortController.abort();
      }
    };
  }, []);

  const textFieldRef = useRef<TextInput | null>(null);
  useEffect(() => {
    setTimeout(() => {
      textFieldRef.current?.focus();
    }, 100);
  }, []);

  // NOTE: store `onFetchData` into a ref so that `debouncedOnCastVote` can call the latest
  // `onFetchData` without having to depend on `onFetchData` - if there was a dependency, then the
  // debounce logic would get reset quite often since `onFetchData` changes reference quite often
  // (because it depends on the current video playback position)
  const onFetchDataRef = useRef<typeof props.onFetchData | null>(null);
  useEffect(() => {
    onFetchDataRef.current = props.onFetchData;
  }, [props.onFetchData]);

  // Every time the text input stops changing, refetch the list of data from the server
  const debouncedReloadData = useMemo(() => {
    return debounce<(text: string) => void>((text) => {
      if (!onFetchDataRef.current) {
        return;
      }

      const abort = new AbortController();
      abortControllersRef.current.add(abort);

      onFetchDataRef
        .current(1, text, abort.signal)
        .then((result) => {
          abortControllersRef.current.delete(abort);
          if (!result) {
            setItemListState({ status: 'IDLE' });
            return;
          }
          setItemListState({
            status: 'COMPLETE',
            total: result.total,
            data: result.results,
            pageNumber: 1,
            nextPageAvailable: result.next,
          });
        })
        .catch((error) => {
          abortControllersRef.current.delete(abort);
          if (error.name === 'AbortError') {
            return;
          }

          console.error(`Error loading page 1 of SearchableListItemPicker data: ${error.message}`);
          setItemListState({ status: 'ERROR', error });
        });
    }, 500);
  }, [setItemListState]);

  // When the component first mounts, fetch the data an initial time
  useEffect(() => {
    const abort = new AbortController();
    abortControllersRef.current.add(abort);

    if (!onFetchDataRef.current) {
      return;
    }

    setItemListState({ status: 'LOADING_INITIAL_PAGE' });

    onFetchDataRef
      .current(1, props.searchText, abort.signal)
      .then((result) => {
        abortControllersRef.current.delete(abort);
        if (!result) {
          setItemListState({ status: 'IDLE' });
          return;
        }
        setItemListState({
          status: 'COMPLETE',
          total: result.total,
          data: result.results,
          pageNumber: 1,
          nextPageAvailable: result.next,
        });
      })
      .catch((error) => {
        abortControllersRef.current.delete(abort);
        if (error.name === 'AbortError') {
          return;
        }

        console.error(`Error loading page 1 of SearchableListItemPicker data: ${error.message}`);
        setItemListState({ status: 'ERROR', error });
      });
  }, []);

  let innerContent: React.ReactNode | null = null;
  switch (itemListState.status) {
    case 'IDLE': {
      innerContent = (
        <View style={styles.centeredWrapper}>
          <Text style={{ ...Typography.Body1, color: Color.Gray.Dark7 }}>
            {props.emptyPlaceholderText}
          </Text>
        </View>
      );
      break;
    }
    case 'LOADING_INITIAL_PAGE': {
      innerContent = (
        <View style={styles.centeredWrapper}>
          <ActivityIndicator />
        </View>
      );
      break;
    }

    case 'COMPLETE':
    case 'LOADING_NEW_PAGE': {
      if (itemListState.data.length === 0) {
        innerContent = (
          <View style={styles.centeredWrapper}>
            <Text style={{ ...Typography.Body1, color: Color.Gray.Dark7 }}>
              {props.notFoundPlaceholderText}
            </Text>
          </View>
        );
      } else {
        innerContent = (
          <KeyboardAwareScrollView keyboardShouldPersistTaps="always">
            <ListItemContainer>
              {itemListState.data.map((item) => (
                <Fragment key={item.id}>
                  {props.onRenderItem(
                    item,
                    () => props.onSelectItem(item),
                    props.disabled || false,
                    `${props.testID}-item`,
                  )}
                </Fragment>
              ))}
            </ListItemContainer>
          </KeyboardAwareScrollView>
        );
      }
      break;
    }
    case 'ERROR': {
      innerContent = (
        <View style={styles.centeredWrapper}>
          <Text style={{ ...Typography.Body1, color: Color.White }}>Error loading data!</Text>
        </View>
      );
      break;
    }
  }

  return (
    <SafeAreaView>
      <KeyboardAvoidingView>
        <View style={styles.wrapper} testID={`${props.testID}-wrapper`}>
          <View style={styles.searchFieldWrapper}>
            <TextField
              ref={textFieldRef}
              keyboardAppearance={props.keyboardAppearance || 'default'}
              size={40}
              autoFocus={props.autoFocus || false}
              placeholder={props.searchBoxPlaceholder}
              value={props.searchText}
              onChangeText={(value) => {
                props.onChangeSearchText(value);
                setItemListState({ status: 'LOADING_INITIAL_PAGE' });
                debouncedReloadData(value);
              }}
              testID={`${props.testID}-search-field`}
              disabled={props.disabled}
            />
          </View>
          {innerContent}

          {props.licenseText ? <Text style={styles.licenseText}>{props.licenseText}</Text> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SearchableListItemPicker;
