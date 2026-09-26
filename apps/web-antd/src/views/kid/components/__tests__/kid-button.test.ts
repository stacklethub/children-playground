import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import KidButton from '../kid-button.vue';

describe('kidButton', () => {
  it('点击时派发 tap 事件', async () => {
    const wrapper = mount(KidButton, { slots: { default: '下一个' } });
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('tap')).toHaveLength(1);
  });

  it('disabled 时点击不派发 tap', async () => {
    const wrapper = mount(KidButton, {
      props: { disabled: true },
      slots: { default: '下一个' },
    });
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('tap')).toBeUndefined();
  });

  it('默认用主色，variant=ghost 时改用纸白', () => {
    const primary = mount(KidButton, { slots: { default: 'x' } });
    expect(primary.get('button').classes()).toContain('bg-kid-apricot');

    const ghost = mount(KidButton, {
      props: { variant: 'ghost' },
      slots: { default: 'x' },
    });
    expect(ghost.get('button').classes()).toContain('bg-kid-paper');
  });

  it('主按钮文字用暖棕而非白色（白字对比度仅 2.00:1，不达标）', () => {
    const primary = mount(KidButton, { slots: { default: 'x' } });
    expect(primary.get('button').classes()).toContain('text-kid-ink');
  });
});
