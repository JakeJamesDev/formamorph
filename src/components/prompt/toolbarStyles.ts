/** The look of a button in a field's chrome row — borderless and tight, so a row of them reads as one
 *  toolbar rather than a line of separate controls. Shared so buttons contributed from outside the field
 *  (an AI generate button, say) can't drift from the ones inside it. */
export const TOOLBAR_BTN = 'rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50';
