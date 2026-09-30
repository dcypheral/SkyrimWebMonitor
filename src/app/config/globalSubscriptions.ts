import type { GlobalSubscriptionConfig } from './types';

export const GLOBAL_SUBSCRIPTIONS: Record<string, GlobalSubscriptionConfig> = {
  gameStatus: {
    subscriptionId: 'game.status',
    fields: {
      status: 'Game::Status',
    },
    settings: {
        frequency: 100,
        sendOnChange: true,
    }
  },
};

/**
 * Hero's journey recording. Started with the gameplay subscriptions (once the
 * player is in-game) and kept running on every page. Low rates on purpose:
 * one position per second is enough for a path, and quests/level only need
 * to be seen when they change.
 */
export const JOURNEY_SUBSCRIPTIONS: Record<string, GlobalSubscriptionConfig> = {
  position: {
    subscriptionId: 'journey.position',
    fields: { position: 'Player::Position' },
    settings: { frequency: 1000 },
  },
  progress: {
    subscriptionId: 'journey.progress',
    fields: { quests: 'Player::Quests', level: 'Player::Level' },
    settings: { frequency: 5000, sendOnChange: true },
  },
};
