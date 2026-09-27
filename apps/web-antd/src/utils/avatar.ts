/**
 * 把 emoji 变成可以当图片用的头像。
 *
 * vben 的 `VbenAvatar` 是把 `avatar` 当 `<img src>` 使用的（内部 `AvatarImage`），
 * 直接塞一个 emoji（如 `'🧑'`）会加载失败，组件就退化为渲染 `AvatarFallback` ——
 * 而兜底文本取自 `alt` 的末两个字符，`alt` 又正是用户昵称。于是在家长端右上角
 * 会同时出现「头像兜底文字」和「昵称」两段一模一样的文本（曾表现为两个「家长」）。
 *
 * 这里把 emoji 渲成内联 SVG 的 data URI：既保留项目「emoji 当头像」的写法，
 * 又不依赖任何外部图片（项目是无后端/离线可用的，不该去拉远程默认头像）。
 */
export function emojiAvatar(emoji: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<text x="32" y="52" font-size="46" text-anchor="middle">${
      emoji
    }</text></svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
