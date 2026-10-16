# Spec: Code Rider Widening

Status: done
Status note: Closed on 2026-10-16. Tickets 01–04 landed; the last landing is 302a38499. Closed without gates.
Spec session: code-rider-widening — spec

## Problem Statement

The help window writes scripts only for a stat's Before the AI and After the AI boxes. An author who asks for an At Game Start script, a During AI Output script or a When a Trait Switches script gets an answer the app cannot place. An author on a trait's Scripts tab or the world's Scripts section gets no Code rider and no Insert, so the answer is text to copy by hand. The help code test already runs every timing in every home, so the gap is in the rider and the Insert path only.

## Solution

The Code rider asks for any of the five timings. A trait's Scripts tab and the world's Scripts section count as code surfaces, like a stat's Code tab. When a script home is open, the app adds one line that names the home and what its scripts read. Insert writes the answer as a new script into the open home, in the timing its fence names. With no home open, a code turn still gets the rider, but no home line and no Insert.

## Rulings

Settled with the user on 2026-10-16, from the Out of Scope list of the Scripts Leftovers spec.

| # | Ruling |
|---|---|
| Q1 | The rider covers all five timings: Before the AI, After the AI, During AI Output, At Game Start, When a Trait Switches |
| Q2 | Rider and Insert cover three homes: a stat, a trait, the world |
| Q3 | The editable rider in the help preset stays generic. The app adds one built-in line for the open home, naming the home and its reads, as the code-test line rides today |
| Q4 | Insert shows only while a script home's panel is open: a stat's Code tab, a trait's Scripts tab, the world's Scripts section. It writes a new script into that home |
| Q5 | The fence names the timing only. Five tags: `before`, `after`, `output`, `start`, `switch`. The open panel decides the home |
| Q6 | A trait's Scripts tab and the world's Scripts section are code surfaces. The three new timing labels are code words, matched as whole phrases |
| Q7 | A code turn with no home open sends the generic rider with no home line. The answer has no Insert |
| Q8 | With no owner named, the help code test falls back to the open home (stat, trait or world), not only the open stat. This widens Scripts Leftovers Q10's fallback |
| Q9 | The help code probe gains cases for the three new timings and for trait and world homes. Existing cases do not regress; new cases meet the existing pass bar |
| Q10 | The generic reads line keeps `self` in home-neutral words (the script's home), so a code turn with no home open still writes through `self`. Each home line says what `self` is in that home. Spec-session ruling for ticket 02 |
| Q11 | When lines ride together, the order is: rider, home line, code-test line. The test instruction stays last. Spec-session ruling for ticket 02 |

## User Stories

1. As an author, I want the help window to write an At Game Start script, so that I can set up values when a game begins.
2. As an author, I want the help window to write a During AI Output script, so that I can react to narration as it streams.
3. As an author, I want the help window to write a When a Trait Switches script, so that I can respond to a trait turning on or off.
4. As an author, I want the answer to name the box it fills, so that I know where the script goes.
5. As an author on a trait's Scripts tab, I want the help window to treat my question as a code question, so that I get a script without code words.
6. As an author on the world's Scripts section, I want the same, so that world scripts are as easy to get as stat scripts.
7. As an author on a trait's Scripts tab, I want the answer to read the trait the way a trait script does, so that the script works when I insert it.
8. As an author on the world's Scripts section, I want the answer not to read `owner`, so that the script does not throw.
9. As an author, I want Insert to put the script into the trait or world I have open, so that I do not copy and paste.
10. As an author, I want Insert to create the script in the timing the answer names, so that it runs at the right moment.
11. As an author, I want Insert to land on the new script, so that I can see and edit it at once.
12. As an author, I want Insert to add a new script and keep my existing ones, so that I lose nothing.
13. As an author who asks with code words from another screen, I want a script answer with no Insert, so that the app never writes to a home I did not open.
14. As an author, I want "At Game Start" in my question to count as a code question, so that the rider rides.
15. As an author, I want the help code test to run against the trait or world I have open, so that its result matches what Insert will write.
16. As a preset author, I want my edited Code rider to keep working, so that the home line does not depend on my text.
17. As a preset author, I want an empty Code rider to still get the home line, so that clearing the rider does not break Insert targeting.
18. As a player using a small model, I want the rider to stay short, so that the model follows it.
19. As a contributor, I want probe numbers for the new timings and homes, so that the rider change is measured, not judged by one answer.

## Implementation Decisions

- **Timings.** The rider and the fence parser read the five script timings, not the two stat-code timings. Labels come from the shared timing label list, so a rename stays in one place.
- **Default rider.** The Default preset's rider names five boxes and five fence lines, and says when each box runs. Names alone sent time checks to At Game Start in ticket 02's probe. Its reads line keeps the reads every home shares and drops `owner.stats`, which the home line now carries. The rider stays positive and gives no example values.
- **Home line.** A pure function takes the open surface and returns the line for that home, or nothing. Stat: `self` is the stat, `owner.stats` reads its entity. Trait: the line names the trait scope reads. World: the line says a world script has no owner. It rides after the rider through the same line-append helper the code-test line uses, and still rides when the rider is empty.
- **Code turn.** The code-surface check widens from the stat's Code tab to the three home surfaces in the surface registry. The new timing labels join the code words as whole-phrase matches.
- **Insert target.** The insert target generalizes from "the open stat" to "the open script home". It carries the home's display name for the Insert menu header and an insert function that takes any of the five timings. The stat panel, the trait's Scripts tab and the world's Scripts section each register while visible. One target at a time, as today.
- **Insert write.** Each home writes a new script with the fenced timing and code, switches to the tab or section that shows it, and lands on it, as the stat panel does today. A fence with no timing tag offers the five timings in the Insert menu.
- **Code test fallback.** With no owner named, the test's owner comes from the open home: the stat, the trait or the world.
- **Naming.** Insert module names move from stat code to script, per Scripts Leftovers Q6. Player-facing strings say Script.
- **No export-shape change.** The help preset file keeps one rider text. No world or save field changes.

## Testing Decisions

A good test drives the public seam and checks what the author or the request sees: the request text, the button, the written script. It never asserts on internals. Each new guard must fail when its case returns to today's code.

- **Help session code-rider test.** Rider text names five timings; the home line for each home; no home line off a home; the home line rides with an empty rider; the trait and world surfaces and the new timing phrases trigger a code turn.
- **Insert unit test.** The fence parser reads all five tags, in the fence and on a first line.
- **Help window code-insert test.** Insert shows with any home target, heads the menu with the home's name, and stays hidden with no target.
- **World Editor code-insert view test.** The highest seam for Insert. Adds a trait case and a world case beside the stat case: the new script lands in the right home and timing, and the panel lands on it.
- **Help session code-test file.** The fallback owner follows the open trait and the open world.
- **Help code probe.** New cases per Q9, on the cloud default endpoint with in-batch controls, per the probe skill.

## Out of Scope

- Tool scripts and the Tool editor.
- An Insert with no home open, or a home picker (Q4, Q7).
- One answer that targets several homes (Q5).
- Any change to which scripts run, or when.
- Simple mode: the stat panel registers Insert in advanced mode only, and that stays.

## Further Notes

- Every rider change is a prompt change. Read the prompt writing guide first, and ship probe numbers with the change.
- Ticket 02's cloud probe (8 runs): known cases pass 55% for both the old and the new rider; timing cases 97%. The known cases miss the 80% bar on cloud with either rider, so for tickets 03 and 04 "no regression" means no drop from the old rider in the same batch. A trait or world home line that names its reads by when they apply follows the same lesson.
