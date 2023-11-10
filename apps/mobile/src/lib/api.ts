import { AppStateStatus } from 'react-native';
import { PusherAuthorizerResult } from '@pusher/pusher-websocket-react-native';

import { FixMe } from './fixme';
import { BattleStateMachineEvent } from './state-machine';
import { generateBarzAPIBaseUrl } from './environment';
import { EnvironmentCache } from './cache';

export type Paginated<T extends object> = {
  total: number;
  next: boolean;
  results: Array<T>;
};

// FIXME: import these types directly from the server code once that is brought into the monorepo
// project
export type Battle = {
  id: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  madeInactiveAt: string | null;
  madeInactiveReason: string | null;
  numberOfRounds: number;
  turnLengthSeconds: number;
  warmupLengthSeconds: number;
  twilioRoomName: string;
  beatId: string | null;
  votingEndsAt: string | null;
  computedPrivacyLevel: 'PRIVATE' | 'PUBLIC';

  exportedVideoStatus:
    | 'QUEUING'
    | 'DOWNLOADING'
    | 'COMPOSITING'
    | 'UPLOADING'
    | 'COMPLETED'
    | 'ERROR'
    | 'DISABLED'
    | null;
  exportedVideoKey: string | null;
  exportedVideoQueuedAt: string | null;
  exportedVideoStartedAt: string | null;
  exportedVideoCompletedAt: string | null;
};

export type BattleWithParticipants = Battle & {
  participants: Array<Omit<BattleParticipant, 'battleId'>>;
};

export type BattleWithParticipantsAndCheckinsAndEvents = Battle & {
  participants: Array<
    Omit<BattleParticipant, 'battleId'> & {
      checkins: Array<
        Pick<
          BattleParticipantCheckin,
          'id' | 'createdAt' | 'updatedAt' | 'checkedInAt' | 'state' | 'context'
        >
      >;
    }
  >;
  stateMachineEvents: Array<
    Pick<
      BattleParticipantStateMachineEvent,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
      | 'clientGeneratedUuid'
      | 'triggeredByParticipantId'
      | 'payload'
    >
  >;
};

export type BattleParticipant = {
  id: string;
  createdAt: string;
  updatedAt: string;
  associatedWithBattleAt: string | null;
  lastCheckedInAt: string;
  connectionStatus: 'UNKNOWN' | 'ONLINE' | 'OFFLINE';
  initialMatchFailed: boolean;
  battleId: string | null;
  readyForBattleAt: string | null;
  requestedBattlePrivacyLevel: 'PRIVATE' | 'PUBLIC' | null;
  twilioAudioTrackId: string | null;
  twilioVideoTrackId: string | null;
  twilioDataTrackId: string | null;
  forfeitedAt: string | null;
  videoStreamingStartedAt: string | null;
  madeInactiveAt: string | null;
  madeInactiveReason: string | null;
  currentState: string;
  currentContext: object;
  userId: string;
  order: number | null;
  appState: AppStateStatus | null;
  twilioCompositionSid: string | null;
  twilioCompositionStatus: string | null;
  user: User;
};

export type BattleParticipantCheckin = {
  id: string;
  createdAt: string;
  updatedAt: string;
  checkedInAt: string;
  battleParticipantId: string;
  state: string;
  context: object;
};

export type BattleParticipantStateMachineEvent = {
  id: string;
  createdAt: string;
  updatedAt: string;
  battleId: string;
  clientGeneratedUuid: string;
  triggeredByParticipantId: string;
  payload: object;
};

export type BattleRecording = {
  battleId: Battle['id'];
  battleStartedAt: Battle['startedAt'];
  battleCompletedAt: Battle['completedAt'];
  battleComputedPrivacyLevel: Battle['computedPrivacyLevel'];
  battleComputedHasBeenForfeited: false;
  battleExportedVideoUrl: string | null;
  battleVotingEndsAt: string | null;
  battleCommentTotal: number;
  phases: Array<{
    startsAt: string;
    startsAtVideoStreamOffsetMilliseconds: number | null;
    endsAt: string;
    endsAtVideoStreamOffsetMilliseconds: number | null;
    state: BattleParticipant['currentState'];
    activeParticipantId: BattleParticipant['id'] | null;
  }>;
  participants: Array<{
    id: BattleParticipant['id'];
    order: BattleParticipant['order'];
    twilioAudioTrackId: BattleParticipant['twilioAudioTrackId'];
    twilioVideoTrackId: BattleParticipant['twilioVideoTrackId'];
    twilioDataTrackId: BattleParticipant['twilioDataTrackId'];
    forfeitedAt: BattleParticipant['forfeitedAt'];
    videoStreamingStartedAt: BattleParticipant['videoStreamingStartedAt'];
    madeInactiveAt: BattleParticipant['madeInactiveAt'];
    mediaUrl: string | null;
    mediaThumbnailUrls: { [size: string]: string };
    mediaOffsetMilliseconds: number;

    computedTotalVoteAmount: number;

    user: User;
  }>;
};

export type ForfeitedBeforeStartBattleRecording = {
  battleId: Battle['id'];
  battleStartedAt: null;
  battleCompletedAt: null;
  battleComputedPrivacyLevel: Battle['computedPrivacyLevel'];
  battleComputedHasBeenForfeited: true;
  battleExportedVideoUrl: null;
  battleVotingEndsAt: null;
  battleCommentTotal: 0;
  phases: [];
  participants: BattleRecording['participants'];
};

export type BattleComment = {
  id: string;
  commentedAt: string;
  text: string;
  battleId: Battle['id'];
  user: User;
  computedVoteTotal: number;
  computedHasBeenVotedOnByUserMe: boolean | null;
};

export type User = {
  id: string;
  handle: string | null;
  name: string | null;
  profileImageUrl: string | null;
  computedScore: number;
  computedFollowersCount: number;
  computedFollowingCount: number;
};
export type ExpandedUser = User & {
  intro: string;
  locationName: string | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
  favoriteRapperSpotifyId: string | null;
  favoriteRapperName: string | null;
  favoriteSongSpotifyId: string | null;
  favoriteSongName: string | null;
  favoriteSongArtistName: string | null;
  instagramHandle: string | null;
  soundcloudHandle: string | null;
};

export type UserInContextOfUserMe = ExpandedUser & {
  computedIsBeingFollowedByUserMe: boolean;
  computedIsFollowingUserMe: boolean;
};

export type UserMe = UserInContextOfUserMe & {
  phoneNumber: string;
  lastViewedBattleId: Battle['id'] | null;
  maxNumberOfVotesPerBattle: number;
};

export type FavoriteArtist = {
  name: string;
  id: string | null;
};
export type FavoriteTrack = {
  name: string;
  id: string | null;
  artistName: string | null;
};
export type RoughLocation = {
  name: string;
  latitude: number | null;
  longitude: number | null;
};

export type Challenge = {
  id: string;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  createdByUser: User;
  challengedUserId: string;
  challengedUser: User;
  status: 'PENDING' | 'STARTED' | 'CANCELLED';
  startedAt: string | null;
  startedByUserId: string | null;
  cancelledAt: string | null;
  cancelledByUserId: string | null;
  battleId: string | null;
};

export type StateMachineDefinition = FixMe;

export const BarzAPI = {
  async getUserMe(getToken: () => Promise<string | null>, signal?: AbortSignal): Promise<UserMe> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const userResponse = await fetch(`${baseUrl}/v1/users/me`, {
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!userResponse.ok) {
      throw new Error(
        `Error fetching user info: ${userResponse.status} ${await userResponse.text()}`,
      );
    }
    return userResponse.json();
  },
  async getUser(
    getToken: () => Promise<string | null>,
    userId: User['id'],
    signal?: AbortSignal,
  ): Promise<UserInContextOfUserMe> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const userResponse = await fetch(`${baseUrl}/v1/users/${userId}`, {
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!userResponse.ok) {
      throw new Error(
        `Error fetching user info for user with id ${userId}: ${
          userResponse.status
        } ${await userResponse.text()}`,
      );
    }
    return userResponse.json();
  },
  async updateUserById(
    getToken: () => Promise<string | null>,
    userId: User['id'],
    fields: Partial<UserInContextOfUserMe>,
    signal?: AbortSignal,
  ): Promise<UserInContextOfUserMe> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const userResponse = await fetch(`${baseUrl}/v1/users/${userId}`, {
      signal,
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fields),
    });
    if (!userResponse.ok) {
      throw new Error(
        `Error updating user with id ${userId}: ${
          userResponse.status
        } ${await userResponse.text()}`,
      );
    }
    return userResponse.json();
  },
  async getUsers(
    getToken: () => Promise<string | null>,
    page: number,
    search?: string,
    signal?: AbortSignal,
  ): Promise<Paginated<UserInContextOfUserMe>> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const response = await fetch(
      `${baseUrl}/v1/users?page=${page}${search ? `&search=${search}` : ''}`,
      {
        signal,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Error getting a list of users: ${response.status} ${await response.text()}`);
    }
    return response.json();
  },
  async getPregeneratedRandomRapTag(
    getToken: () => Promise<string | null>,
    signal?: AbortSignal,
  ): Promise<string> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const response = await fetch(`${baseUrl}/v1/users/generated-rap-tag`, {
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(
        `Error fetching generated rap tag: ${response.status} ${await response.text()}`,
      );
    }
    return (await response.json()).name;
  },
  async followUser(
    getToken: () => Promise<string | null>,
    userToFollowId: User['id'],
  ): Promise<void> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const followResponse = await fetch(`${baseUrl}/v1/users/${userToFollowId}/follow`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!followResponse.ok) {
      throw new Error(
        `Error following user with id ${userToFollowId}: ${
          followResponse.status
        } ${await followResponse.text()}`,
      );
    }
  },
  async unfollowUser(
    getToken: () => Promise<string | null>,
    userToUnfollowId: User['id'],
  ): Promise<void> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const unfollowResponse = await fetch(`${baseUrl}/v1/users/${userToUnfollowId}/unfollow`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!unfollowResponse.ok) {
      throw new Error(
        `Error unfollowing user with id ${userToUnfollowId}: ${
          unfollowResponse.status
        } ${await unfollowResponse.text()}`,
      );
    }
  },
  async getFollowing(
    getToken: () => Promise<string | null>,
    userId: User['id'],
    page: number = 1,
    signal?: AbortSignal,
  ): Promise<Paginated<UserInContextOfUserMe>> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const response = await fetch(`${baseUrl}/v1/users/${userId}/following?page=${page}`, {
      signal,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(
        `Error getting users that the user with id ${userId} follows: ${
          response.status
        } ${await response.text()}`,
      );
    }
    return response.json();
  },
  async getFollowers(
    getToken: () => Promise<string | null>,
    userId: User['id'],
    page: number = 1,
    signal?: AbortSignal,
  ): Promise<Paginated<UserInContextOfUserMe>> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const response = await fetch(`${baseUrl}/v1/users/${userId}/followers?page=${page}`, {
      signal,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(
        `Error getting users that follow the user with id ${userId}: ${
          response.status
        } ${await response.text()}`,
      );
    }
    return response.json();
  },
  async getBattlesUserParticipatedIn(
    getToken: () => Promise<string | null>,
    userId: User['id'],
    page: number = 1,
    sort: 'RECENT' | 'TRENDING' = 'RECENT',
    includeEmptyForfeitedBattles = false,
    signal?: AbortSignal,
  ): Promise<Paginated<ForfeitedBeforeStartBattleRecording | BattleRecording>> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const pageSize = 10;
    const response = await fetch(
      `${baseUrl}/v1/users/${userId}/battles/recordings?page=${page}&pageSize=${pageSize}&sort=${sort}${
        includeEmptyForfeitedBattles ? '&includeEmptyForfeitedBattles=true' : ''
      }`,
      {
        signal,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (!response.ok) {
      throw new Error(
        `Error getting battles user with id ${userId} participated in: ${
          response.status
        } ${await response.text()}`,
      );
    }
    return response.json();
  },
  async getAllBattles(
    getToken: () => Promise<string | null>,
    signal?: AbortSignal,
  ): Promise<Paginated<BattleWithParticipants>> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const allBattlesResponse = await fetch(`${baseUrl}/v1/battles`, {
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!allBattlesResponse.ok) {
      throw new Error(
        `Error fetching all battles: ${
          allBattlesResponse.status
        } ${await allBattlesResponse.text()}`,
      );
    }
    return allBattlesResponse.json();
  },
  async getHomeFeedPage(
    getToken: () => Promise<string | null>,
    previousLastBattleId: Battle['id'] | null = null,
    feed: 'FOLLOWING' | 'TRENDING' = 'FOLLOWING',
    signal?: AbortSignal,
  ): Promise<{
    next: string;
    nextLastBattleId: BattleWithParticipants['id'];
    results: Array<BattleRecording>;
  }> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const battlesHomeResponse = await fetch(
      `${baseUrl}/v1/battles/home?feed=${feed}&lastBattleId=${previousLastBattleId || ''}`,
      {
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (!battlesHomeResponse.ok) {
      throw new Error(
        `Error fetching battles on home page: ${
          battlesHomeResponse.status
        } ${await battlesHomeResponse.text()}`,
      );
    }
    return battlesHomeResponse.json();
  },
  async getBattleById(
    getToken: () => Promise<string | null>,
    battleId: Battle['id'],
    signal?: AbortSignal,
  ): Promise<BattleWithParticipantsAndCheckinsAndEvents> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const battleResponse = await fetch(`${baseUrl}/v1/battles/${battleId}`, {
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!battleResponse.ok) {
      throw new Error(
        `Error fetching battle with id ${battleId}: ${
          battleResponse.status
        } ${await battleResponse.text()}`,
      );
    }
    return battleResponse.json();
  },
  async markBattleViewComplete(
    getToken: () => Promise<string | null>,
    battleId: Battle['id'],
    timeSpentWatchingBattleInMilliseconds: number | null,
  ) {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const battleResponse = await fetch(`${baseUrl}/v1/battles/${battleId}/view`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeSpentWatchingBattleInMilliseconds,
      }),
    });
    if (!battleResponse.ok) {
      throw new Error(
        `Error marking battle ${battleId} as viewed: ${
          battleResponse.status
        } ${await battleResponse.text()}`,
      );
    }
  },
  async voteForBattleParticipantInBattle(
    getToken: () => Promise<string | null>,
    battleId: Battle['id'],
    participantId: BattleParticipant['id'],
    videoStreamOffsetMilliseconds: number,
    startedCastingAtVideoStreamOffsetMilliseconds: number,
    endedCastingAtVideoStreamOffsetMilliseconds: number,
    amount: number = 1,
    clientGeneratedUuid: string = '',
  ) {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const battleVoteResponse = await fetch(`${baseUrl}/v1/battles/${battleId}/vote`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        participantId,
        videoStreamOffsetMilliseconds,
        amount,
        clientGeneratedUuid,
        startedCastingAtVideoStreamOffsetMilliseconds,
        endedCastingAtVideoStreamOffsetMilliseconds,
      }),
    });
    if (!battleVoteResponse.ok) {
      throw new Error(
        `Error voting for battle ${battleId}: ${
          battleVoteResponse.status
        } ${await battleVoteResponse.text()}`,
      );
    }
  },
  async getCommentsForBattle(
    getToken: () => Promise<string | null>,
    battleId: Battle['id'],
    page: number = 1,
    signal?: AbortSignal,
  ): Promise<Paginated<BattleComment>> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const battleCommentsResponse = await fetch(
      `${baseUrl}/v1/battles/${battleId}/comments?page=${page}`,
      {
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (!battleCommentsResponse.ok) {
      throw new Error(
        `Error fetching battle comments: ${
          battleCommentsResponse.status
        } ${await battleCommentsResponse.text()}`,
      );
    }
    return battleCommentsResponse.json();
  },
  async createCommentForBattle(
    getToken: () => Promise<string | null>,
    battleId: Battle['id'],
    text: BattleComment['text'],
    commentedAtOffsetMilliseconds: number,
  ): Promise<BattleComment> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const battleCommentsResponse = await fetch(`${baseUrl}/v1/battles/${battleId}/comments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        commentedAtOffsetMilliseconds,
      }),
    });
    if (!battleCommentsResponse.ok) {
      throw new Error(
        `Error creating battle comment: ${
          battleCommentsResponse.status
        } ${await battleCommentsResponse.text()}`,
      );
    }
    return battleCommentsResponse.json();
  },
  async deleteCommentForBattle(
    getToken: () => Promise<string | null>,
    commentId: BattleComment['id'],
    battleId: Battle['id'],
  ): Promise<void> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const battleCommentDeleteResponse = await fetch(
      `${baseUrl}/v1/battles/${battleId}/comments/${commentId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );
    if (!battleCommentDeleteResponse.ok) {
      throw new Error(
        `Error deleting battle comment: ${
          battleCommentDeleteResponse.status
        } ${await battleCommentDeleteResponse.text()}`,
      );
    }
  },
  async voteForCommentForBattle(
    getToken: () => Promise<string | null>,
    commentId: BattleComment['id'],
    battleId: Battle['id'],
  ): Promise<BattleComment> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const battleCommentsResponse = await fetch(
      `${baseUrl}/v1/battles/${battleId}/comments/${commentId}/vote`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (!battleCommentsResponse.ok) {
      throw new Error(
        `Error voting on battle comment: ${
          battleCommentsResponse.status
        } ${await battleCommentsResponse.text()}`,
      );
    }
    return battleCommentsResponse.json();
  },
  async unvoteCommentForBattle(
    getToken: () => Promise<string | null>,
    commentId: BattleComment['id'],
    battleId: Battle['id'],
  ): Promise<BattleComment> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const battleCommentsResponse = await fetch(
      `${baseUrl}/v1/battles/${battleId}/comments/${commentId}/unvote`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (!battleCommentsResponse.ok) {
      throw new Error(
        `Error unvoting battle comment: ${
          battleCommentsResponse.status
        } ${await battleCommentsResponse.text()}`,
      );
    }
    return battleCommentsResponse.json();
  },
  async getStateMachineDefinitionForBattle(
    getToken: () => Promise<string | null>,
    battleId: Battle['id'],
    appVersion: string,
    appBuild: string,
    signal?: AbortSignal,
  ): Promise<StateMachineDefinition> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const stateMachineDefinitionResponse = await fetch(
      `${baseUrl}/v1/battles/${battleId}/state-machine-definition?version=${appVersion}&build=${appBuild}`,
      {
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (!stateMachineDefinitionResponse.ok) {
      throw new Error(
        `Error fetching state machine definition for battle ${battleId}: ${
          stateMachineDefinitionResponse.status
        } ${await stateMachineDefinitionResponse.text()}`,
      );
    }
    return stateMachineDefinitionResponse.json();
  },
  async getBeatForBattle(
    getToken: () => Promise<string | null>,
    battleId: Battle['id'],
    signal?: AbortSignal,
  ): Promise<{ id: string; beatUrl: string }> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const beatResponse = await fetch(`${baseUrl}/v1/battles/${battleId}/beat`, {
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!beatResponse.ok) {
      throw new Error(
        `Error fetching beat for battle ${battleId}: ${
          beatResponse.status
        } ${await beatResponse.text()}`,
      );
    }
    return beatResponse.json();
  },
  async getProjectedOutcomeForBattle(
    getToken: () => Promise<string | null>,
    battleId: Battle['id'],
    signal?: AbortSignal,
  ): Promise<{
    startingScore: User['computedScore'];
    projectedScores: {
      win: User['computedScore'];
      loss: User['computedScore'];
      tie: User['computedScore'];
    };
  }> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const response = await fetch(`${baseUrl}/v1/battles/${battleId}/projected-outcome`, {
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(
        `Error fetching projected outcome for battle ${battleId}: ${
          response.status
        } ${await response.text()}`,
      );
    }
    return response.json();
  },

  async createParticipant(
    getToken: () => Promise<string | null>,
    matchingAlgorithm: 'RANDOM' | 'DEFAULT',
  ): Promise<BattleParticipant> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const participantResponse = await fetch(`${baseUrl}/v1/participants`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ matchingAlgorithm }),
    });
    if (!participantResponse.ok) {
      throw new Error(
        `Error creating participant: ${
          participantResponse.status
        } ${await participantResponse.text()}`,
      );
    }
    return participantResponse.json();
  },
  async getParticipantById(
    getToken: () => Promise<string | null>,
    battleParticipantId: BattleParticipant['id'],
    signal?: AbortSignal,
  ): Promise<BattleParticipant> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const battleParticipantResponse = await fetch(
      `${baseUrl}/v1/participants/${battleParticipantId}`,
      {
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (!battleParticipantResponse.ok) {
      throw new Error(
        `Error fetching battle participant with id ${battleParticipantId}: ${
          battleParticipantResponse.status
        } ${await battleParticipantResponse.text()}`,
      );
    }
    return battleParticipantResponse.json();
  },
  async getTwilioTokenForParticipant(
    getToken: () => Promise<string | null>,
    participantId: BattleParticipant['id'],
    signal?: AbortSignal,
  ): Promise<string> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const participantTokenResponse = await fetch(
      `${baseUrl}/v1/participants/${participantId}/twilio-token`,
      {
        signal,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (!participantTokenResponse.ok) {
      throw new Error(
        `Error creating participant: ${
          participantTokenResponse.status
        } ${await participantTokenResponse.text()}`,
      );
    }
    const json = await participantTokenResponse.json();
    return json.token;
  },
  async markParticipantReadyForBattle(
    getToken: () => Promise<string | null>,
    participantId: BattleParticipant['id'],
  ) {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const response = await fetch(`${baseUrl}/v1/participants/${participantId}/ready`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(
        `Error marking participant ${participantId} ready: ${
          response.status
        } ${await response.text()}`,
      );
    }
  },
  async requestBattlePrivacyLevel(
    getToken: () => Promise<string | null>,
    participantId: BattleParticipant['id'],
    privacyLevel: Battle['computedPrivacyLevel'],
  ) {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const response = await fetch(`${baseUrl}/v1/participants/${participantId}/privacy`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requestedBattlePrivacyLevel: privacyLevel }),
    });
    if (!response.ok) {
      throw new Error(
        `Error requesting participant ${participantId} privacy level ${privacyLevel}: ${
          response.status
        } ${await response.text()}`,
      );
    }
  },
  async storeTwilioTrackIds(
    getToken: () => Promise<string | null>,
    participantId: BattleParticipant['id'],
    twilioVideoTrackId: BattleParticipant['twilioVideoTrackId'],
    twilioAudioTrackId: BattleParticipant['twilioAudioTrackId'],
    twilioDataTrackId: BattleParticipant['twilioDataTrackId'],
  ) {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const response = await fetch(`${baseUrl}/v1/participants/${participantId}/twilio-track-ids`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        twilioAudioTrackId,
        twilioVideoTrackId,
        twilioDataTrackId,
      }),
    });
    if (!response.ok) {
      throw new Error(
        `Error storing track ids for participant ${participantId}: ${
          response.status
        } ${await response.text()}`,
      );
    }
  },
  async checkinParticipant(
    getToken: () => Promise<string | null>,
    participantId: BattleParticipant['id'],
    videoStreamOffsetMilliseconds: number | null,
    currentState?: BattleParticipant['currentState'],
    currentContext?: BattleParticipant['currentContext'],
  ) {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const response = await fetch(`${baseUrl}/v1/participants/${participantId}/checkin`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ currentState, currentContext, videoStreamOffsetMilliseconds }),
    });
    if (!response.ok) {
      throw new Error(
        `Error checking in participant ${participantId}: ${
          response.status
        } ${await response.text()}`,
      );
    }
  },
  async updateAppState(
    getToken: () => Promise<string | null>,
    participantId: BattleParticipant['id'],
    appState: BattleParticipant['appState'],
  ) {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const response = await fetch(`${baseUrl}/v1/participants/${participantId}/app-state`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ appState }),
    });
    if (!response.ok) {
      throw new Error(
        `Error updating app state for participant ${participantId}: ${
          response.status
        } ${await response.text()}`,
      );
    }
  },
  async publishStateMachineEvent(
    getToken: () => Promise<string | null>,
    participantId: BattleParticipant['id'],
    clientGeneratedUuid: string,
    payload: BattleStateMachineEvent,
  ): Promise<BattleParticipantStateMachineEvent> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const response = await fetch(
      `${baseUrl}/v1/participants/${participantId}/state-machine-events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uuid: clientGeneratedUuid,
          payload,
        }),
      },
    );
    if (!response.ok) {
      throw new Error(
        `Error sending state machine event from ${participantId}: ${
          response.status
        } ${await response.text()}`,
      );
    }
    return response.json();
  },
  async leaveBattle(
    getToken: () => Promise<string | null>,
    participantId: BattleParticipant['id'],
    reason?: string,
  ) {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const response = await fetch(
      `${baseUrl}/v1/participants/${participantId}/leave${reason ? `?reason=${reason}` : ''}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (!response.ok) {
      throw new Error(
        `Error leaving battle as participant ${participantId}: ${
          response.status
        } ${await response.text()}`,
      );
    }
  },
  async getBattleRecording(
    getToken: () => Promise<string | null>,
    battleId: Battle['id'],
    signal?: AbortSignal,
  ): Promise<BattleRecording> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const response = await fetch(`${baseUrl}/v1/battles/${battleId}/recording`, {
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(
        `Error getting recording for battle ${battleId}: ${
          response.status
        } ${await response.text()}`,
      );
    }
    return response.json();
  },
  async pusherAuth(
    getToken: () => Promise<string | null>,
    channelName: string,
    socketId: string,
  ): Promise<PusherAuthorizerResult> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const response = await fetch(`${baseUrl}/v1/pusher/auth`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channelName, socketId }),
    });
    if (!response.ok) {
      throw new Error(
        `Error getting pusher user auth data: ${response.status} ${await response.text()}`,
      );
    }
    return response.json();
  },
  async searchSpotifyTracks(
    getToken: () => Promise<string | null>,
    searchQuery: string,
    page: number = 1,
    signal?: AbortSignal,
  ): Promise<Paginated<FixMe>> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const response = await fetch(
      `${baseUrl}/v1/spotify/tracks/search?q=${searchQuery}&page=${page}`,
      {
        signal,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );
    if (!response.ok) {
      throw new Error(
        `Error searching spotify tracks: ${response.status} ${await response.text()}`,
      );
    }
    return response.json();
  },
  async searchSpotifyArtists(
    getToken: () => Promise<string | null>,
    searchQuery: string,
    page: number = 1,
    signal?: AbortSignal,
  ): Promise<Paginated<FixMe>> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const response = await fetch(
      `${baseUrl}/v1/spotify/artists/search?q=${searchQuery}&page=${page}`,
      {
        signal,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );
    if (!response.ok) {
      throw new Error(
        `Error searching spotify artists: ${response.status} ${await response.text()}`,
      );
    }
    return response.json();
  },
  async geocodeAddress(
    getToken: () => Promise<string | null>,
    searchQuery: string,
    signal?: AbortSignal,
  ): Promise<Array<FixMe>> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const response = await fetch(`${baseUrl}/v1/geocoding/search?q=${searchQuery}`, {
      signal,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Error geocoding address: ${response.status} ${await response.text()}`);
    }
    return response.json();
  },

  async isChallengingAnotherUser(
    getToken: () => Promise<string | null>,
    signal?: AbortSignal,
  ): Promise<boolean> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const response = await fetch(`${baseUrl}/v1/users/me/is-challenging`, {
      signal,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(
        `Error getting if user me is challenging another user: ${
          response.status
        } ${await response.text()}`,
      );
    }
    return (await response.json()).status;
  },
  async getPendingChallenges(
    getToken: () => Promise<string | null>,
    page: number = 1,
    signal?: AbortSignal,
  ): Promise<Paginated<Challenge>> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const response = await fetch(`${baseUrl}/v1/challenges/pending?page=${page}`, {
      signal,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(
        `Error getting pending challenges: ${response.status} ${await response.text()}`,
      );
    }
    return response.json();
  },
  async createChallenge(
    getToken: () => Promise<string | null>,
    userToChallengeId: Challenge['id'],
  ): Promise<Challenge> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const response = await fetch(`${baseUrl}/v1/challenges`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userToChallengeId }),
    });
    if (!response.ok) {
      throw new Error(`Error creating challenge: ${response.status} ${await response.text()}`);
    }
    return response.json();
  },
  async leaveChallenge(
    getToken: () => Promise<string | null>,
    challengeId: Challenge['id'],
  ): Promise<void> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const response = await fetch(`${baseUrl}/v1/challenges/${challengeId}/leave`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(
        `Error leaving challenge ${challengeId}: ${response.status} ${await response.text()}`,
      );
    }
  },
  async cancelChallenge(
    getToken: () => Promise<string | null>,
    challengeId: Challenge['id'],
  ): Promise<Challenge> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const response = await fetch(`${baseUrl}/v1/challenges/${challengeId}/cancel`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(
        `Error cancelling challenge ${challengeId}: ${response.status} ${await response.text()}`,
      );
    }
    return response.json();
  },
  async checkinChallenge(
    getToken: () => Promise<string | null>,
    challengeId: Challenge['id'],
  ): Promise<void> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const response = await fetch(`${baseUrl}/v1/challenges/${challengeId}/checkin`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(
        `Error checking in to challenge ${challengeId}: ${
          response.status
        } ${await response.text()}`,
      );
    }
  },

  async getDebugTwilioToken(
    getToken: () => Promise<string | null>,
    room: string,
    identity: string,
  ): Promise<string> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const token = await getToken();
    const response = await fetch(`${baseUrl}/twilio-token/${room}/${identity}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Error getting twilio token: ${response.status} ${await response.text()}`);
    }
    const json = await response.json();
    return json.token;
  },
  async getDemoClerkTicket(): Promise<FixMe> {
    const baseUrl = generateBarzAPIBaseUrl(await EnvironmentCache.getActiveEnvironment());
    const response = await fetch(`${baseUrl}/demo-clerk-ticket`, { method: 'POST' });
    if (!response.ok) {
      throw new Error(
        `Error getting demo clerk ticket: ${response.status} ${await response.text()}`,
      );
    }
    return response.json();
  },
};
