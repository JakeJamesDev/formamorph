# ✍️ Text Formatting
<!-- keywords: rich text, styling, markup syntax, fancy text, special symbols, works in comments -->

Everywhere Formamorph shows you formatted prose — world descriptions, readmes, community comments, feedback threads, the story's own narration — it reads the same Markdown. This page is the full list of what works.

> Formatting is written in the text itself. In the World Editor's prose fields a **toolbar** sits above the box and applies most of this to your selection, so you rarely have to type the punctuation by hand.

## How to Format Text with the Toolbar
<!-- keywords: bold, italic, markdown, heading, list, style, link, table, wysiwyg, underline, buttons above the box, ribbon, formatting bar, click to style, without typing symbols, insert menu -->

1. Select the text in a World Editor prose field.
2. Select a toolbar button: **Bold**, **Italic**, **Strikethrough**, **Inline code** or **Blockquote**.
3. For more, open a split button's chevron: **Heading level**, **List type** or **Insert**. **Insert** has **Link**, **Image**, **Table**, **Code block**, **Horizontal rule**, **Subscript** and **Superscript**.

A split button's face then applies the last item you picked from it.

## How to Highlight Text
<!-- keywords: color, mark, marker, background, colour, yellow, make words stand out, tint, paint over words, neon, undo it, colored words -->

1. Select the text.
2. Select the highlighter button for the plain highlight, in your theme's color.
3. For a color, open the chevron beside it, **Highlight color**, and pick one.

Pick the same color again on highlighted text to take the highlight off. Pick another color to recolor it.

---

## Emphasis
<!-- keywords: asterisks, underscores, strikethrough, cross out, tildes, slanted, typewriter font, backtick, stars around words -->

| You write | You get |
|---|---|
| `*italic*` or `_italic_` | *italic* |
| `**bold**` | **bold** |
| `***both***` | ***both*** |
| `~~struck~~` | ~~struck~~ |
| `` `inline code` `` | `inline code` |

## Highlighting
<!-- keywords: colour codes, letter codes, typed by hand, accidental coloring, double equals shows, colored text syntax, rainbow, spaces break it -->

Wrap text in double equals signs to highlight it, exactly as in Obsidian:

```
Mind the ==loose plank== on the third step.
```

The plain highlight takes its color from **your active theme**, so a highlight looks at home whether you're on Purple, Forest, Bubble Gum or any of the rest — in light mode or dark.

### Color Keys

Put a single letter between the first pair of equals signs to pick a color instead. The letter is the color's own initial:

| Key | Color | You write |
|---|---|---|
| `r` | Red | `=r=danger==` |
| `o` | Orange | `=o=caution==` |
| `y` | Yellow | `=y=note==` |
| `g` | Green | `=g=safe==` |
| `c` | Cyan | `=c=cool==` |
| `b` | Blue | `=b=calm==` |
| `p` | Purple | `=p=arcane==` |
| `q` | Pink | `=q=sweet==` |
| `x` | Gray | `=x=muted==` |

The closing marker is always a plain `==`, whether or not you used a key. Any other letter shows the plain themed highlight.

You don't have to type any of it. The highlighter button's chevron, **Highlight color**, lists ten highlighters: the plain **Highlight** and the nine colors above, each with its own swatch. The button then applies the last one you picked, while the field stays open. A color on text that already has a different one recolors it in place. The color it already has takes the highlight off.

> [!NOTE]
> The content can't start or end with a space — `==loose plank==` highlights, `== loose plank ==` doesn't. An empty `====` renders as nothing at all.

> [!WARNING]
> Two `==` comparisons close together in ordinary prose can be read as one highlight: `a==b and c==d` highlights *b and c*. Put spaces around your operators (`a == b`) or wrap them in `` ` `` inline code, where formatting never applies.

## Superscript and Subscript
<!-- keywords: exponent, raised small text, lowered small text, caret, tilde, chemical formula, squared, footnote marker -->

| You write | You get |
|---|---|
| `H~2~O` | H<sub>2</sub>O |
| `x^2^` | x<sup>2</sup> |

Neither may contain a space — that's what stops a stray `~` in ordinary prose ("~5 minutes") from swallowing the rest of the line.

## Headings, Lists and Blocks
<!-- keywords: hash sign title, pound sign, todo checklist, divider, separator line, dashes, section titles, quote someone, big text, bullet points -->

| You write | You get |
|---|---|
| `# Heading` … `###### Heading` | Six heading levels |
| `- item` | A bullet list |
| `1. item` | A numbered list |
| `- [ ] item` / `- [x] item` | A task list with checkboxes |
| `> quoted` | A blockquote |
| `---` | A horizontal rule |

## Links, Images and Tables
<!-- keywords: hyperlink, clickable, embed a picture, grid, rows, show a photo, vertical bars -->

| You write | You get |
|---|---|
| `[text](https://example.com)` | A link |
| `![alt](https://example.com/art.png)` | An image |
| `https://example.com` | An automatic link |

Tables use the usual pipe syntax:

```
| Column | Column |
| --- | --- |
| Cell | Cell |
```

## Code Blocks
<!-- keywords: monospace, preformatted, escape symbols, literal text, verbatim, snippet, show raw markup, triple tick -->

Fence a block with three backticks and name the language to get syntax coloring in the app's own palette:

````
```js
const greeting = 'hello';
```
````

Formatting is never applied inside code — an inline span or a fenced block shows exactly what you typed, `==` and `~` included.

## Line Breaks
<!-- keywords: enter key, paragraph spacing, poem, verse, lines run together, carriage return, shift enter, lyrics layout -->

A single newline is a line break. You don't need two spaces at the end of a line, and you don't need a blank line between every line of a stanza or an address.
