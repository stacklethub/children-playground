import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { useDeviceStore } from '#/store';
import { markParentGatePassed } from '#/utils/parent-gate';

/** 家长中心首页（无后端模式：家长门禁替代登录） */
const PARENT_HOME = '/parent/dashboard';

/**
 * 宝宝端的「家长入口」流程：成人验证 → 本机有多个可切换学习者时先给切换面板，
 * 否则直接进入家长中心。
 *
 * 两个去向的性质不同：切换设备的学习者是设备级设置（无需门禁），
 * 进入家长中心需要先通过家长门禁（无后端模式下替代账号登录）。
 */
export function useParentEntry() {
  const router = useRouter();
  const deviceStore = useDeviceStore();

  const gateOpen = ref(false);
  const switchOpen = ref(false);

  /** 打开家长入口（先做成人验证） */
  function openParentEntry() {
    gateOpen.value = true;
  }

  function onGatePassed() {
    // 门禁通过即视为「已通过家长验证」，本次会话内可直接进家长中心
    markParentGatePassed();
    if (deviceStore.canSwitch) {
      switchOpen.value = true;
    } else {
      enterParentCenter();
    }
  }

  function enterParentCenter() {
    switchOpen.value = false;
    router.push(PARENT_HOME);
  }

  return {
    enterParentCenter,
    gateOpen,
    onGatePassed,
    openParentEntry,
    switchOpen,
  };
}
