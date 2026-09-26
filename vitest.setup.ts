import { Storage } from 'happy-dom';

/**
 * Node 22+ 在 `globalThis` 上预先定义了一个 `localStorage` 访问器：未传
 * `--localstorage-file` 时它求值为 `undefined`。而 vitest 的 happy-dom 环境里
 * `globalThis.window === globalThis`，happy-dom 对 `window.localStorage` 的赋值
 * 等于对 `globalThis` 赋值 —— 那个属性只有 getter 没有 setter，**赋值静默失败**，
 * 于是 happy-dom 的实现根本没装上去。
 *
 * 后果：任何走 pinia `persist` 的测试都在 `localStorage.clear()` 上炸成
 * `undefined.clear()`。本机 Node 26 上是 43 个用例。
 *
 * 这里用 `Object.defineProperty` 强行覆盖（`configurable: true`，可以覆盖），
 * 并复用 happy-dom 自己的 `Storage` 实现，保证行为与正常 happy-dom 环境一致。
 */
function installStorage(key: 'localStorage' | 'sessionStorage') {
  const current = Object.getOwnPropertyDescriptor(globalThis, key);

  // 已经是一个可用的 Storage 就别动它（未来 Node / happy-dom 修好后自动让位）
  if (
    current?.value &&
    typeof (current.value as Storage).setItem === 'function'
  ) {
    return;
  }

  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: new Storage(),
    writable: true,
  });
}

installStorage('localStorage');
installStorage('sessionStorage');
