<template>
  <section
    v-if="available"
    class="panel"
  >
    <h3 class="modal-title text-base m-0">
      {{ t('app.settings.perf.title') }}
    </h3>
    <p class="text-sm text-secondary m-0">
      {{ t('app.settings.perf.hint') }}
    </p>
    <div class="d-flex gap-md">
      <button
        type="button"
        class="btn flex-1"
        :disabled="busy"
        @click="measure"
      >
        {{ t('app.settings.perf.measure') }}
      </button>
      <button
        type="button"
        class="btn flex-1"
        :disabled="busy"
        @click="reset"
      >
        {{ t('app.settings.perf.reset') }}
      </button>
    </div>
    <p
      v-if="since !== null"
      class="text-sm text-secondary m-0"
    >
      {{ t('app.settings.perf.since', { seconds: since }) }}
    </p>
    <table
      v-if="rows.length"
      class="perf"
    >
      <thead>
        <tr>
          <th>{{ t('app.settings.perf.colField') }}</th>
          <th>{{ t('app.settings.perf.colAvg') }}</th>
          <th>{{ t('app.settings.perf.colMax') }}</th>
          <th>{{ t('app.settings.perf.colSlow') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="r in rows"
          :key="r.key"
          :class="{ 'perf__row--slow': r.maxMs > 4 }"
        >
          <td class="perf__key">
            {{ r.key }}
          </td>
          <td>{{ r.avgMs.toFixed(2) }}</td>
          <td>{{ r.maxMs.toFixed(1) }}</td>
          <td>{{ r.slowCalls }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSystemStore } from '@/stores/system/useSystemStore';
import { FEATURES } from '@/stores/system/lib/types';
import { useWebSocketStore } from '@/stores/use-websocket-store/useWebsocketStore';

/**
 * Shows how long each data field takes on the game thread. Slow fields are
 * the likely cause of short hitches that FPS counters average away.
 */
interface Row {
  key: string;
  calls: number;
  avgMs: number;
  maxMs: number;
  slowCalls: number;
}

const MAX_ROWS = 10;

const { t } = useI18n();
const ws = useWebSocketStore();
const system = useSystemStore();
const available = computed(() => system.isFeatureProvided(FEATURES.DEBUG_TIMINGS));

const busy = ref(false);
const rows = ref<Row[]>([]);
const since = ref<number | null>(null);

function toRows(raw: unknown): Row[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const entries: unknown = Reflect.get(raw, 'entries');
  if (!Array.isArray(entries)) return [];
  const out: Row[] = [];
  for (const e of entries) {
    if (typeof e !== 'object' || e === null) continue;
    const key: unknown = Reflect.get(e, 'key');
    const num = (name: string): number => {
      const v: unknown = Reflect.get(e, name);
      return typeof v === 'number' ? v : 0;
    };
    if (typeof key !== 'string') continue;
    out.push({ key, calls: num('calls'), avgMs: num('avgMs'), maxMs: num('maxMs'), slowCalls: num('slowCalls') });
  }
  return out.slice(0, MAX_ROWS);
}

function measure(): void {
  busy.value = true;
  ws.sendQuery('debug.timings', { timings: 'Debug::FieldTimings' }, (fields) => {
    const raw = fields.timings;
    rows.value = toRows(raw);
    const s: unknown = typeof raw === 'object' && raw !== null ? Reflect.get(raw, 'sinceSeconds') : null;
    since.value = typeof s === 'number' ? s : null;
    busy.value = false;
  });
  // A missing answer must not leave the buttons disabled.
  setTimeout(() => (busy.value = false), 3000);
}

async function reset(): Promise<void> {
  busy.value = true;
  try {
    await ws.resetPerfStats();
    rows.value = [];
    since.value = 0;
  } catch {
    /* older plugin: nothing to reset */
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped lang="scss">
.perf {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;

  th,
  td {
    padding: 3px 4px;
    border-bottom: 1px solid var(--skyrim-border-dark);
    text-align: right;
  }

  th:first-child,
  td:first-child {
    text-align: left;
  }

  th {
    font-family: var(--font-heading);
    font-weight: normal;
    color: var(--skyrim-text-secondary);
  }
}

.perf__key {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.perf__row--slow td {
  color: #e8a060;
}
</style>
