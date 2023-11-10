import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  FlatListProps,
  ViewToken,
  ListRenderItemInfo,
  ActivityIndicator,
} from 'react-native';
import { Color, Typography } from '@barz/mobile/src/ui/tokens';

const DATA_FROM_BOTTOM_TO_FETCH_NEXT_PAGE = 10;
const REFRESH_ITEM_HEIGHT = 48;

const InfiniteScrollFlatList = <ItemT extends object>(
  props: FlatListProps<ItemT> & {
    allDataHasBeenFetched: boolean;
    fetchingNextPage: boolean;
    onFetchNextPage: () => void;
  },
) => {
  const {
    allDataHasBeenFetched,
    fetchingNextPage,
    onFetchNextPage,

    testID,
    renderItem,
    onViewableItemsChanged,
    getItemLayout,
    ...rest
  } = props;

  // When the largest viewable index gets near the end of the list, attempt to load more data - this
  // implements "infinite scroll"
  const [largestViewableIndex, setLargestViewableIndex] = useState(0);
  const dataLength = rest.data ? rest.data.length : 0;
  useEffect(() => {
    if (allDataHasBeenFetched) {
      return;
    }
    if (largestViewableIndex > dataLength - DATA_FROM_BOTTOM_TO_FETCH_NEXT_PAGE) {
      onFetchNextPage();
    }
  }, [largestViewableIndex, dataLength, allDataHasBeenFetched, onFetchNextPage]);

  // Store a copy of the `onViewableItemsChanged` prop in the below ref, so `onViewableItemsChangedRef` can proxy through any calls
  const propOnViewableItemsChangedRef = useRef<
    FlatListProps<ItemT>['onViewableItemsChanged'] | null
  >(null);
  useEffect(() => {
    propOnViewableItemsChangedRef.current = onViewableItemsChanged;
  }, [onViewableItemsChanged]);

  // FIXME: this is in a ref on purpose, a usecallback doesn't work... for more info:
  // https://stackoverflow.com/questions/65256340/keep-getting-changing-onviewableitemschanged-on-the-fly-is-not-supported
  const onViewableItemsChangedRef = useRef(
    (data: { viewableItems: Array<ViewToken>; changed: Array<ViewToken> }) => {
      if (data.viewableItems.length < 1) {
        return;
      }
      const largestIndex = Math.max(
        ...data.viewableItems
          .filter((i) => i.isViewable)
          .map((i) => i.index)
          .filter((i): i is number => i !== null),
      );
      setLargestViewableIndex(largestIndex);

      // Proxy through any calls to the prop passed into this component as well
      if (propOnViewableItemsChangedRef.current) {
        propOnViewableItemsChangedRef.current(data);
      }
    },
  );

  const infiniteScrollRenderItem = useCallback<
    NonNullable<FlatListProps<ItemT | 'REFRESH_ITEM'>['renderItem']>
  >(
    (data) => {
      if (data.item === 'REFRESH_ITEM') {
        return (
          <View
            style={{
              width: '100%',
              height: REFRESH_ITEM_HEIGHT,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            testID={`${testID}-refreshing`}
          >
            <ActivityIndicator size="small" />
          </View>
        );
      }

      if (renderItem) {
        return renderItem(data as ListRenderItemInfo<ItemT>);
      } else {
        return null;
      }
    },
    [renderItem],
  );

  return (
    <FlatList<ItemT | 'REFRESH_ITEM'>
      initialNumToRender={10}
      {...rest}
      testID={testID}
      data={[
        ...(rest.data ? (rest.data as Array<ItemT>) : []),
        ...(fetchingNextPage ? ['REFRESH_ITEM' as const] : []),
      ]}
      getItemLayout={
        getItemLayout
          ? (data, index) => {
              if (data && data[index] === 'REFRESH_ITEM') {
                const previousLayout = getItemLayout(
                  data.slice(0, index) as Array<ItemT>,
                  index - 1,
                );
                return {
                  index,
                  length: REFRESH_ITEM_HEIGHT,
                  offset: previousLayout.offset + previousLayout.length,
                };
              }

              return getItemLayout(data ? (data.slice(0, index) as Array<ItemT>) : data, index);
            }
          : undefined
      }
      onViewableItemsChanged={onViewableItemsChangedRef.current}
      renderItem={infiniteScrollRenderItem}
      keyExtractor={
        rest.keyExtractor
          ? (item, index) => {
              if (item === 'REFRESH_ITEM') {
                return 'refresh';
              }
              return rest.keyExtractor!(item, index);
            }
          : undefined
      }
    />
  );
};

export default InfiniteScrollFlatList;
