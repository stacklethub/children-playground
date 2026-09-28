#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""创建 / 查看 / 删除公众号自定义菜单。

凭据读仓库根目录 .env.local（WECHAT_APPID / WECHAT_SECRET），脚本不落盘任何密钥。

用法：
    python articles/setup_menu.py --dry-run     # 只打印将要提交的 JSON + 当前线上菜单（默认）
    python articles/setup_menu.py --apply       # 创建菜单（覆盖后台已有菜单）
    python articles/setup_menu.py --get         # 查看当前线上菜单
    python articles/setup_menu.py --delete      # 删除菜单

改结构只动下面的 TOP 和 LINKS 两块：
    - LINKS 里有 URL → 该项为「跳转网页」(view)
    - LINKS 里为 None → 该项为「点击型」(click)，key 就是关键词，需在后台「自动回复 → 关键词回复」配好对应规则

⚠️ 平台限制（2026-09-28 实测 + 官方文档）：
    - 本号未完成微信认证 → `menu/create` / `menu/get` 直接返回 48001 api unauthorized，接口路线走不通，只能在后台手配。
    - 即使有接口权限，未认证号的「跳转网页」也只能填本号内容（页面模板 / 合集 / 历史消息 / 已发表文章），
      填 GitHub 等外链会被拒（后台提示「发布失败，链接内容不属于当前公众号」，接口报 45058 invalid url domain）。
    - 未认证号的菜单动作「发送消息」不支持纯文字，只能挂图文消息。
    - 外链的可靠出口是「关键词自动回复」：文字回复里带 URL，用户在对话窗口可直接点击。
"""

import argparse
import json
import os
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / ".env.local"
API = "https://api.weixin.qq.com/cgi-bin"

# ---------------------------------------------------------------------------
# 菜单结构：一级菜单 → [(二级菜单名, 关键词)]
# ---------------------------------------------------------------------------
TOP = [
    (
        "学技能",
        [
            ("前端实战", "前端"),
            ("全栈部署", "全栈"),
            ("AI 提效", "ai"),
            ("全部文章", "全部文章"),
        ],
    ),
    (
        "看作品",
        [
            ("幼儿学堂", "幼儿学堂"),
            ("在线工具", "在线工具"),
            ("开源代码", "开源代码"),
            ("作品清单", "作品"),
        ],
    ),
    (
        "找我",
        [
            ("关于作者", "关于"),
            ("加群交流", "加群"),
            ("合作投稿", "合作"),
            ("提问留言", "提问"),
        ],
    ),
]

# ---------------------------------------------------------------------------
# 外链：键为二级菜单名，值为 https URL。填了就走「跳转网页」，留 None 就是点击型。
# ---------------------------------------------------------------------------
LINKS = {
    "全部文章": None,  # 待补：后台「合集」或「页面模板」链接
    "幼儿学堂": None,  # 待补：单页应用上线后的 HTTPS 链接
    "在线工具": None,  # 待补：网站工具页，例如 https://nav.xiansoftware.com/tools
    "开源代码": None,  # 待补：GitHub 主页，例如 https://github.com/<用户名>
    "作品清单": None,  # 待补：作品汇总页
}


def load_env() -> tuple[str, str]:
    if not ENV_FILE.exists():
        sys.exit(f"缺少 {ENV_FILE}")
    env: dict[str, str] = {}
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        env[key.strip()] = value.strip().strip('"').strip("'")
    appid, secret = env.get("WECHAT_APPID"), env.get("WECHAT_SECRET")
    if not appid or not secret:
        sys.exit(".env.local 缺少 WECHAT_APPID 或 WECHAT_SECRET")
    return appid, secret


def wx_get(url: str, params: dict) -> dict:
    resp = requests.get(url, params=params, timeout=20)
    return json.loads(resp.content.decode("utf-8"))


def wx_post(url: str, params: dict, payload: dict | None = None) -> dict:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
    resp = requests.post(url, params=params, data=body, timeout=20,
                         headers={"Content-Type": "application/json; charset=utf-8"})
    return json.loads(resp.content.decode("utf-8"))


def get_token(appid: str, secret: str) -> str:
    data = wx_get(f"{API}/token", {"grant_type": "client_credential", "appid": appid, "secret": secret})
    if "access_token" not in data:
        sys.exit(f"获取 access_token 失败：{data}")
    return data["access_token"]


def build_menu() -> dict:
    buttons = []
    for top_name, children in TOP:
        subs = []
        for name, keyword in children:
            url = LINKS.get(name)
            if url:
                subs.append({"type": "view", "name": name, "url": url})
            else:
                subs.append({"type": "click", "name": name, "key": keyword})
        buttons.append({"name": top_name, "sub_button": subs})
    return {"button": buttons}


def describe(menu: dict) -> str:
    lines = []
    for top in menu.get("button", []):
        lines.append(f"[{top['name']}]")
        for sub in top.get("sub_button", []):
            if sub.get("type") == "view":
                detail = f"view  {sub.get('url')}"
            elif sub.get("type") == "click":
                detail = f"click  关键词「{sub.get('key')}」"
            else:
                detail = sub.get("type", "?")
            lines.append(f"    {sub['name']:<6} {detail}")
        if not top.get("sub_button"):
            lines.append(f"    (无二级) {top.get('type')} {top.get('url') or top.get('key', '')}")
    return "\n".join(lines) if lines else "(空)"


def main() -> None:
    parser = argparse.ArgumentParser(description="公众号自定义菜单管理")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--apply", action="store_true", help="创建菜单（覆盖已有）")
    group.add_argument("--get", action="store_true", help="查看当前线上菜单")
    group.add_argument("--delete", action="store_true", help="删除菜单")
    group.add_argument("--dry-run", action="store_true", help="只预览，不提交（默认行为）")
    args = parser.parse_args()

    menu = build_menu()
    clicks = [s["name"] for t in menu["button"] for s in t["sub_button"] if s["type"] == "click"]
    views = [(s["name"], s["url"]) for t in menu["button"] for s in t["sub_button"] if s["type"] == "view"]

    if not (args.apply or args.get or args.delete):
        print("== 将要提交的菜单 JSON ==")
        print(json.dumps(menu, ensure_ascii=False, indent=2))
        print(f"\n点击型 {len(clicks)} 项（需后台配关键词回复）：{'、'.join(clicks) or '无'}")
        print(f"跳转网页 {len(views)} 项：{views or '无（外链未填，全部为点击型）'}")

    appid, secret = load_env()
    token = get_token(appid, secret)

    if args.delete:
        print("删除结果：", wx_get(f"{API}/menu/delete", {"access_token": token}))
        return

    if not args.apply:
        current = wx_get(f"{API}/menu/get", {"access_token": token})
        if current.get("errcode") == 46003:
            print("\n== 当前线上菜单 ==\n(空，尚未创建)")
        elif "menu" in current:
            print("\n== 当前线上菜单 ==")
            print(describe(current["menu"]))
        else:
            print("\n读取当前菜单失败：", current)
        if not args.get:
            print("\n（预览模式，未提交。加 --apply 才会真正创建）")
        return

    result = wx_post(f"{API}/menu/create", {"access_token": token}, menu)
    print("创建结果：", result)
    if result.get("errcode") == 0:
        print("\n== 线上菜单已更新 ==")
        print(describe(wx_get(f"{API}/menu/get", {"access_token": token}).get("menu", {})))


if __name__ == "__main__":
    main()
