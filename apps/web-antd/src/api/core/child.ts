/**
 * 孩子档案类型定义（无后端模式：数据本机存储）。
 *
 * 删除服务端后，这里只保留类型（ChildApi），不再有 CRUD 接口函数。
 * store/device.ts 与 store/family.ts 直接读写本地 IndexedDB / localStorage。
 */
export namespace ChildApi {
  /** 孩子档案 */
  export interface ChildProfile {
    avatar: string;
    birthday?: string;
    createdAt: number;
    id: string;
    name: string;
  }

  export interface ChildDraft {
    avatar?: string;
    birthday?: string;
    name: string;
  }

  /** 孩子与设备的绑定结果（无后端模式下不再签发令牌，保留类型兼容） */
  export interface ChildBindResult {
    bindToken: string;
    child: ChildProfile;
  }
}
