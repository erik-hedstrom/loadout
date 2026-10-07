# Merge report

This is a synthetic test run. All four notes in `samples/` were created for this task; no real vault was supplied. The merged page is `Home Office Setup.md`. The three source notes remain intact, and `samples/Weekly Review.md` is a backlink example excluded from the merge.

## What was merged

| Source | Content in the merged page |
| --- | --- |
| `samples/Desk Setup.md` | Layout and ergonomics; resources |
| `samples/Office Equipment.md` | Equipment and purchasing; resources |
| `samples/Office Routine.md` | Daily habits; weekly review |

All frontmatter values were retained. The new title is **Home Office Setup**, and the original titles are retained in `source_titles`. Tags, aliases, and related links were combined into unique lists. The shared budget remains `4500` SEK. The conflicting statuses are both preserved as a list: `planning` came from Desk Setup, and `researching` came from Office Equipment. This is a list property, not a newly inferred single project status. The supplier URL and Friday review day were retained. All three unique inline tags remain in the page.

## Exact duplicates removed

- “Keep the top of the monitor near eye level.” appeared in all three sources; retained once under Layout and ergonomics, removing two copies.
- The identical Workstation checklist Markdown link appeared in two sources; retained once under Resources, removing one copy.
- Repeated frontmatter values (`home-office`, `budget_sek: 4500`) and the repeated inline `#workspace` tag were collapsed without losing values.

The catalogue URL remains both a property and a body resource because these serve different uses. No unique task or information was removed.

## Links between the merged notes

These links were redirected in both prose and properties where present. Their display aliases were preserved:

| Original | Replacement |
| --- | --- |
| `[[Office Equipment#Shopping list\|equipment shortlist]]` | `[[Home Office Setup#Equipment and purchasing\|equipment shortlist]]` |
| `[[Desk Setup#Layout\|desk layout]]` | `[[Home Office Setup#Layout and ergonomics\|desk layout]]` |

All other wikilink targets and aliases, Markdown links, and URLs were preserved verbatim.

## Backlinks to update

The only sample note outside the merge scope linking to the originals is `samples/Weekly Review.md`. It was left untouched. Suggested changes:

| Existing link | Suggested replacement |
| --- | --- |
| `[[Desk Setup#Layout\|workspace layout]]` | `[[Home Office Setup#Layout and ergonomics\|workspace layout]]` |
| `[[Office Equipment\|office purchases]]` | `[[Home Office Setup#Equipment and purchasing\|office purchases]]` |
| `[[Office Routine#Daily habits\|daily reset]]` | `[[Home Office Setup#Daily habits\|daily reset]]` |
| `[desk measurements](Desk%20Setup.md#Layout)` | `[desk measurements](../Home%20Office%20Setup.md#Layout%20and%20ergonomics)` |

The source notes also link to each other; these remain in the untouched originals and are redirected in the merged page. No actual vault backlinks could be audited because no vault was supplied. The merged page does not use the original filenames as aliases, avoiding ambiguity while those original files still exist.

## Uncertain links and verification

- `[[Personal Knowledge Index|My index]]` and `[[Buying Guide#Furniture|furniture criteria]]` have no targets in this sample folder. They were preserved; resolution in a real vault is unknown.
- `[[Weekly Review|weekly review]]` resolves to the provided sample note when this folder is opened as an Obsidian vault.
- External URLs were preserved without checking their availability or content.
- Obsidian reading-view rendering was not tested because no running Obsidian vault was available. File-level checks cover property values, exact link preservation, redirected headings, unique information, and unchanged sample originals.
