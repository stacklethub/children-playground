<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { Card } from 'ant-design-vue';

import { $t } from '#/locales';

/** 模块学习分布饼图 */
const props = defineProps<{
  data: { itemStyle: { color: string }; key: string; value: number }[];
}>();

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

function render() {
  renderEcharts({
    series: [
      {
        animationType: 'scale',
        center: ['50%', '50%'],
        data: props.data.map((item) => ({
          itemStyle: item.itemStyle,
          name: $t(`kid.modules.${item.key}`),
          value: item.value,
        })),
        radius: '70%',
        type: 'pie',
      },
    ],
    tooltip: { trigger: 'item' },
  });
}

onMounted(render);
watch(() => props.data, render, { deep: true });
</script>

<template>
  <Card :title="$t('parent.dashboard.dist')">
    <EchartsUI ref="chartRef" height="300px" />
  </Card>
</template>
