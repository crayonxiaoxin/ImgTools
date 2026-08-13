<script setup lang="ts">
import { computed, defineComponent, h, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { useImageStore, type ImageItem } from '@/stores/imageStore'
import { useImageProcessor } from '@/composables/useImageProcessor'
import { useBatchExport } from '@/composables/useBatchExport'
import { useToast } from '@/composables/useToast'
import { formatSize } from '@/utils/format'
import type { MetaField } from '@/core/strip'

const { t } = useI18n()
const store = useImageStore()

const statusKey: Record<string, string> = {
  pending: 'batch.statusPending',
  processing: 'batch.statusProcessing',
  done: 'batch.statusDone',
  error: 'batch.statusError',
}
const { processAll: runProcessAll } = useImageProcessor()
const { downloadSingle, downloadAllAsZip, downloadAllIndividual } = useBatchExport()
const toast = useToast()

const expandedMeta = ref<Record<string, boolean>>({})
const revealedGps = ref<Record<string, boolean>>({})

function toggleMeta(id: string) {
  expandedMeta.value[id] = !expandedMeta.value[id]
}

function toggleGps(id: string) {
  revealedGps.value[id] = !revealedGps.value[id]
}

function clearedCount(item: ImageItem): number {
  return Math.max(0, (item.metaBefore?.length ?? 0) - (item.metaAfter?.length ?? 0))
}

function afterKeySet(item: ImageItem): Set<string> | null {
  if (!item.metaAfter) return null
  return new Set(item.metaAfter.map(f => f.key))
}

const MetaList = defineComponent({
  name: 'MetaList',
  props: {
    fields: { type: Array as PropType<MetaField[] | undefined>, default: undefined },
    side: { type: String as PropType<'before' | 'after'>, required: true },
    afterKeys: { type: Object as PropType<Set<string> | null>, default: null },
    revealed: { type: Boolean, default: false },
  },
  emits: ['toggle-gps'],
  setup(props, { emit }) {
    const { t: ti } = useI18n()
    return () => {
      if (props.fields === undefined) {
        return h('p', { class: 'meta-empty' }, ti('strip.unread'))
      }
      if (props.fields.length === 0) {
        return h('p', { class: 'meta-empty' }, ti('strip.none'))
      }
      return h(
        'ul',
        { class: 'meta-fields' },
        props.fields.map((field) => {
          const muted = props.side === 'before' && !!props.afterKeys && !props.afterKeys.has(field.key)
          let valueNode
          if (field.sensitive) {
            valueNode = h('span', { class: 'meta-value-wrap' }, [
              h(
                'span',
                {
                  class: 'meta-value',
                  title: props.revealed ? field.value : undefined,
                },
                props.revealed ? (field.value || '—') : ti('strip.gpsYes'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  class: 'link-btn gps-toggle',
                  onClick: () => emit('toggle-gps'),
                },
                props.revealed ? ti('strip.hideGps') : ti('strip.showGps'),
              ),
            ])
          } else {
            valueNode = h('span', { class: 'meta-value-wrap' }, [
              h(
                'span',
                {
                  class: 'meta-value',
                  title: field.value || undefined,
                },
                field.value || '—',
              ),
            ])
          }
          return h('li', { key: field.key, class: ['meta-field', { muted }] }, [
            h('span', { class: 'meta-label' }, ti(field.labelKey)),
            valueNode,
          ])
        }),
      )
    }
  },
})

const finishedCount = computed(() =>
  store.images.filter(i => i.status === 'done' || i.status === 'error').length
)
const doneCount = computed(() => store.images.filter(i => i.status === 'done').length)
const totalCount = computed(() => store.images.length)
const progressPercent = computed(() =>
  totalCount.value === 0 ? 0 : Math.round((finishedCount.value / totalCount.value) * 100)
)
const showProgress = computed(() =>
  store.processing || finishedCount.value > 0
)

function hasResults(): boolean {
  return store.images.some(i => i.status === 'done')
}

async function processAll() {
  const summary = await runProcessAll()
  if (summary.total === 0) return
  if (summary.failed > 0) {
    toast.error(t('batch.doneWithErrors', {
      done: summary.done,
      failed: summary.failed,
      total: summary.total,
    }))
  } else {
    toast.success(t('batch.doneAll', { n: summary.done }))
  }
}

function formatLine(item: ImageItem): string {
  const from = item.format?.toUpperCase() ?? '-'
  if (item.status === 'done' && item.config.targetFormat !== item.format) {
    return `${from} → ${item.config.targetFormat.toUpperCase()}`
  }
  return from
}

function resultText(item: ImageItem): string | null {
  if (!item.resultSize) return null
  // Strip mode: show absolute size (neutral); never "uncompressed"
  if (store.activeMode === 'strip') {
    return `→ ${formatSize(item.resultSize)}`
  }
  if (item.resultSize < item.size) {
    const pct = ((1 - item.resultSize / item.size) * 100).toFixed(0)
    return `→ ${formatSize(item.resultSize)} (-${pct}%)`
  }
  return null
}
</script>

<template>
  <div class="batch-list" :class="{ 'is-empty': store.images.length === 0 }">
    <template v-if="store.images.length === 0">
      <p class="empty-hint">{{ t('batch.empty') }}</p>
    </template>

    <template v-else>
      <div class="batch-header">
        <div class="batch-heading">
          <h3>{{ t('batch.title', { n: store.images.length }) }}</h3>
          <span v-if="showProgress" class="progress-label">
            {{ t('batch.progress', { done: doneCount, total: totalCount }) }}
          </span>
        </div>
        <div class="batch-actions">
          <button
            class="btn btn-primary"
            :disabled="store.processing"
            @click="processAll"
          >
            {{ store.processing ? t('batch.processing') : t('batch.start') }}
          </button>
          <button
            class="btn"
            :disabled="!hasResults()"
            @click="downloadAllAsZip"
          >{{ t('batch.exportZip') }}</button>
          <button
            class="btn"
            :disabled="!hasResults()"
            @click="downloadAllIndividual"
          >{{ t('batch.downloadAll') }}</button>
          <button
            class="btn btn-danger"
            @click="store.clearAll()"
          >{{ t('batch.clear') }}</button>
        </div>
      </div>

      <div v-if="showProgress" class="progress-track" :class="{ active: store.processing }">
        <div
          class="progress-fill"
          :style="{ width: progressPercent + '%' }"
        />
      </div>

      <!-- Desktop table -->
      <div class="batch-table-wrap">
        <table class="batch-table">
          <thead>
            <tr>
              <th></th>
              <th>{{ t('batch.colFilename') }}</th>
              <th>{{ t('batch.colOriginalSize') }}</th>
              <th>{{ t('batch.colFormat') }}</th>
              <th>{{ t('batch.colResult') }}</th>
              <th>{{ t('batch.colStatus') }}</th>
              <th>{{ t('batch.colAction') }}</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="item in store.images" :key="item.id">
              <tr>
                <td class="thumb-cell">
                  <img v-if="item.previewUrl" :src="item.previewUrl" :alt="item.name" class="thumb" />
                </td>
                <td :title="item.name">{{ item.name }}</td>
                <td>{{ formatSize(item.size) }}</td>
                <td>{{ formatLine(item) }}</td>
                <td>
                  <template v-if="item.resultSize">
                    <span v-if="resultText(item)" class="rate">{{ resultText(item) }}</span>
                    <span v-else class="rate-negative">{{ t('batch.uncompressed') }}</span>
                  </template>
                  <span v-else>-</span>
                </td>
                <td>
                  <span
                    class="status-tag"
                    :class="item.status"
                    :title="item.status === 'error' ? item.errorMessage : undefined"
                  >
                    {{ t(statusKey[item.status]) }}
                  </span>
                </td>
                <td>
                  <div class="action-cell">
                    <button
                      v-if="store.activeMode === 'strip'"
                      type="button"
                      class="link-btn"
                      @click="toggleMeta(item.id)"
                    >
                      {{ t('strip.meta') }}
                    </button>
                    <button
                      v-if="item.status === 'done'"
                      class="btn btn-sm"
                      @click="downloadSingle(item.id)"
                    >{{ t('batch.download') }}</button>
                  </div>
                </td>
              </tr>
              <tr
                v-if="store.activeMode === 'strip' && expandedMeta[item.id]"
                class="meta-row"
              >
                <td colspan="7">
                  <div class="meta-compare">
                    <div class="meta-col">
                      <h4>{{ t('strip.before') }}</h4>
                      <MetaList
                        :fields="item.metaBefore"
                        side="before"
                        :after-keys="afterKeySet(item)"
                        :revealed="!!revealedGps[item.id]"
                        @toggle-gps="toggleGps(item.id)"
                      />
                    </div>
                    <div class="meta-col">
                      <h4>
                        {{ t('strip.after') }}
                        <span
                          v-if="item.metaAfter && item.metaBefore && clearedCount(item) > 0"
                          class="badge"
                        >
                          {{ t('strip.cleared', { n: clearedCount(item) }) }}
                        </span>
                      </h4>
                      <template v-if="item.status === 'done'">
                        <MetaList
                          :fields="item.metaAfter"
                          side="after"
                          :revealed="!!revealedGps[item.id]"
                          @toggle-gps="toggleGps(item.id)"
                        />
                      </template>
                      <p v-else class="hint">—</p>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Mobile cards -->
      <div class="batch-cards">
        <div
          v-for="item in store.images"
          :key="item.id"
          class="batch-card"
          :class="item.status"
        >
          <div class="card-main">
            <img v-if="item.previewUrl" :src="item.previewUrl" :alt="item.name" class="card-thumb" />
            <div class="card-body">
              <div class="card-top">
                <span class="card-name" :title="item.name">{{ item.name }}</span>
                <span
                  class="status-tag"
                  :class="item.status"
                  :title="item.status === 'error' ? item.errorMessage : undefined"
                >
                  {{ t(statusKey[item.status]) }}
                </span>
              </div>
              <div class="card-meta">
                <span>{{ formatSize(item.size) }}</span>
                <span class="dot">·</span>
                <span>{{ formatLine(item) }}</span>
                <template v-if="item.resultSize">
                  <span class="dot">·</span>
                  <span v-if="resultText(item)" class="rate">{{ resultText(item) }}</span>
                  <span v-else class="rate-negative">{{ t('batch.uncompressed') }}</span>
                </template>
              </div>
              <div class="card-actions">
                <button
                  v-if="store.activeMode === 'strip'"
                  type="button"
                  class="link-btn"
                  @click="toggleMeta(item.id)"
                >
                  {{ t('strip.meta') }}
                </button>
                <button
                  v-if="item.status === 'done'"
                  class="btn btn-sm card-dl"
                  @click="downloadSingle(item.id)"
                >{{ t('batch.download') }}</button>
              </div>
            </div>
          </div>
          <div
            v-if="store.activeMode === 'strip' && expandedMeta[item.id]"
            class="meta-compare"
          >
            <div class="meta-col">
              <h4>{{ t('strip.before') }}</h4>
              <MetaList
                :fields="item.metaBefore"
                side="before"
                :after-keys="afterKeySet(item)"
                :revealed="!!revealedGps[item.id]"
                @toggle-gps="toggleGps(item.id)"
              />
            </div>
            <div class="meta-col">
              <h4>
                {{ t('strip.after') }}
                <span
                  v-if="item.metaAfter && item.metaBefore && clearedCount(item) > 0"
                  class="badge"
                >
                  {{ t('strip.cleared', { n: clearedCount(item) }) }}
                </span>
              </h4>
              <template v-if="item.status === 'done'">
                <MetaList
                  :fields="item.metaAfter"
                  side="after"
                  :revealed="!!revealedGps[item.id]"
                  @toggle-gps="toggleGps(item.id)"
                />
              </template>
              <p v-else class="hint">—</p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.batch-list {
  margin-top: var(--space-4);
  padding: var(--space-4);
  background: var(--bg-surface);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-soft);
}
.batch-list.is-empty {
  padding: var(--space-3) var(--space-4);
  box-shadow: none;
  background: transparent;
  border-style: dashed;
}
.empty-hint {
  margin: 0;
  text-align: center;
  font-size: var(--font-caption);
  color: var(--text-muted);
  padding: var(--space-1) 0;
}
.batch-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}
.batch-heading {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.batch-header h3 {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text);
}
.progress-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.batch-actions {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}
.progress-track {
  height: 4px;
  border-radius: 999px;
  background: var(--bg-dim);
  margin-bottom: var(--space-3);
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--primary);
  transition: width 0.25s ease;
}
.progress-track.active .progress-fill {
  background: linear-gradient(90deg, var(--primary), var(--primary-hover));
}
.btn {
  padding: 0 14px;
  height: var(--control-h);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  color: var(--text-secondary);
  transition: border-color var(--ease), background var(--ease), color var(--ease);
}
.btn:hover:not(:disabled) {
  border-color: var(--border-strong);
  background: var(--bg-hover);
  color: var(--text);
}
.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  background: var(--bg-dim);
  color: var(--text-muted);
  border-color: var(--border);
}
.btn-primary {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
  font-weight: 600;
  padding: 0 18px;
  letter-spacing: -0.01em;
}
.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
  color: #fff;
}
.btn-primary:disabled {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
  opacity: 0.7;
}
.btn-primary:disabled::before {
  content: '';
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255,255,255,0.6);
  border-top-color: #fff;
  border-radius: 50%;
  animation: btn-spin 0.6s linear infinite;
}
@keyframes btn-spin {
  to { transform: rotate(360deg); }
}
.btn-danger {
  color: var(--danger);
  border-color: var(--danger);
}
.btn-danger:hover:not(:disabled) {
  background: var(--danger-bg);
}
.btn-sm {
  height: 28px;
  padding: 0 var(--space-2);
  font-size: var(--font-caption);
}
.batch-table-wrap {
  overflow-x: auto;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}
.batch-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.batch-table th {
  background: var(--bg-hover);
  padding: var(--space-2) var(--space-3);
  text-align: left;
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
}
.batch-table td {
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--border);
  vertical-align: middle;
}
.batch-table tbody tr:hover {
  background: var(--bg-faint);
}
.thumb-cell {
  width: 64px;
  padding: var(--space-1) !important;
}
.thumb {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  display: block;
}
.status-tag {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: var(--font-caption);
  white-space: nowrap;
}
.status-tag.pending { background: var(--tag-pending-bg); color: var(--text-muted); }
.status-tag.processing {
  background: var(--tag-processing-bg);
  color: var(--primary);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.status-tag.processing::before {
  content: '';
  width: 10px;
  height: 10px;
  border: 2px solid var(--primary);
  border-top-color: transparent;
  border-radius: 50%;
  animation: proc-spin 0.6s linear infinite;
}
@keyframes proc-spin {
  to { transform: rotate(360deg); }
}
.status-tag.done { background: var(--tag-done-bg); color: var(--success); }
.status-tag.error { background: var(--tag-error-bg); color: var(--danger); }
.rate {
  color: var(--success);
  font-weight: 500;
}
.rate-negative {
  color: var(--warning);
  font-weight: 500;
}

.action-cell {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.link-btn,
:deep(.link-btn) {
  border: none;
  background: none;
  padding: 0;
  margin: 0;
  font: inherit;
  font-size: var(--font-caption);
  font-weight: 500;
  color: var(--primary);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.link-btn:hover,
:deep(.link-btn:hover) {
  color: var(--primary-hover);
}
.meta-row td {
  padding: 0 var(--space-3) var(--space-2) !important;
  background: var(--bg-faint);
  vertical-align: top;
}
.meta-compare {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  padding: var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
}
.meta-col h4 {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
  margin: 0 0 var(--space-1);
  font-size: var(--font-caption);
  font-weight: 600;
  color: var(--text-secondary);
}
.badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 500;
  color: var(--success);
  background: var(--tag-done-bg);
}
.meta-compare .hint {
  margin: 0;
  font-size: var(--font-caption);
  color: var(--text-muted);
}
:deep(.meta-empty) {
  margin: 0;
  font-size: var(--font-caption);
  color: var(--text-muted);
}
:deep(.meta-fields) {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
:deep(.meta-field) {
  display: grid;
  grid-template-columns: minmax(72px, 30%) 1fr;
  gap: var(--space-1);
  align-items: baseline;
  font-size: var(--font-caption);
  line-height: 1.4;
}
:deep(.meta-field.muted) {
  opacity: 0.45;
}
:deep(.meta-label) {
  color: var(--text-muted);
  font-weight: 500;
}
:deep(.meta-value-wrap) {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px var(--space-1);
}
:deep(.meta-value) {
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  max-width: 100%;
}
:deep(.gps-toggle) {
  flex-shrink: 0;
}

@media (max-width: 900px) {
  .meta-compare {
    grid-template-columns: 1fr;
  }
}

/* Mobile cards — hidden on desktop */
.batch-cards {
  display: none;
}

@media (max-width: 768px) {
  .batch-list {
    padding: var(--space-3);
  }
  .batch-list.is-empty {
    padding: var(--space-2) var(--space-3);
  }
  .batch-header {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }
  .batch-actions {
    flex-wrap: wrap;
  }
  .btn-primary {
    flex: 1;
    min-width: 120px;
  }
  .batch-table-wrap {
    display: none;
  }
  .batch-cards {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .batch-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-faint);
  }
  .card-main {
    display: flex;
    gap: var(--space-2);
  }
  .batch-card.processing {
    border-color: var(--primary);
    background: var(--primary-bg);
  }
  .card-thumb {
    width: 56px;
    height: 56px;
    object-fit: cover;
    border-radius: var(--radius-sm);
    flex-shrink: 0;
  }
  .card-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .card-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-1);
  }
  .card-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .card-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px;
    font-size: var(--font-caption);
    color: var(--text-muted);
  }
  .dot { opacity: 0.5; }
  .card-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-top: 2px;
  }
  .card-dl {
    align-self: flex-start;
  }
  .batch-card .meta-compare {
    margin-top: var(--space-1);
  }
}
</style>
