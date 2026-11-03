<script setup>
import { computed } from 'vue';
import { useUiProp } from '@link-foundation/ui-vue';

// UiView passes the ID of the `chart` element; its sub-links are read from
// the store, so the chart follows every change of the element.
const props = defineProps({ id: { type: String, required: true } });
const title = useUiProp(() => props.id, 'title');
const values = useUiProp(() => props.id, 'values');

const bars = computed(() => (values.value ?? []).map(Number));
const max = computed(() => Math.max(1, ...bars.value));
</script>

<template>
  <figure class="chart">
    <figcaption>{{ title?.[0] }}</figcaption>
    <div class="bars">
      <span
        v-for="(value, i) in bars"
        :key="i"
        class="bar"
        :style="{ height: `${(value / max) * 100}%` }"
        :title="String(value)"
      />
    </div>
  </figure>
</template>

<style scoped>
.chart {
  margin: 0;
  padding: 12px;
  border: 1px solid #cac4d0;
  border-radius: 12px;
  max-width: 320px;
}
figcaption {
  font-weight: 600;
  margin-bottom: 8px;
}
.bars {
  display: flex;
  gap: 6px;
  align-items: flex-end;
  height: 96px;
}
.bar {
  flex: 1;
  background: #6750a4;
  border-radius: 4px 4px 0 0;
}
</style>
