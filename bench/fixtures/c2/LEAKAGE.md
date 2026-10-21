# C2 template leakage

Part of the [C2 protocol](PROTOCOL.md), frozen with it (Frozen before the first
run).

A skill's template or wording can show in the output and tell the judge which
arm it is reading. Steps taken:
1. The judge sees only the final message and the files.
2. **Redaction**, the same for both arms of every pair: one whole-word,
   case-insensitive list replaced by `[redacted]` in every output. The list:
   "loadout", "skill" and "skills", the loadout context tags, and the names of
   all skills the hook selected in any run. Names that are file extensions or
   ordinary words (`pdf`, `xlsx`, `docx`, `review`) stay out of the list, and
   matches inside longer words are left ("skillet" stays). Redaction counts
   are reported per arm, since uneven counts would themselves unblind.
3. **Guess metric.** From the guess calls, for pairs with `small-loadout`, a
   guess is correct when it names the `small-loadout` output. Accuracy is
   correct / (correct + wrong) with a Wilson interval; `unsure` is left out and
   its rate is reported. Near 50% means no leakage is detected; clearly above
   means blindness failed, and the win rates carry that caveat. For
   `small-bare` vs `large-bare` no output had guidance, so every non-`unsure`
   guess is a false alarm: that rate is the baseline.
4. Not removed: a style a skill imposes (section order, checklists). A user
   would see it too, so it counts as part of the result, but it can reach the
   judge: a stated limit.
