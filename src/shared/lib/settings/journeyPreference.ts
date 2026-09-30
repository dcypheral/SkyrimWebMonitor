import { ref } from 'vue';

const RECORD_KEY = 'skyrim-monitor-journey-record';
const OBJECTIVES_KEY = 'skyrim-monitor-journey-objectives';

function read(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === 'true';
  } catch {
    return fallback;
  }
}

function write(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* localStorage can be unavailable in restricted WebViews */
  }
}

/** Record the hero's path and session log while connected. */
export const journeyRecordingEnabled = ref(read(RECORD_KEY, true));
/** Log completed objectives and quests in the session log. */
export const journeyObjectivesEnabled = ref(read(OBJECTIVES_KEY, true));

export function persistJourneyRecording(value: boolean): void {
  journeyRecordingEnabled.value = value;
  write(RECORD_KEY, value);
}

export function persistJourneyObjectives(value: boolean): void {
  journeyObjectivesEnabled.value = value;
  write(OBJECTIVES_KEY, value);
}
