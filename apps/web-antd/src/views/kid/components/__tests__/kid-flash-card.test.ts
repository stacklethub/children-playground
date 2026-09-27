import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import KidFlashCard from '../kid-flash-card.vue';

describe('kidFlashCard', () => {
  it('渲染插槽内容', () => {
    const wrapper = mount(KidFlashCard, { slots: { default: '字母 A' } });
    expect(wrapper.text()).toContain('字母 A');
  });

  it('默认可交互，渲染为 button 并带数据锚点', () => {
    const wrapper = mount(KidFlashCard, { slots: { default: 'x' } });
    expect(wrapper.find('button').exists()).toBe(true);
    expect(wrapper.find('[data-star-anchor]').exists()).toBe(true);
  });

  it('interactive=false 时渲染为 section', () => {
    const wrapper = mount(KidFlashCard, {
      props: { interactive: false },
      slots: { default: 'x' },
    });
    expect(wrapper.find('section').exists()).toBe(true);
    expect(wrapper.find('button').exists()).toBe(false);
  });

  it('点击时触发 tap 事件', async () => {
    const wrapper = mount(KidFlashCard, { slots: { default: 'x' } });
    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted('tap')).toBeTruthy();
  });

  it('传入 hint 时在底部显示提示语', () => {
    const wrapper = mount(KidFlashCard, {
      props: { hint: '点一点，听一听' },
      slots: { default: 'x' },
    });
    expect(wrapper.text()).toContain('点一点，听一听');
  });
});
