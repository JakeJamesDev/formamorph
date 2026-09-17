import { useEffect } from 'react';
import { mergeRegister } from '@lexical/utils';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { layoutOpenValues } from './openValueLayout';

/**
 * Keeps the Values tab's outlines and headers in place. Runs after every update, after decorators render,
 * when the editor or the window resizes, and when any header resizes.
 */
export function OpenValueLayoutPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    let pending = 0;
    const observer = new ResizeObserver(() => run());
    function run() {
      const root = editor.getRootElement();
      if (!root) return;
      for (const header of layoutOpenValues(root)) observer.observe(header);
    }
    // A chip's decorator renders after the update listeners, so the pass runs again once it has.
    const runSoon = () => {
      run();
      window.clearTimeout(pending);
      pending = window.setTimeout(run, 0);
    };
    window.addEventListener('resize', run);
    return mergeRegister(
      editor.registerUpdateListener(runSoon),
      editor.registerDecoratorListener(runSoon),
      editor.registerRootListener((next) => {
        observer.disconnect();
        if (next) observer.observe(next);
        runSoon();
      }),
      () => {
        window.removeEventListener('resize', run);
        window.clearTimeout(pending);
        observer.disconnect();
      },
    );
  }, [editor]);
  return null;
}
