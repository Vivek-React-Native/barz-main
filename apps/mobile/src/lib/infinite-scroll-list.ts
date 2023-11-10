import { Paginated } from './api';
import { FixMe } from './fixme';

export type InfiniteScrollListState<T> =
  | { status: 'IDLE' }
  | { status: 'LOADING_INITIAL_PAGE' }
  | {
      status: 'COMPLETE';
      total: number;
      data: Array<T>;
      pageNumber: number;
      nextPageAvailable: boolean;
    }
  | {
      status: 'LOADING_NEW_PAGE';
      total: number;
      data: Array<T>;
    }
  | {
      status: 'ERROR';
      error: Error;
    };

export const fetchInitialPage = async <T extends object>(
  setState: (fn: (old: InfiniteScrollListState<T>) => InfiniteScrollListState<T>) => void,
  fetchPageOfData: (pageNumber: number) => Promise<Paginated<T>>,
  onError?: (error: Error) => void,
) => {
  setState(() => ({ status: 'LOADING_INITIAL_PAGE' }));

  return fetchPageOfData(1)
    .then((dataPage) => {
      setState(() => ({
        status: 'COMPLETE',
        total: dataPage.total,
        pageNumber: 1,
        data: dataPage.results,
        nextPageAvailable: dataPage.next,
      }));
    })
    .catch((error) => {
      setState(() => ({ status: 'ERROR', error }));
      if (onError) {
        onError(error);
      }
    });
};

export const fetchNextPage = async <T extends object>(
  state: InfiniteScrollListState<T>,
  setState: (fn: (old: InfiniteScrollListState<T>) => InfiniteScrollListState<T>) => void,
  fetchPageOfData: (pageNumber: number) => Promise<Paginated<T>>,
  onError?: (error: Error, pageNumber: number) => void,
  getId: (item: T) => string = (n) => (n as FixMe).id,
) => {
  if (state.status !== 'COMPLETE') {
    return;
  }
  if (!state.nextPageAvailable) {
    // There are no more pages of data to fetch!
    return;
  }

  const originalState = state;

  setState((old) => {
    if (old.status !== 'COMPLETE') {
      return old;
    }

    return {
      status: 'LOADING_NEW_PAGE',
      total: state.total,
      data: state.data,
    };
  });

  const page = state.pageNumber + 1;

  return fetchPageOfData(page)
    .then((dataPage) => {
      setState((old) => {
        if (old.status !== 'LOADING_NEW_PAGE') {
          return old;
        }

        // Update any existing items in the list
        const itemIdsUpdated = new Set<string>();
        const newData = old.data.map((item) => {
          const matchingItem = dataPage.results.find((i) => getId(i) === getId(item));
          if (matchingItem) {
            itemIdsUpdated.add(getId(matchingItem));
            return matchingItem;
          } else {
            return item;
          }
        });

        return {
          status: 'COMPLETE',
          total: dataPage.total,
          pageNumber: page,
          data: [
            ...newData,
            // And add any remaining items not already in the list to the end
            ...dataPage.results.filter((item) => !itemIdsUpdated.has(getId(item))),
          ],
          nextPageAvailable: dataPage.next,
        };
      });
    })
    .catch((error) => {
      setState(() => originalState);
      if (onError) {
        onError(error, page);
      }
    });
};
