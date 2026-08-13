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
          const cleared = props.side === 'before' && !!props.afterKeys && !props.afterKeys.has(field.key)
          const presenceOnly = !field.value && !field.sensitive
          let valueNode
          if (field.sensitive) {
            valueNode = h('div', { class: 'meta-value-wrap' }, [
              h(
                'span',
                {
                  class: ['meta-value', { 'is-secret': !props.revealed }],
                  title: props.revealed ? field.value : undefined,
                },
                props.revealed ? (field.value || '—') : ti('strip.gpsYes'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  class: 'meta-ghost-btn',
                  onClick: () => emit('toggle-gps'),
                },
                props.revealed ? ti('strip.hideGps') : ti('strip.showGps'),
              ),
            ])
          } else if (presenceOnly) {
            valueNode = h('span', { class: 'meta-chip' }, ti('strip.present'))
          } else {
            valueNode = h(
              'span',
              {
                class: 'meta-value',
                title: field.value || undefined,
              },
              field.value,
            )
          }
          return h('li', { key: field.key, class: ['meta-field', { cleared }] }, [
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
  if (item.resultSize < item.size) {
    const pct = ((1 - item.resultSize / item.size) * 100).toFixed(0)
    return `→ ${formatSize(item.resultSize)} (-${pct}%)`
  }
  return null
}

/** Primary strip-mode result: cleanup summary, not size. */
function stripResultLabel(item: ImageItem): string | null {
  if (item.status !== 'done' || !item.metaAfter) return null
  const n = clearedCount(item)
  return n > 0 ? t('strip.resultCleared', { n }) : t('strip.resultClean')
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
              <th>{{ store.activeMode === 'strip' ? t('strip.colResult') : t('batch.colResult') }}</th>
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
                  <div v-if="store.activeMode === 'strip'" class="strip-result">
                    <template v-if="stripResultLabel(item)">
                      <span
                        class="strip-result-main"
                        :class="clearedCount(item) > 0 ? 'is-cleared' : 'is-clean'"
                      >{{ stripResultLabel(item) }}</span>
                      <span v-if="item.resultSize" class="strip-result-size">{{ formatSize(item.resultSize) }}</span>
                    </template>
                    <span v-else class="strip-result-placeholder">-</span>
                  </div>
                  <template v-else-if="item.resultSize">
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
                      class="meta-toggle"
                      :class="{ open: expandedMeta[item.id] }"
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
                    <section class="meta-col">
                      <header class="meta-col-head">
                        <span class="meta-col-title">{{ t('strip.before') }}</span>
                      </header>
                      <MetaList
                        :fields="item.metaBefore"
                        side="before"
                        :after-keys="afterKeySet(item)"
                        :revealed="!!revealedGps[item.id]"
                        @toggle-gps="toggleGps(item.id)"
                      />
                    </section>
                    <section class="meta-col">
                      <header class="meta-col-head">
                        <span class="meta-col-title">{{ t('strip.after') }}</span>
                        <span
                          v-if="item.metaAfter && item.metaBefore && clearedCount(item) > 0"
                          class="badge"
                        >
                          {{ t('strip.cleared', { n: clearedCount(item) }) }}
                        </span>
                      </header>
                      <template v-if="item.status === 'done'">
                        <MetaList
                          :fields="item.metaAfter"
                          side="after"
                          :revealed="!!revealedGps[item.id]"
                          @toggle-gps="toggleGps(item.id)"
                        />
                      </template>
                      <p v-else class="meta-empty">{{ t('strip.afterPending') }}</p>
                    </section>
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
                <template v-if="store.activeMode === 'strip' && stripResultLabel(item)">
                  <span class="dot">·</span>
                  <span
                    class="strip-result-main"
                    :class="clearedCount(item) > 0 ? 'is-cleared' : 'is-clean'"
                  >{{ stripResultLabel(item) }}</span>
                  <template v-if="item.resultSize">
                    <span class="dot">·</span>
                    <span class="strip-result-size">{{ formatSize(item.resultSize) }}</span>
                  </template>
                </template>
                <template v-else-if="item.resultSize">
                  <span class="dot">·</span>
                  <span v-if="resultText(item)" class="rate">{{ resultText(item) }}</span>
                  <span v-else class="rate-negative">{{ t('batch.uncompressed') }}</span>
                </template>
              </div>
              <div class="card-actions">
                <button
                  v-if="store.activeMode === 'strip'"
                  type="button"
                  class="meta-toggle"
                  :class="{ open: expandedMeta[item.id] }"
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
            <section class="meta-col">
              <header class="meta-col-head">
                <span class="meta-col-title">{{ t('strip.before') }}</span>
              </header>
              <MetaList
                :fields="item.metaBefore"
                side="before"
                :after-keys="afterKeySet(item)"
                :revealed="!!revealedGps[item.id]"
                @toggle-gps="toggleGps(item.id)"
              />
            </section>
            <section class="meta-col">
              <header class="meta-col-head">
                <span class="meta-col-title">{{ t('strip.after') }}</span>
                <span
                  v-if="item.metaAfter && item.metaBefore && clearedCount(item) > 0"
                  class="badge"
                >
                  {{ t('strip.cleared', { n: clearedCount(item) }) }}
                </span>
              </header>
              <template v-if="item.status === 'done'">
                <MetaList
                  :fields="item.metaAfter"
                  side="after"
                  :revealed="!!revealedGps[item.id]"
                  @toggle-gps="toggleGps(item.id)"
                />
              </template>
              <p v-else class="meta-empty">{{ t('strip.afterPending') }}</p>
            </section>
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
.strip-result {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.strip-result-main {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
}
.strip-result-main.is-cleared {
  color: var(--success);
}
.strip-result-main.is-clean {
  color: var(--text-secondary);
}
.strip-result-size,
.strip-result-placeholder {
  font-size: var(--font-caption);
  color: var(--text-muted);
  font-weight: 400;
}

.action-cell {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.meta-toggle {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: var(--font-caption);
  font-weight: 500;
  cursor: pointer;
  transition: background var(--ease), border-color var(--ease), color var(--ease);
}
.meta-toggle:hover {
  border-color: var(--border-strong);
  color: var(--text);
  background: var(--bg-hover);
}
.meta-toggle.open {
  border-color: color-mix(in srgb, var(--primary) 35%, var(--border));
  background: var(--primary-bg);
  color: var(--primary-text);
}
.meta-row td {
  padding: 0 var(--space-3) var(--space-3) !important;
  background: var(--bg-faint);
  vertical-align: top;
}
.meta-compare {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}
.meta-col {
  min-width: 0;
  padding: var(--space-2) var(--space-3) var(--space-3);
}
.meta-col + .meta-col {
  border-left: 1px solid var(--border);
}
.meta-col-head {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
  margin: 0 0 var(--space-2);
  padding-bottom: var(--space-1);
  border-bottom: 1px solid var(--border);
}
.meta-col-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.badge {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  color: var(--success);
  background: var(--tag-done-bg);
}
:deep(.meta-empty),
.meta-empty {
  margin: 0;
  font-size: var(--font-caption);
  color: var(--text-muted);
  line-height: 1.5;
}
:deep(.meta-fields) {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
:deep(.meta-field) {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: var(--space-2);
  align-items: start;
  padding: 6px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  font-size: var(--font-caption);
  line-height: 1.45;
}
:deep(.meta-field:last-child) {
  border-bottom: none;
  padding-bottom: 0;
}
:deep(.meta-field.cleared) {
  opacity: 0.55;
}
:deep(.meta-field.cleared .meta-label),
:deep(.meta-field.cleared .meta-value),
:deep(.meta-field.cleared .meta-chip) {
  text-decoration: line-through;
  text-decoration-color: color-mix(in srgb, var(--text-muted) 55%, transparent);
}
:deep(.meta-label) {
  color: var(--text-muted);
  font-weight: 500;
  padding-top: 1px;
}
:deep(.meta-value-wrap) {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
:deep(.meta-value) {
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  white-space: normal;
  word-break: break-word;
}
:deep(.meta-value.is-secret) {
  color: var(--text-secondary);
}
:deep(.meta-chip) {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--bg-dim);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
}
:deep(.meta-ghost-btn) {
  border: none;
  background: none;
  padding: 0;
  margin: 0;
  font: inherit;
  font-size: 11px;
  font-weight: 500;
  color: var(--primary);
  cursor: pointer;
}
:deep(.meta-ghost-btn:hover) {
  color: var(--primary-hover);
}

@media (max-width: 900px) {
  .meta-compare {
    grid-template-columns: 1fr;
  }
  .meta-col + .meta-col {
    border-left: none;
    border-top: 1px solid var(--border);
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
