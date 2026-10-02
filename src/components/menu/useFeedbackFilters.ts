import { useState } from "react";

/** A tab's filter values, keyed by filter. Search is not one of them: Reset leaves it alone. */
export type FeedbackFilterValues = Record<string, string>;

/**
 * A feedback tab's search and filters, measured against the tab's defaults.
 *
 * @param defaults - What each filter opens on and what Reset returns it to
 * @param hidden - The filters that sit behind the Filters button, which the badge counts
 * @param onChange - Called after any change, so the list can return to page 1
 */
export function useFeedbackFilters<F extends FeedbackFilterValues>(
  defaults: F,
  hidden: readonly (keyof F)[],
  onChange: () => void,
) {
  const [values, setValues] = useState<F>(defaults);
  const [search, setSearchText] = useState('');

  const set = <K extends keyof F>(key: K) => (value: F[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    onChange();
  };

  const setSearch = (text: string) => {
    setSearchText(text);
    onChange();
  };

  const differs = (key: keyof F) => values[key] !== defaults[key];
  const hiddenChanged = hidden.filter(differs).length;
  const anyChanged = Object.keys(defaults).some(differs);

  const reset = () => {
    setValues(defaults);
    onChange();
  };

  return { values, set, search, setSearch, hiddenChanged, anyChanged, reset };
}

export type FeedbackFilters<F extends FeedbackFilterValues> = ReturnType<typeof useFeedbackFilters<F>>;
