from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import parse_qs, urlparse, urlunparse

from rest_framework import exceptions


@dataclass(frozen=True)
class LinkProvider:
    code: str
    label: str
    host_suffixes: tuple[str, ...]
    id_query_keys: tuple[str, ...]


PROVIDERS = (
    LinkProvider("TAOBAO", "淘宝", ("taobao.com", "tmall.com"), ("id", "item_id")),
    LinkProvider("1688", "1688", ("1688.com",), ("offerId", "offer_id", "id")),
    LinkProvider("PINDUODUO", "拼多多", ("pinduoduo.com", "yangkeduo.com"), ("goods_id", "goodsId")),
    LinkProvider("JD", "京东", ("jd.com",), ("sku", "skuId", "id")),
)


def _matches_host(host: str, suffix: str) -> bool:
    return host == suffix or host.endswith(f".{suffix}")


def _provider_for_host(host: str) -> LinkProvider | None:
    normalized = host.lower().removeprefix("www.")
    for provider in PROVIDERS:
        if any(_matches_host(normalized, suffix) for suffix in provider.host_suffixes):
            return provider
    return None


def _query_value(query: dict[str, list[str]], keys: tuple[str, ...]) -> str:
    for key in keys:
        values = query.get(key)
        if values and values[0].strip():
            return values[0].strip()
    return ""


def _path_item_id(path: str) -> str:
    segments = [segment for segment in path.split("/") if segment]
    if not segments:
        return ""
    tail = segments[-1]
    if tail.endswith(".html"):
        tail = tail[:-5]
    if re.fullmatch(r"[A-Za-z0-9_-]{4,80}", tail):
        return tail
    return ""


def _suggested_name(query: dict[str, list[str]], provider: LinkProvider | None, item_id: str) -> str:
    for key in ("title", "name", "keyword", "q"):
        value = _query_value(query, (key,))
        if value:
            return re.sub(r"\s+", " ", value).strip()[:160]
    if provider and item_id:
        return f"{provider.label} 商品 {item_id}"
    if provider:
        return f"{provider.label} 链接代购商品"
    return "外部链接代购商品"


def parse_purchase_link(source_url: str) -> dict[str, object]:
    parsed = urlparse(source_url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise exceptions.ValidationError({"source_url": ["仅支持 http/https 商品链接"]})
    if parsed.username or parsed.password:
        raise exceptions.ValidationError({"source_url": ["商品链接不能包含账号或密码"]})

    normalized_url = urlunparse((parsed.scheme, parsed.netloc.lower(), parsed.path or "/", "", parsed.query, ""))
    query = parse_qs(parsed.query, keep_blank_values=False)
    host = parsed.hostname or ""
    provider = _provider_for_host(host)
    item_id = _query_value(query, provider.id_query_keys) if provider else ""
    if not item_id:
        item_id = _path_item_id(parsed.path)

    provider_code = provider.code if provider else "UNKNOWN"
    provider_label = provider.label if provider else "未知平台"
    remark_parts = [f"provider={provider_code}"]
    if item_id:
        remark_parts.append(f"item_id={item_id}")
    remark_parts.append("未抓取真实第三方页面，价格和规格需人工确认")

    return {
        "source_url": source_url.strip(),
        "normalized_url": normalized_url,
        "provider": provider_code,
        "provider_label": provider_label,
        "external_item_id": item_id,
        "name": _suggested_name(query, provider, item_id),
        "quantity": 1,
        "unit_price": "0.00",
        "product_url": normalized_url,
        "remark": "；".join(remark_parts),
    }
