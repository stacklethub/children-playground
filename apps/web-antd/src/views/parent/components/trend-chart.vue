<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import { Card } from 'ant-design-vue';

import { $t } from '#/locales';

/** 最近 7 天学习趋势折线图 */
const props = defineProps<{ data: { count: number; label: string }[] }>();

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

function render() {
  renderEcharts({
    grid: { bottom: 0, containLabel: true, left: '1%', right: '1%', top: '10%' },
    series: [
      {
        areaStyle: { opacity: 0.15 },
        data: props.data.map((d) => d.count),
        itemStyle: { color: '#F59E0B' },
        smooth: true,
        type: 'line',
      },
    ],
    tooltip: { trigger: 'axis' },
    xAxis: {
      axisTick: { show: false },
      boundaryGap: false,
      data: props.data.map((d) => d.label),
      type: 'category',
    },
    yAxis: { minInterval: 1, type: 'value' },
  });
}

onMounted(render);
watch(() => props.data, render, { deep: true });
</script>

<template>
  <Card :title="$t('parent.dashboard.trend')">
    <EchartsUI ref="chartRef" height="300px" />
  </Card>
</template>
