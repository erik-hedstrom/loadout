# Merge report

This is a test run using fictional sample data, not a merge of an existing vault.

Merged **Home Office Ideas.md**, **Desk Measurements.md**, and **Cable Plan.md** into **Home Office Setup Plan.md**, grouped by goals, measurements, layout, cable routing, shopping, inspiration, and budget. All three original files remain unchanged. **Weekly Review.md** is an unchanged sample surrounding-vault note used to demonstrate backlink discovery.

## Duplicates and properties

Removed one repeated copy each of:

- “Measure the wall and the desk before ordering anything.”
- “Route monitor and charging cables along the rear edge.”
- “Save receipts in [[Household Budget#Receipts|receipt log]].”
- The inline tag `#home/office`.

Merged aliases and frontmatter tags into unions; stored the identical `budget_currency: SEK` once. Retained `measured_on` and `owner`. Preserved all three differing `status` values as a list, with their source associations in `source_status`. This changes `status` from a scalar to a list; queries expecting a scalar may need adjustment. No unique content was discarded. The two differently labeled IKEA references remain, despite sharing a URL.

## Links and backlinks

Converted four links between the merged inputs to `[[Home Office Setup Plan#Heading|original alias]]`, preserving their display aliases. All other wikilink targets, aliases, the image embed, Markdown links, and URLs remain intact.

Only **Weekly Review.md** links to the originals outside the merge inputs in this sample folder. Suggested replacements (not applied):

| Existing link | Replacement |
| --- | --- |
| `[[Home Office Ideas\|office refresh]]` | `[[Home Office Setup Plan#Goals\|office refresh]]` |
| `[[Desk Measurements#Measurements\|desk sizes]]` | `[[Home Office Setup Plan#Measurements\|desk sizes]]` |
| `[the cable shopping list](Cable%20Plan.md#Shopping)` | `[the cable shopping list](Home%20Office%20Setup%20Plan.md#Shopping)` |

Existing links continue resolving to the untouched originals until you update them. No actual vault was available to scan.

## Uncertain links

- `[[Household Budget#Receipts|receipt log]]`, `[[Household Budget]]`, `[[Room Layout|room sketch]]`, `[[Office Inspiration]]`, and `![[Desk sketch.png]]` have no matching target in this sample folder. They were retained; their existence in a real vault is unknown.
- `https://example.com/office/cable-trays` is a deliberately fictional placeholder retained from the sample input.
- `https://www.ikea.com/` was preserved in both forms; its availability and suitability as a workspace reference were not checked online.

## Verification

A Python 3 preservation check compared input hashes, unique body lines, external links, tags, frontmatter values, rewritten internal heading links, and the surrounding-note backlinks. See the completion message for the command and result.
