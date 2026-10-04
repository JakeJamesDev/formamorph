// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { coverShieldedLayer, ensureShieldedLayer, ignoreLayerPress, inShieldedLayer, keepLayerFocus } from './shielded-layer';

/** Dispatches a bubbling event on `target` and reports whether a `document` listener saw it. */
function reachesDocument(target: Element, event: Event): boolean {
  const seen = vi.fn();
  document.addEventListener(event.type, seen);
  target.dispatchEvent(event);
  document.removeEventListener(event.type, seen);
  return seen.mock.calls.length > 0;
}

function childOfLayer(): HTMLButtonElement {
  const button = document.createElement('button');
  ensureShieldedLayer().append(button);
  return button;
}

function childOfPage(): HTMLButtonElement {
  const button = document.createElement('button');
  document.body.append(button);
  return button;
}

describe('the shielded layer', () => {
  it('makes one host on the body and returns the same mount each time', () => {
    const mount = ensureShieldedLayer();
    expect(ensureShieldedLayer()).toBe(mount);
    expect(mount.parentElement?.parentElement).toBe(document.body);
    expect(document.querySelectorAll('[data-shielded-layer]')).toHaveLength(1);
  });

  it('paints above dialogs and under the chip typeahead and tooltips', () => {
    const host = ensureShieldedLayer().parentElement!;
    expect(Number(host.style.zIndex)).toBeGreaterThan(50);
    expect(Number(host.style.zIndex)).toBeLessThan(70);
  });

  it('sinks under dialogs and goes inert while a dialog covers it, and rises again after the dialog exits', () => {
    const mount = ensureShieldedLayer();
    const host = mount.parentElement!;
    coverShieldedLayer(true);
    expect(Number(host.style.zIndex)).toBeLessThan(50);
    expect(mount.inert).toBe(true);
    expect(host.style.transition).toBe('none');

    coverShieldedLayer(false);
    expect(Number(host.style.zIndex)).toBeGreaterThan(50);
    expect(mount.inert).toBe(false);
    // The rise waits for the closing dialog's exit animation.
    expect(host.style.transition).toBe('z-index 0s linear 200ms');
  });

  it('carries aria-live, which keeps a modal dialog from hiding it', () => {
    expect(ensureShieldedLayer().parentElement).toHaveAttribute('aria-live', 'off');
  });

  it('returns to the body when a test or a page wipes it', () => {
    const mount = ensureShieldedLayer();
    mount.parentElement!.remove();
    expect(ensureShieldedLayer()).toBe(mount);
    expect(mount.isConnected).toBe(true);
  });

  it.each(['focusin', 'wheel', 'touchmove'])('stops %s from inside the layer before the document', (type) => {
    expect(reachesDocument(childOfLayer(), new Event(type, { bubbles: true }))).toBe(false);
    expect(reachesDocument(childOfPage(), new Event(type, { bubbles: true }))).toBe(true);
  });

  it('lets a press inside the layer reach the document, where popovers and menus dismiss', () => {
    expect(reachesDocument(childOfLayer(), new Event('pointerdown', { bubbles: true }))).toBe(true);
  });

  it('stops a focusout that moves focus into the layer, and no other', () => {
    const inside = childOfLayer();
    const outside = childOfPage();
    const other = childOfPage();
    expect(reachesDocument(outside, new FocusEvent('focusout', { bubbles: true, relatedTarget: inside }))).toBe(false);
    expect(reachesDocument(outside, new FocusEvent('focusout', { bubbles: true, relatedTarget: other }))).toBe(true);
    expect(reachesDocument(outside, new FocusEvent('focusout', { bubbles: true, relatedTarget: null }))).toBe(true);
  });

  it('prevents a dialog close for a press in the layer, and passes every other press to the caller', () => {
    const caller = vi.fn();
    const guard = ignoreLayerPress(caller);
    const inside = new Event('pointerdown', { bubbles: true, cancelable: true });
    const layerButton = childOfLayer();
    layerButton.addEventListener('pointerdown', guard);
    layerButton.dispatchEvent(inside);
    expect(inside.defaultPrevented).toBe(true);
    expect(caller).not.toHaveBeenCalled();

    const outside = new Event('pointerdown', { bubbles: true, cancelable: true });
    const pageButton = childOfPage();
    pageButton.addEventListener('pointerdown', guard);
    pageButton.dispatchEvent(outside);
    expect(outside.defaultPrevented).toBe(false);
    expect(caller).toHaveBeenCalledWith(outside);
  });

  it('returns focus to the layer after a caller moves it on close', () => {
    const inside = childOfLayer();
    const opener = childOfPage();
    inside.focus();
    const event = new Event('closeAutoFocus', { cancelable: true });
    keepLayerFocus(() => opener.focus())(event);
    expect(document.activeElement).toBe(inside);
    expect(event.defaultPrevented).toBe(true);
  });

  it('lets a closing dialog return focus when focus is not in the layer', () => {
    const opener = childOfPage();
    childOfPage().focus();
    const event = new Event('closeAutoFocus', { cancelable: true });
    keepLayerFocus(() => opener.focus())(event);
    expect(document.activeElement).toBe(opener);
    expect(event.defaultPrevented).toBe(false);
  });

  it('knows which nodes are in the layer', () => {
    expect(inShieldedLayer(childOfLayer())).toBe(true);
    expect(inShieldedLayer(childOfPage())).toBe(false);
    expect(inShieldedLayer(null)).toBe(false);
    expect(inShieldedLayer(document)).toBe(false);
  });
});
