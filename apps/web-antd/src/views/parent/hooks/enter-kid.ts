/**
 * 「进入宝宝端」的动作决策。
 *
 * 抽成纯函数是为了可回归测试 —— 这个入口会改「这台设备的学习者」（设备级状态），
 * 属于项目核心约定里**极少数允许变更它**的地方，三条路径的边界必须锁死：
 *
 * - `navigate`：目标就是当前学习者 → 纯导航。**绝不能**再走一次 `bindChild`，
 *   否则「点一下看看」就变成了隐式重绑定（本项目早期 `fetchChildren()` 自动绑
 *   `children[0]` 就是这个类型的 bug，已修并有回归测试）。
 * - `bind`：设备还没选过学习者 → 直接绑定，无歧义、不必打断。
 * - `confirm`：当前学习者是**别的孩子** → 会把宝宝端从另一个孩子手里切走，
 *   必须二次确认后再切换。
 */
export type EnterKidAction = 'bind' | 'confirm' | 'navigate';

export function resolveEnterKidAction(
  boundChildId: string | undefined,
  targetChildId: string,
): EnterKidAction {
  if (boundChildId === targetChildId) return 'navigate';
  if (!boundChildId) return 'bind';
  return 'confirm';
}
