import { afterEach, describe, expect, it } from 'vitest';
import { setAutoTraditional, toTraditional } from '../traditionalChinese';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('traditionalChinese', () => {
  afterEach(() => { setAutoTraditional(false); document.body.innerHTML = ''; });

  it('转换文本', () => {
    expect(toTraditional('设置 评论 软件')).toBe('設定 評論 軟體');
    expect(toTraditional('abc')).toBe('abc');
  });

  it('转换已有与新增 DOM，跳过输入框，关闭后还原', async () => {
    document.body.innerHTML = '<p id="a">设置</p><textarea id="t">设置</textarea><input id="i" placeholder="评论">';
    setAutoTraditional(true);
    expect(document.getElementById('a')!.textContent).toBe('設定');
    expect(document.getElementById('t')!.textContent).toBe('设置');
    expect(document.getElementById('i')!.getAttribute('placeholder')).toBe("評論");
    const el = document.createElement('div');
    el.innerHTML = '<span>评论</span>';
    document.body.appendChild(el);
    await tick();
    expect(el.textContent).toBe('評論');
    setAutoTraditional(false);
    expect(document.getElementById('a')!.textContent).toBe('设置');
    expect(el.textContent).toBe('评论');
  });
});
