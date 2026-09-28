"""把公众号排版稿推送到微信公众号草稿箱。

凭据从仓库根目录的 .env.local 读取（该文件已被 .gitignore 忽略）：
    WECHAT_APPID / WECHAT_SECRET / WECHAT_AUTHOR

用法：
    python push_to_wechat.py --check    只做本地检查与图片尺寸预检，不联网写数据
    python push_to_wechat.py            上传图片 + 创建草稿
    python push_to_wechat.py --list     列出草稿箱现有草稿
"""

import argparse
import io
import json
import os
import re
import sys
from pathlib import Path

import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parents[1]
ARTICLES = REPO_ROOT / "articles"
IMG_DIR = REPO_ROOT / "docs" / "img"

HTML_FILE = ARTICLES / "我给孩子写了一个网页_排版_留白禅意风(zen-whitespace).html"
OUT_FILE = ARTICLES / "我给孩子写了一个网页_公众号版.html"

TITLE = "我给孩子写了一个网页，打开就是七个乐园"
DIGEST = "我给孩子写了一个网页，断网也能玩"

SKILL_SCRIPTS = Path(os.path.expanduser("~/.workbuddy/skills/wechat-draft-publisher/scripts"))
CACHE_DIR = SKILL_SCRIPTS / ".wechat_cache"
URL_CACHE = CACHE_DIR / "img_urls.json"
COVER_CACHE = CACHE_DIR / "cover_thumb.json"

# 封面候选，按顺序取第一个存在的（需要重新生成时改这里）
COVER_CANDIDATES = [IMG_DIR / "首图-禅意.jpg", IMG_DIR / "横屏截图.png"]

sys.path.insert(0, str(SKILL_SCRIPTS))
from wechat_publisher import WeChatPublisher  # noqa: E402


def load_env_local() -> dict:
    """读取 .env.local（简单 KEY=VALUE，不做变量展开）"""
    path = REPO_ROOT / ".env.local"
    if not path.exists():
        raise SystemExit(f"缺少凭据文件：{path}")

    env = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        env[key.strip()] = value.strip().strip("'\"")
    return env


def clamp_bytes(text: str, limit: int = 50) -> str:
    """按 UTF-8 字节数截断，不切坏多字节字符"""
    raw = text.encode("utf-8")
    if len(raw) <= limit:
        return text
    return raw[:limit].decode("utf-8", errors="ignore")


def wx_post(endpoint: str, token: str, payload: dict) -> dict:
    """调用微信 API。

    必须自己 decode：微信部分接口的响应头不带 charset，requests 会按
    ISO-8859-1 猜，中文标题会变成乱码（技能自带的 list_drafts 就有这个问题）。
    """
    resp = requests.post(
        f"https://api.weixin.qq.com/cgi-bin/{endpoint}?access_token={token}",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json; charset=utf-8"},
        timeout=30,
    )
    return json.loads(resp.content.decode("utf-8"))


def list_drafts(token: str):
    resp = wx_post("draft/batchget", token, {"offset": 0, "count": 20, "no_content": 1})
    items = resp.get("item", [])
    if not items:
        print("草稿箱为空")
    for it in items:
        news = it.get("content", {}).get("news_item", [{}])[0]
        print(f"  {news.get('title', '?')}  ({it.get('media_id', '?')})")
    return items


def verify_draft(token: str, media_id: str, author: str) -> bool:
    """回读草稿，逐项核对（微信返回的 content 是 HTML 转义过的，属正常）"""
    resp = wx_post("draft/get", token, {"media_id": media_id})
    items = resp.get("news_item")
    if not items:
        print(f"[校验] 回读失败：{resp}")
        return False

    it = items[0]
    content = it.get("content", "")
    checks = [
        ("标题", it.get("title") == TITLE, it.get("title")),
        ("作者", it.get("author") == author, it.get("author")),
        ("摘要字节", len(it.get("digest", "").encode("utf-8")) <= 50,
         len(it.get("digest", "").encode("utf-8"))),
        ("图片数 15", content.count("<img") == 15, content.count("<img")),
        ("无本地路径", "../docs/img" not in content, content.count("../docs/img")),
        ("封面已设", bool(it.get("thumb_media_id")), it.get("thumb_media_id", "")[:16]),
    ]
    ok = True
    for name, passed, value in checks:
        print(f"  [{'OK' if passed else 'NG'}] {name}: {value}")
        ok = ok and passed
    return ok


def make_cover(src: Path, dest: Path) -> Path:
    """把截图转成 ≤64KB 的 JPEG 封面"""
    from PIL import Image

    im = Image.open(src).convert("RGB")
    max_bytes = 62_000
    for width in (900, 800, 700, 600, 500):
        height = max(1, round(im.height * width / im.width))
        resized = im.resize((width, height), Image.LANCZOS)
        for quality in (82, 74, 66, 58, 50, 42, 34):
            resized.save(dest, "JPEG", quality=quality, optimize=True)
            if dest.stat().st_size <= max_bytes:
                print(f"[封面] {src.name} → {width}x{height} q{quality}, "
                      f"{dest.stat().st_size / 1024:.1f}KB")
                return dest
    raise SystemExit("封面压缩失败：无法压到 64KB 以内")


def upload_body_images(wp, html: str, refresh: bool):
    """上传正文图片，返回 (新 html, 上传张数)"""
    cache = json.loads(URL_CACHE.read_text(encoding="utf-8")) if URL_CACHE.exists() else {}
    srcs = list(dict.fromkeys(re.findall(r'<img[^>]+src="(\.\./docs/img/[^"]+)"', html)))
    print(f"[图片] 正文共 {len(srcs)} 张")

    uploaded = 0
    for rel in srcs:
        path = (ARTICLES / rel).resolve()
        if not path.exists():
            raise SystemExit(f"图片缺失：{path}")

        if not refresh and rel in cache:
            url = cache[rel]
            print(f"  - 命中缓存 {rel}")
        else:
            url = wp.upload_image(str(path))
            cache[rel] = url
            uploaded += 1
            print(f"  - 已上传 {rel}")

        html = html.replace(f'src="{rel}"', f'src="{url}"')

    CACHE_DIR.mkdir(exist_ok=True)
    URL_CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    return html, uploaded


def get_cover_thumb(wp, refresh: bool) -> str:
    """上传封面为永久素材 thumb。缓存里记了源文件名，换图会自动重传。"""
    src = next((p for p in COVER_CANDIDATES if p.exists()), None)
    if src is None:
        raise SystemExit(f"找不到封面图，候选：{[p.name for p in COVER_CANDIDATES]}")

    if not refresh and COVER_CACHE.exists():
        data = json.loads(COVER_CACHE.read_text(encoding="utf-8"))
        if data.get("src") == src.name:
            print(f"[封面] 命中缓存 {data['media_id'][:16]}…（{src.name}）")
            return data["media_id"]
        print(f"[封面] 源图已换成 {src.name}，重新上传")

    CACHE_DIR.mkdir(exist_ok=True)
    if src.suffix.lower() == ".jpg":
        cover = src
        print(f"[封面] {src.name} 已是 JPEG，{src.stat().st_size / 1024:.1f}KB")
    else:
        cover = CACHE_DIR / "_cover.jpg"
        make_cover(src, cover)

    media_id = wp.upload_thumb(str(cover))
    COVER_CACHE.write_text(json.dumps({"media_id": media_id, "src": src.name}),
                           encoding="utf-8")
    return media_id


def build_article(html: str, thumb: str, digest: str, author: str) -> dict:
    return {
        "title": TITLE,
        "author": author,
        "digest": digest,
        "content": html,
        "content_source_url": "",
        "thumb_media_id": thumb,
        "show_cover_pic": 1,
        "need_open_comment": 0,
        "only_fans_can_comment": 0,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="只本地检查，不联网")
    parser.add_argument("--list", action="store_true", help="列出草稿箱")
    parser.add_argument("--verify", metavar="MEDIA_ID", help="回读指定草稿逐项核对")
    parser.add_argument("--update-draft", metavar="MEDIA_ID",
                        help="就地更新已有草稿（不新建一条）")
    parser.add_argument("--refresh-images", action="store_true", help="忽略图片 URL 缓存重新上传")
    parser.add_argument("--refresh-cover", action="store_true", help="重新上传封面")
    args = parser.parse_args()

    env = load_env_local()
    for key in ("WECHAT_APPID", "WECHAT_SECRET"):
        if not env.get(key):
            raise SystemExit(f".env.local 缺少 {key}")

    appid, secret = env["WECHAT_APPID"], env["WECHAT_SECRET"]
    author = env.get("WECHAT_AUTHOR", "")
    print(f"[配置] appid={appid[:6]}*** author={author}")

    html = HTML_FILE.read_text(encoding="utf-8")
    imgs = re.findall(r'<img[^>]+src="(\.\./docs/img/[^"]+)"', html)
    print(f"[稿件] {HTML_FILE.name}  {len(html)} 字符 / <img> {len(imgs)} 张")
    print(f"[标题] {TITLE}  ({len(TITLE)} 字 / {len(TITLE.encode('utf-8'))} 字节)")
    digest = clamp_bytes(DIGEST)
    print(f"[摘要] {digest}  ({len(digest.encode('utf-8'))} 字节)")

    for token in ("<style", 'class="'):
        if token in html:
            print(f"⚠️ 稿件含微信会过滤的 {token}")

    if args.check:
        missing = [r for r in dict.fromkeys(imgs) if not (ARTICLES / r).exists()]
        print(f"[检查] 图片缺失 {len(missing)} 张" + (f"：{missing}" if missing else ""))
        print("[检查] 未联网，未写入任何数据")
        return

    # 技能自带的 token 缓存是全局共享的，若其中残留的是别的公众号的 token，
    # 会静默串号 → 每次推送前清掉，强制按本账号重新取一次。
    stale = CACHE_DIR / "token.json"
    if stale.exists():
        stale.unlink()
        print("[Token] 已清除共享缓存，按本账号重新获取")

    wp = WeChatPublisher(appid, secret)

    if args.list:
        list_drafts(wp.get_token())
        return

    if args.verify:
        ok = verify_draft(wp.get_token(), args.verify, author)
        print("[校验] 通过" if ok else "[校验] 有问题，见上")
        sys.exit(0 if ok else 1)

    html, uploaded = upload_body_images(wp, html, args.refresh_images)
    print(f"[图片] 本次上传 {uploaded} 张，其余走缓存")

    OUT_FILE.write_text(html, encoding="utf-8")
    print(f"[产物] 已写出 {OUT_FILE.relative_to(REPO_ROOT)}")

    thumb = get_cover_thumb(wp, args.refresh_cover)

    token = wp.get_token()
    article = build_article(html, thumb, digest, author)

    if args.update_draft:
        resp = wx_post("draft/update", token,
                       {"media_id": args.update_draft, "index": 0, "articles": article})
        if resp.get("errcode") != 0:
            raise SystemExit(f"草稿更新失败：{resp}")
        media_id = args.update_draft
        print(f"DONE - 已就地更新草稿 {media_id}")
    else:
        resp = wx_post("draft/add", token, {"articles": [article]})
        if "media_id" not in resp:
            raise SystemExit(f"草稿创建失败：{resp}")
        media_id = resp["media_id"]
        print(f"DONE - media_id: {media_id}")

    print("[校验] 回读草稿：")
    if not verify_draft(token, media_id, author):
        print("⚠️ 回读校验未全过，请去后台人工确认")
    print("去公众号后台「草稿箱」预览并手动发布")


if __name__ == "__main__":
    main()
