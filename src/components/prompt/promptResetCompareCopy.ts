/** The words of the Reset and Compare pair on an editable prompt, and of the dialogs they open. */
export const RESET_COMPARE_COPY = {
  reset: {
    label: 'Reset',
    hint: 'Returns this text to the default of this release',
    /** The button's accessible name, and the confirm's title. */
    title: (name: string) => `Reset ${name}`,
    confirm: (name: string) => `Reset the ${name} to its default text? This can't be undone.`,
  },
  compare: {
    label: 'Compare',
    hint: 'Shows how this text differs from the default',
    name: (name: string) => `Compare ${name}`,
    title: (name: string) => `${name} vs. Default`,
    legend: { lead: 'Text you', mid: 'to the default is tinted. Text you', tail: 'from it is struck through.' },
  },
} as const;
