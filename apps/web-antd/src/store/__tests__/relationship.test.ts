import type { ChildApi } from '#/api';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getBindToken } from '#/utils/bind-token';

import { useDeviceStore, useFamilyStore, useKidStore } from '..';

/**
 * 回归测试：家长账号 与 幼儿（设备学习者）的对应关系。
 *
 * 保护的不变量（曾经全部被违反，导致"宝宝端默认就是某个幼儿"）：
 * 1. 登录家长账号、拉取孩子列表 **不** 决定设备的学习者；
 * 2. 新建 / 删除孩子 不会隐式改变设备的学习者；
 * 3. 设备学习者只能由家长显式绑定产生；
 * 4. 家长退出登录 **不** 清空设备绑定与本机学习记录；
 * 5. 只能切换到本机绑定过的孩子。
 */

const childA: ChildApi.ChildProfile = {
  avatar: '👧',
  createdAt: 1,
  id: 'child-a',
  name: '小星星',
  parentId: 'vben',
};

const childB: ChildApi.ChildProfile = {
  avatar: '👦',
  createdAt: 2,
  id: 'child-b',
  name: '小月亮',
  parentId: 'vben',
};

const api = vi.hoisted(() => ({
  bindChildApi: vi.fn(),
  createChildApi: vi.fn(),
  deleteChildApi: vi.fn(),
  getChildrenApi: vi.fn(),
  updateChildApi: vi.fn(),
}));

vi.mock('#/api', () => api);

describe('家长账号 与 设备学习者 的关系', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('登录家长账号并拉取孩子列表，不会把设备学习者默认成列表第一个孩子', async () => {
    const family = useFamilyStore();
    const device = useDeviceStore();

    api.getChildrenApi.mockResolvedValue([childA, childB]);
    await family.fetchChildren();

    expect(family.children).toHaveLength(2);
    // 关键：家长只是登录/浏览，设备的学习者仍然为空
    expect(device.bound).toBe(false);
    expect(device.boundChildId).toBeUndefined();
    expect(device.knownChildren).toHaveLength(0);
  });

  it('新建孩子不会自动成为设备学习者', async () => {
    const family = useFamilyStore();
    const device = useDeviceStore();

    api.createChildApi.mockResolvedValue(childA);
    await family.addChild({ name: childA.name });

    expect(family.children).toHaveLength(1);
    expect(device.bound).toBe(false);
    expect(api.bindChildApi).not.toHaveBeenCalled();
  });

  it('只有家长显式绑定，才会产生设备学习者与上报令牌', async () => {
    const device = useDeviceStore();

    api.bindChildApi.mockResolvedValue({ bindToken: 'token-a', child: childA });
    await device.bindChild(childA);

    expect(device.bound).toBe(true);
    expect(device.boundChildId).toBe(childA.id);
    expect(device.knownChildren.map((c) => c.id)).toEqual([childA.id]);
    expect(getBindToken(childA.id)).toBe('token-a');
  });

  it('家长退出登录不会清空设备绑定与本机学习记录', async () => {
    const device = useDeviceStore();
    const family = useFamilyStore();
    const kid = useKidStore();

    api.bindChildApi.mockResolvedValue({ bindToken: 'token-a', child: childA });
    api.getChildrenApi.mockResolvedValue([childA]);
    await family.fetchChildren();
    await device.bindChild(childA);
    kid.addRecord({
      childId: childA.id,
      itemId: 'a1',
      module: 'cards',
      parentId: childA.parentId,
      stars: 2,
    });

    // 模拟 resetAllStores()（家长 logout 时触发）
    family.$reset();
    device.$reset();
    kid.$reset();

    expect(family.children).toHaveLength(0); // 家长数据随登出清空
    expect(device.boundChildId).toBe(childA.id); // 设备学习者保留
    expect(kid.records).toHaveLength(1); // 本机学习记录保留
    expect(getBindToken(childA.id)).toBe('token-a'); // 上报令牌保留
  });

  it('删除设备当前学习者时解除绑定并清理令牌', async () => {
    const family = useFamilyStore();
    const device = useDeviceStore();

    api.bindChildApi.mockResolvedValue({ bindToken: 'token-a', child: childA });
    api.getChildrenApi.mockResolvedValue([childA]);
    api.deleteChildApi.mockResolvedValue(undefined);
    api.updateChildApi.mockResolvedValue(childA);

    await family.fetchChildren();
    await device.bindChild(childA);

    await family.removeChild(childA.id);

    expect(device.bound).toBe(false);
    expect(device.knownChildren).toHaveLength(0);
    expect(getBindToken(childA.id)).toBeUndefined();
  });

  it('删除其他孩子不会影响设备当前学习者', async () => {
    const device = useDeviceStore();
    const family = useFamilyStore();

    api.bindChildApi.mockResolvedValue({ bindToken: 'token-a', child: childA });
    api.getChildrenApi.mockResolvedValue([childA, childB]);
    api.deleteChildApi.mockResolvedValue(undefined);

    await family.fetchChildren();
    await device.bindChild(childA);
    await family.removeChild(childB.id);

    expect(device.boundChildId).toBe(childA.id);
  });

  it('删除孩子会一并清理其本机学习记录，且不影响其他孩子的记录', async () => {
    const family = useFamilyStore();
    const kid = useKidStore();

    api.getChildrenApi.mockResolvedValue([childA, childB]);
    api.deleteChildApi.mockResolvedValue(undefined);

    await family.fetchChildren();
    for (const child of [childA, childB]) {
      kid.addRecord({
        childId: child.id,
        itemId: 'a1',
        module: 'cards',
        parentId: child.parentId,
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

    api.bindChildApi
      .mockResolvedValueOnce({ bindToken: 'token-a', child: childA })
      .mockResolvedValueOnce({ bindToken: 'token-b', child: childB });

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

    api.bindChildApi.mockResolvedValue({ bindToken: 'token-a', child: childA });
    api.updateChildApi.mockResolvedValue({ ...childA, name: '新名字' });

    await device.bindChild(childA);
    await family.editChild(childA.id, { name: '新名字' });

    expect(device.boundChild?.name).toBe('新名字');
    expect(device.knownChildren[0]?.name).toBe('新名字');
  });
});
