import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import KidTabs from '../kid-tabs.vue';

const ITEMS = [
  { label: '认字母', value: 'learn' },
  { label: '考一考', value: 'quiz' },
];

describe('kidTabs', () => {
  it('渲染全部选项', () => {
    const wrapper = mount(KidTabs, {
      props: { items: ITEMS, modelValue: 'learn' },
    });
    expect(wrapper.findAll('button')).toHaveLength(2);
    expect(wrapper.text()).toContain('考一考');
  });

  it('点击未选中项时更新 modelValue 并派发 change', async () => {
    const wrapper = mount(KidTabs, {
      props: { items: ITEMS, modelValue: 'learn' },
    });
    await wrapper.get('button:last-child').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['quiz']);
    expect(wrapper.emitted('change')?.[0]).toEqual(['quiz']);
  });

  it('点击已选中项不派发事件', async () => {
    const wrapper = mount(KidTabs, {
      props: { items: ITEMS, modelValue: 'learn' },
    });
    await wrapper.get('button:first-child').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('选中项带上主题色类，未选中不带', () => {
    const wrapper = mount(KidTabs, {
      props: { items: ITEMS, modelValue: 'quiz', accent: 'coral' },
    });
    expect(wrapper.get('button:last-child').classes()).toContain(
      'bg-kid-coral',
    );
    expect(wrapper.get('button:first-child').classes()).not.toContain(
      'bg-kid-coral',
    );
  });
});
