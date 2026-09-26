import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import KidCard from '../kid-card.vue';

describe('kidCard', () => {
  it('渲染默认插槽内容', () => {
    const wrapper = mount(KidCard, { slots: { default: '字母 A' } });
    expect(wrapper.text()).toContain('字母 A');
  });

  it('默认带内边距，padded=false 时去掉', () => {
    const padded = mount(KidCard, { slots: { default: 'x' } });
    expect(padded.get('section').classes()).toContain('p-6');

    const bare = mount(KidCard, {
      props: { padded: false },
      slots: { default: 'x' },
    });
    expect(bare.get('section').classes()).not.toContain('p-6');
  });
});
