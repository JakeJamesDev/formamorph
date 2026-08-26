# ✍️ Text Formatting

Everywhere Formamorph shows you formatted prose — world descriptions, readmes, community comments, feedback threads, the story's own narration — it reads the same Markdown. This page is the full list of what works.

> Formatting is written in the text itself. In the World Editor's prose fields a **toolbar** sits above the box and applies most of this to your selection, so you rarely have to type the punctuation by hand.

---

## Emphasis

| You write | You get |
|---|---|
| `*italic*` or `_italic_` | *italic* |
| `**bold**` | **bold** |
| `***both***` | ***both*** |
| `~~struck~~` | ~~struck~~ |
| `` `inline code` `` | `inline code` |

## Highlighting

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

The closing marker is always a plain `==`, whether or not you used a key. A letter that isn't in the table falls back to the plain themed highlight rather than breaking.

You don't have to type any of it. The **highlighter button** in the toolbar has a chevron beside it that opens all ten colors, each shown as its own swatch, and the button then remembers whichever you picked last. Pressing a color on text that already carries a different one recolors it in place; pressing the color it already has takes the highlight off.

> [!NOTE]
> The content can't start or end with a space — `==loose plank==` highlights, `== loose plank ==` doesn't. An empty `====` renders as nothing at all.

> [!WARNING]
> Two `==` comparisons close together in ordinary prose can be read as one highlight: `a==b and c==d` highlights *b and c*. Put spaces around your operators (`a == b`) or wrap them in `` ` `` inline code, where formatting never applies.

## Superscript and Subscript

| You write | You get |
|---|---|
| `H~2~O` | H<sub>2</sub>O |
| `x^2^` | x<sup>2</sup> |

Neither may contain a space — that's what stops a stray `~` in ordinary prose ("~5 minutes") from swallowing the rest of the line.

## Headings, Lists and Blocks

| You write | You get |
|---|---|
| `# Heading` … `###### Heading` | Six heading levels |
| `- item` | A bullet list |
| `1. item` | A numbered list |
| `- [ ] item` / `- [x] item` | A task list with checkboxes |
| `> quoted` | A blockquote |
| `---` | A horizontal rule |

## Links, Images and Tables

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

Fence a block with three backticks and name the language to get syntax coloring in the app's own palette:

````
```js
const greeting = 'hello';
```
````

Formatting is never applied inside code — an inline span or a fenced block shows exactly what you typed, `==` and `~` included.

## Line Breaks

A single newline is a line break. You don't need two spaces at the end of a line, and you don't need a blank line between every line of a stanza or an address.
