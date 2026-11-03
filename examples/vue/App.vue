<script setup>
import { ref } from 'vue';
import { UiView, useUiProp } from '@link-foundation/ui-vue';
import styles from '../../docs/case-studies/issue-1/samples/styles.lino?raw';
import tokens from '../../docs/case-studies/issue-1/samples/tokens.lino?raw';
import SalesChart from './SalesChart.vue';

const props = defineProps({ store: { type: Object, required: true } });

// The store comes from createUiPlugin; the ref changes with the prop only.
const greeting = useUiProp('greeting', 'value');
const lastAction = ref('none');
const components = { chart: SalesChart };
const options = { styles, tokens, setTitle: false };

const greetings = ['Hello, links', 'Hello again, links'];
function changeGreeting() {
  const current = greeting.value?.[0] ?? greetings[0];
  const next = greetings[(greetings.indexOf(current) + 1) % greetings.length];
  props.store.setProp('greeting', 'value', [next]);
}

function onAction({ source, event, action }) {
  lastAction.value = `${source} ${event} → (${action.join(' ')})`;
}
</script>

<template>
  <main>
    <h1>ui-vue example</h1>
    <p>
      <code>document.lino</code> rendered by <code>UiView</code>; the
      <code>chart</code> element is a Vue component teleported into the ui-dom
      tree.
    </p>
    <UiView
      class="view"
      :components="components"
      :options="options"
      @action="onAction"
    />
    <div class="controls">
      <button id="change" type="button" @click="changeGreeting">
        Change greeting
      </button>
      <span>
        Greeting in Vue: <output id="greeting">{{ greeting?.[0] }}</output>
      </span>
      <span>
        Last action:
        <output id="action" aria-live="polite">{{ lastAction }}</output>
      </span>
    </div>
  </main>
</template>

<style scoped>
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  align-items: center;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #cac4d0;
}
output {
  font-family: ui-monospace, monospace;
}
</style>
