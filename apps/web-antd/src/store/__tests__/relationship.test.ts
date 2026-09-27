import type { ChildApi } from '#/api';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { getBindToken } from '#/utils/bind-token';

import { useDeviceStore, useFamilyStore, useKidStore } from '..';

/**
 * 回归测试：家长 与 幼儿（设备学习者）的对应关系。
 *
 * 保护的不变量（曾经全部被违反，导致"宝宝端默认就是某个幼儿"）：
 * 1. 浏览、拉取孩子列表 **不** 决定设备的学习者；
 * 2. 新建 / 删除孩子 不会隐式改变设备的学习者；
 * 3. 设备学习者只能由家长显式绑定产生（**唯一例外**：首次运行由
 *    `ensureDefaultChild` 一次性预置默认孩子并绑定，见文件末尾用例）；
 * 4. 家长退出（$reset）**不** 清空设备绑定与本机学习记录；
 * 5. 只能切换到本机绑定过的孩子。
 *
 * 无后端模式：孩子档案与学习记录本机存储（IndexedDB），
 * 绑定关系用 localStorage（bind-token 退化为 childId 集合）。
 */

/* oxlint-disable unicorn/prefer-dom-node-remove -- family store 的业务方法 removeChild
   （删孩子档案）与 DOM Node.removeChild 同名，规则只按名字判断，在本文件全部调用处误报。 */

const childA: ChildApi.ChildProfile = {
  avatar: '👧',
  createdAt: 1,
  id: 'child-a',
  name: '小星星',
};

const childB: ChildApi.ChildProfile = {
  avatar: '👦',
  createdAt: 2,
  id: 'child-b',
  name: '小月亮',
};

describe('家长 与 设备学习者 的关系', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('拉取孩子列表，不会把设备学习者默认成列表第一个孩子', async () => {
    const family = useFamilyStore();
    const device = useDeviceStore();

    await family.addChild({ name: childA.name });
    await family.addChild({ name: childB.name });

    expect(family.children).toHaveLength(2);
    // 关键：家长只是浏览，设备的学习者仍然为空
    expect(device.bound).toBe(false);
    expect(device.boundChildId).toBeUndefined();
    expect(device.knownChildren).toHaveLength(0);
  });

  it('新建孩子不会自动成为设备学习者', async () => {
    const family = useFamilyStore();
    const device = useDeviceStore();

    await family.addChild({ name: childA.name });

    expect(family.children).toHaveLength(1);
    expect(device.bound).toBe(false);
  });

  it('只有家长显式绑定，才会产生设备学习者与绑定标记', async () => {
    const device = useDeviceStore();

    await device.bindChild(childA);

    expect(device.bound).toBe(true);
    expect(device.boundChildId).toBe(childA.id);
    expect(device.knownChildren.map((c) => c.id)).toEqual([childA.id]);
    expect(getBindToken(childA.id)).toBe('local');
  });

  it('家长退出不会清空设备绑定与本机学习记录', async () => {
    const device = useDeviceStore();
    const family = useFamilyStore();
    const kid = useKidStore();

    await family.addChild({ name: childA.name });
    await device.bindChild(childA);
    kid.addRecord({
      childId: childA.id,
      itemId: 'a1',
      module: 'cards',
      stars: 2,
    });

    // 模拟家长退出（resetAllStores）
    family.$reset();
    device.$reset();
    kid.$reset();

    expect(family.children).toHaveLength(0); // 家长数据随退出清空
    expect(device.boundChildId).toBe(childA.id); // 设备学习者保留
    expect(kid.records).toHaveLength(1); // 本机学习记录保留
    expect(getBindToken(childA.id)).toBe('local'); // 绑定标记保留
  });

  it('删除设备当前学习者时解除绑定并清理标记', async () => {
    const family = useFamilyStore();
    const device = useDeviceStore();

    await family.addChild({ name: childA.name });
    await device.bindChild(childA);

    await family.removeChild(childA.id);

    expect(device.bound).toBe(false);
    expect(device.knownChildren).toHaveLength(0);
    expect(getBindToken(childA.id)).toBeUndefined();
  });

  it('删除其他孩子不会影响设备当前学习者', async () => {
    const device = useDeviceStore();
    const family = useFamilyStore();

    await family.addChild({ name: childA.name });
    await family.addChild({ name: childB.name });
    await device.bindChild(childA);
    await family.removeChild(childB.id);

    expect(device.boundChildId).toBe(childA.id);
  });

  it('删除孩子会一并清理其本机学习记录，且不影响其他孩子的记录', async () => {
    const family = useFamilyStore();
    const kid = useKidStore();

    await family.addChild({ name: childA.name });
    await family.addChild({ name: childB.name });
    for (const child of [childA, childB]) {
      kid.addRecord({
        childId: child.id,
        itemId: 'a1',
        module: 'cards',
        stars: 1,
      });
    }
    expect(kid.records).toHaveLength(2);

    await family.removeChild(childA.id);

    expect(kid.recordsOf(childA.id)).toHaveLength(0);
    expect(kid.recordsOf(childB.id)).toHaveLength(1);
  });

  it('多孩子时可在本机切换，且不能切到未绑定过的孩子', async () => {
    const device = useDeviceStore();

    await device.bindChild(childA);
    await device.bindChild(childB);

    expect(device.canSwitch).toBe(true);
    expect(device.boundChildId).toBe(childB.id);

    expect(device.switchChild(childA.id)).toBe(true);
    expect(device.boundChildId).toBe(childA.id);
    // 未在本机绑定过的孩子不能切换
    expect(device.switchChild('child-unknown')).toBe(false);
    expect(device.boundChildId).toBe(childA.id);
  });

  it('家长改名后本机快照同步更新', async () => {
    const device = useDeviceStore();
    const family = useFamilyStore();

    const saved = await family.addChild({ name: childA.name });
    await device.bindChild(saved);
    await family.editChild(saved.id, { name: '新名字' });

    expect(device.boundChild?.name).toBe('新名字');
    expect(device.knownChildren[0]?.name).toBe('新名字');
  });

  /**
   * 首次运行预置：系统自动建一个默认孩子并绑定到本机，首页开箱即可学习。
   * 这是「显式绑定」唯一的一次性例外，故单独锁定行为边界。
   */
  describe('首次运行预置默认孩子', () => {
    it('预置一个默认孩子并绑定到本机', () => {
      const family = useFamilyStore();
      const device = useDeviceStore();

      family.ensureDefaultChild();

      expect(family.children).toHaveLength(1);
      const child = family.children[0];
      if (!child) throw new Error('ensureDefaultChild 未预置孩子');
      expect(child.name.length).toBeGreaterThan(0);
      expect(device.bound).toBe(true);
      expect(device.boundChildId).toBe(child.id);
      expect(getBindToken(child.id)).toBe('local');
    });

    it('重复调用不会重复预置', () => {
      const family = useFamilyStore();

      family.ensureDefaultChild();
      family.ensureDefaultChild();

      expect(family.children).toHaveLength(1);
    });

    it('已有孩子档案时不预置，也不改变其绑定关系', async () => {
      const family = useFamilyStore();
      const device = useDeviceStore();

      await family.addChild({ name: childA.name });
      family.ensureDefaultChild();

      expect(family.children).toHaveLength(1);
      expect(family.children[0]?.name).toBe(childA.name);
      expect(device.bound).toBe(false);
    });

    it('家长删光孩子后不会再次自动补默认孩子', async () => {
      const family = useFamilyStore();

      family.ensureDefaultChild();
      const child = family.children[0];
      if (!child) throw new Error('ensureDefaultChild 未预置孩子');
      await family.removeChild(child.id);
      family.ensureDefaultChild();

      expect(family.children).toHaveLength(0);
    });
  });
});
