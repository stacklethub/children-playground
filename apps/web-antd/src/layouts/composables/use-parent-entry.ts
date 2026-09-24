import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { useDeviceStore } from '#/store';

/** 家长中心首页（需家长登录态） */
const PARENT_HOME = '/parent/dashboard';

/**
 * 宝宝端的「家长入口」流程：成人验证 → 本机有多个可切换学习者时先给切换面板，
 * 否则直接进入家长中心。
 *
 * 两个去向的性质不同：切换设备的学习者是设备级设置（无需登录），
 * 进入家长中心需要家长账号登录态。
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
