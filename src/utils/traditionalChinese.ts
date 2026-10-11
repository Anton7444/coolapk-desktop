import * as OpenCC from 'opencc-js/cn2t';

// 簡體 → 繁體（台灣用語），覆蓋靜態介面、文章、評論等所有 DOM 文字。
const convert = OpenCC.Converter({ from: 'cn', to: 'twp' });
const HAN_RE = /[㐀-鿿]/;
const ATTRS = ['placeholder', 'title', 'alt', 'aria-label'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'NOSCRIPT', 'CODE', 'PRE']);

const originalText = new WeakMap<Node, string>();
const originalAttrs = new WeakMap<Element, Map<string, string>>();
let observer: MutationObserver | null = null;
let applying = false;
let originalLang = '';

export function toTraditional(text: string): string {
  return text && HAN_RE.test(text) ? convert(text) : text;
}

function shouldSkip(el: Element | null, checkTag = true): boolean {
  for (let cur = el; cur; cur = cur.parentElement) {
    if (checkTag && SKIP_TAGS.has(cur.tagName)) return true;
    if (cur instanceof HTMLElement && (cur.isContentEditable || cur.dataset.noS2t !== undefined)) return true;
  }
  return false;
}

function convertTextNode(node: Node) {
  const value = node.nodeValue;
  if (!value || !HAN_RE.test(value) || shouldSkip(node.parentElement)) return;
  const next = convert(value);
  if (next === value) return;
  if (!originalText.has(node)) originalText.set(node, value);
  node.nodeValue = next;
}

function convertAttrs(el: Element, names: readonly string[] = ATTRS) {
  // 屬性（placeholder 等）可轉換，輸入框本身的值不屬於屬性，不受影響。
  if (shouldSkip(el, false)) return;
  for (const name of names) {
    const value = el.getAttribute(name);
    if (!value || !HAN_RE.test(value)) continue;
    const next = convert(value);
    if (next === value) continue;
    let saved = originalAttrs.get(el);
    if (!saved) originalAttrs.set(el, (saved = new Map()));
    if (!saved.has(name)) saved.set(name, value);
    el.setAttribute(name, next);
  }
}

function convertTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return convertTextNode(root);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  if (root instanceof Element) convertAttrs(root);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) convertTextNode(n);
    else convertAttrs(n as Element);
  }
}

function restoreTree(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let n: Node | null = walker.currentNode; n; n = walker.nextNode()) {
    const text = originalText.get(n);
    if (text !== undefined) n.nodeValue = text;
    if (n.nodeType === Node.ELEMENT_NODE) {
      originalAttrs.get(n as Element)?.forEach((v, k) => (n as Element).setAttribute(k, v));
    }
  }
}

function convertTitle() {
  const next = toTraditional(document.title);
  if (next !== document.title) document.title = next;
}

export function setAutoTraditional(enabled: boolean) {
  if (typeof document === 'undefined') return;
  if (enabled === Boolean(observer)) return;
  applying = true;
  try {
    if (enabled) {
      originalLang = document.documentElement.lang;
      document.documentElement.lang = 'zh-TW';
      convertTree(document.body);
      convertTitle();
      observer = new MutationObserver((records) => {
        if (applying) return;
        applying = true;
        try {
          for (const r of records) {
            if (r.type === 'characterData') convertTextNode(r.target);
            else if (r.type === 'attributes') convertAttrs(r.target as Element, [r.attributeName!]);
            else r.addedNodes.forEach(convertTree);
          }
        } finally {
          // 自己造成的變更會在微任務中投遞，丟棄後再放行。
          observer?.takeRecords();
          applying = false;
        }
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
      new MutationObserver(() => { if (observer) convertTitle(); }).observe(document.head, { childList: true, subtree: true, characterData: true });
    } else {
      observer?.disconnect();
      observer = null;
      document.documentElement.lang = originalLang || 'zh-CN';
      restoreTree(document.body);
    }
  } finally {
    applying = false;
  }
}
