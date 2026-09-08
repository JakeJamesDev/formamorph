# Footer Action Order Review

Reviewed September 8, 2026 against the paired-action decision in the Design Standards Additions specification and the repository [Writing Guide](../../../docs/Writing-Guide.md).

## Existing Alignment Follow-Up

The shared `DialogFooter` and `AlertDialogFooter` use `flex-col-reverse sm:flex-row`. With negative-first DOM order, this renders the affirmative action above the negative action when stacked and negative-left/affirmative-right when horizontal. The isolated constrained-width example adds `sm:flex-wrap-reverse` locally so a long action label uses the same visible order if the row wraps. The following production footers override the shared stack with `flex-col` and need a focused alignment pass:

| Surface | Current actions | Follow-up |
| --- | --- | --- |
| `CommunityCreationsBrowser.tsx` | Cancel / Download a copy / Overwrite or Update | Define the mobile order for the two affirmative alternatives, then preserve Cancel as the negative action. |
| `CommunityCreationsBrowser.tsx` | Cancel / Update or Overwrite | Restore the shared paired-action adaptation. |
| `ImageTagsField.tsx` | Cancel / Replace | Restore the shared paired-action adaptation. |
| `ChangelogEntryDialog.tsx` | Cancel / Add Entry or Save Entry | Restore the shared paired-action adaptation. |
| `GenerateImageButton.tsx` | Cancel / Generate or Stop / Use image | Define the mobile order for the intermediate action, then preserve Cancel and Use image as the pair. |
| `PublishModal.tsx` | Cancel / Publish | Restore the shared paired-action adaptation. |

`AuthModals.tsx` also overrides the shared stack, but its first action switches modes instead of canceling the operation. Review its action hierarchy separately before treating it as a paired negative/affirmative footer. Deliberate horizontal footers such as `EditTextModal` are not violations when their actions fit at the supported widths; they still need overflow checks before reuse with longer labels or enlarged text.

The group-picker footers are owned by design-system-additions ticket 01. They were reviewed with that in-flight ticket rather than changed here.

## Live Verification

The development-only Design System route was checked at a 1280px desktop viewport and a 390 × 844 phone viewport with the Graphite palette and system font. Static frames confirmed Cancel left/Create Group right at desktop width and Create Group above Cancel at phone width. The destructive example kept the destructive fill above Cancel on the phone. Light and dark themes both preserved readable borders, text, focus, disabled, and destructive treatments.

The constrained long-label example rendered Download and Embed — Works Offline above Cancel without widening the page. At 1280px, the affirmative button occupied `x=579–871` on the upper line and Cancel occupied `x=794–871` on the lower line; body width and scroll width both remained 1280px. At 390px, both buttons occupied `x=77–365`, with the affirmative action at `y=418–458` and Cancel at `y=466–506`; body width and scroll width both remained 390px. The static frames are temporary task evidence and are not linked from this tracked review.

The input received opening focus, and Tab moved to Cancel before Create Group. Increased browser zoom kept the long description, input, and both stacked actions visible and reachable. Automated component tests confirmed that Cancel and Escape keep local state unchanged, keyboard activation changes only the selected local sample, and every close path returns focus to a valid opener.

Hot reload from concurrent showcase work reset the active reference between some frames. The isolated interaction tests separately verify focus return after creation and local state changes without relying on a timed animation or a persistent preview session.

## Writing Review

Source key: `FooterActionOrderReference`. Surface: development-only Design System reference. Role: headings, reference descriptions, dialog copy, controls, and local status. The registry also renders `Footer Actions` and `Negative and affirmative dialog actions` as its label and description. Dynamic cases interpolate the authored sample Group name and the entered Group name; those values keep the author's voice.

The review used ASD-STE100 Issue 9, dated January 15, 2025, as cited by the Writing Guide and checked September 7, 2026. Relevant dictionary evidence recorded by the guide is `A` (page 2-1-A1, PDF 149), `ERASE` (page 2-1-E8, PDF 234), and `THE` (page 2-1-T3, PDF 401). `A` and `THE` support their ordinary article uses in the new sentences. The established Delete label is intentionally preserved for production parity even though `ERASE` is the recorded approved word for data removal; changing app-wide terminology is outside this ticket.

`Formamorph` is a named product; `Group` is an application entity; and `dialog` is an interface term. They are admitted as category 19 technical names because replacing them would make the reference less precise. Admission remains unverified for `footer`, `local`, and `sample`, and dictionary evidence remains unverified for the established action terms Cancel, Create, Download, and Embed. The new copy has no safety procedure, warning, or meaning-changing rewrite. Sections 1–6, 8, and 9 were reviewed; section 7 is not applicable.

Verdict: **reviewed against listed evidence**. Standalone label grammar, the named vocabulary gaps above, and reused production copy remain unverified; this review does not certify complete ASD-STE100 compliance.

## Reference Copy Review

| Copy | Role | Review |
| --- | --- | --- |
| Footer Actions; Footer Action Order; Ordinary Acceptance; Destructive Confirmation; Long Action Labels; Create Group; Delete Local Sample?; Export World; Group Name | Standalone labels and dialog titles | Title Case and local terminology are consistent. Standalone label-fragment grammar remains unverified. |
| Negative and affirmative dialog actions | Registry description | Concise selector text. Its standalone-fragment grammar remains unverified. |
| Open Create Group Example; Open Delete Example; Open Long Label Example; Create Group; Cancel; Delete; Restore Local Sample; Download and Embed — Works Offline | Action labels | The controls have explicit objects where needed and preserve established production terms. Dictionary admission remains unverified for Cancel, Create, Download, and Embed. |
| These production dialogs keep cancellation before confirmation.; Create Group stays disabled until the sample has a name.; Delete keeps its destructive treatment in the affirmative position.; A constrained footer wraps before its actions can overflow. | Reference descriptions | Complete present-active sentences. The disabled and overflow claims were behavior-checked. `Group` keeps its product meaning. |
| Create a local sample Group for {sample item}.; Delete {sample item} from this isolated reference.; Choose whether to include the remote images in this local example. | Dialog descriptions | Complete imperative sentences. The dynamic sample item is authored fixture content and retains its voice. |
| No sample group was created.; Created the local group “{entered Group name}”.; The local sample is available.; Deleted the local sample.; The local example keeps its image links.; Embedded the images in the local example. | Status | Each message reports observed local state after the applicable action. The entered Group name is authored content. |
| The Lantern Archive Beneath the Glass Observatory | Authored sample item | Fixture content retains its authored voice and is excluded from controlled-language vocabulary review. |

The review covered copy roles, visible behavior claims, local casing, sentence completeness, and consistent Group terminology. It did not establish complete ASD-STE100 vocabulary admission, and it does not certify reused production labels. Verdict: **reviewed against listed evidence**, with standalone label grammar and full vocabulary compliance unverified.
