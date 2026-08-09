import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { RotateCcw, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import PromptField from "@/components/prompt/PromptField";
import { plainVocabulary } from "@/lib/chipVocabulary";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TokenAutocomplete } from "@/components/TokenAutocomplete";
import { useDanbooruTags } from "@/lib/useDanbooruTags";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import PolicyService from "@/services/PolicyService";
import { type PoliciesTab as PoliciesSubTab } from "@/components/menu/policiesTabs";
import type { AdminPolicies, AdminPolicy, PolicyId } from "@/types";

/** Mirrors the server's caps so the field limits agree with what it will accept. */
const TITLE_MAX = 120;
const BODY_MAX = 4000;

interface PoliciesTabProps {
  /** Whether the tab is visible; the drafts only load while it is. */
  active: boolean;
  /** Sub-tab to open on; the dev-router uses this to land on either popup directly. */
  initialTab?: PoliciesSubTab;
}

/** A blank draft, used before anything has been authored and while the first load is in flight. */
const EMPTY: AdminPolicy = { enabled: false, title: '', body: '', tags: [], acceptanceVersion: 1, updatedAt: null };

interface PolicyEditorProps {
  heading: string;
  description: string;
  draft: AdminPolicy;
  onChange: (draft: AdminPolicy) => void;
  onSave: () => void;
  saving: boolean;
  /** Tag notice only: the list of tags that trigger it. */
  showTags?: boolean;
  /** Upload gate only: makes every existing acceptance stale on save. */
  reaccept?: boolean;
  onReacceptChange?: (value: boolean) => void;
}

/** One authored popup: the enable switch, its text, and whatever extra control its kind needs. */
function PolicyEditor({
  heading, description, draft, onChange, onSave, saving, showTags, reaccept, onReacceptChange,
}: PolicyEditorProps) {
  const idBase = heading.replace(/\s+/g, '-').toLowerCase();
  // The world editor's tag options, so the notice is written against the same vocabulary authors tag with.
  const tagOptions = useDanbooruTags(showTags === true);
  // No chip family: a policy is prose, and an authored world's placeholders mean nothing to a reader.
  const plainVocab = useMemo(() => plainVocabulary(), []);

  return (
    <section className="space-y-3 border rounded-md p-4 min-w-0">
      <div>
        <h3 className="font-medium">{heading}</h3>
        <p className="text-meta text-muted-foreground">{description}</p>
      </div>

      <label className="flex items-start gap-2 text-label">
        <Checkbox
          checked={draft.enabled}
          onCheckedChange={(checked) => onChange({ ...draft, enabled: checked === true })}
          className="mt-0.5"
        />
        <span>
          Enabled
          <span className="block text-meta text-muted-foreground">
            Off keeps the wording saved without showing it to anyone.
          </span>
        </span>
      </label>

      <div className="space-y-2">
        <label htmlFor={`${idBase}-title`} className="text-label font-medium">Title</label>
        <Input
          id={`${idBase}-title`}
          value={draft.title}
          maxLength={TITLE_MAX}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
          placeholder="Shown as the popup's heading"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-label font-medium">Body</span>
          <span className="text-meta text-muted-foreground">{draft.body.length} / {BODY_MAX}</span>
        </div>
        {/* Readers see this rendered, so it is authored the same way the world editor's prose is. */}
        <PromptField
          value={draft.body}
          onChange={(body) => onChange({ ...draft, body: body.slice(0, BODY_MAX) })}
          vocabulary={plainVocab}
          markdown
          ariaLabel={`${heading} body`}
          placeholder="Markdown is supported"
          className="h-[280px]"
        />
      </div>

      {showTags && (
        <div className="space-y-2">
          <span className="text-label font-medium">Tags</span>
          {/* The same chip field, options and Enter-to-commit as a world's own tags, so what is typed
              here and what an author tags with are written the same way. */}
          <TokenAutocomplete
            values={draft.tags}
            onChange={(tags) => onChange({ ...draft, tags })}
            options={tagOptions}
            preserveOrder
            reorderable
            editable
            ariaLabel="Tags"
            placeholder="Add tags..."
          />
          <p className="text-meta text-muted-foreground">
            Matched whole and ignoring case, so <code>mature</code> catches
            {' '}<code>Mature</code> but not <code>mature themes</code> — list each wording you mean.
          </p>
        </div>
      )}

      {onReacceptChange && (
        <label className="flex items-start gap-2 text-label">
          <Checkbox
            checked={reaccept}
            onCheckedChange={(checked) => onReacceptChange(checked === true)}
            className="mt-0.5"
          />
          <span>
            Require everyone to accept again
            <span className="block text-meta text-muted-foreground">
              For a real change to the terms. A typo fix should leave this off.
            </span>
          </span>
        </label>
      )}

      <Button size="sm" onClick={onSave} disabled={saving}>
        <Save className="mr-2 h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
      </Button>
    </section>
  );
}

/** Admin Panel → Policies. Authors the two popups shown while publishing, and resets the gate. Each
 *  popup gets its own sub-tab: they share nothing but the surface, and side by side each was a long
 *  scroll away from the other. */
export function PoliciesTab({ active, initialTab = 'uploadGate' }: PoliciesTabProps) {
  // Radix unmounts an inactive tab panel, so this remounts on every visit — no reset-on-open needed.
  const [tab, setTab] = useState<PoliciesSubTab>(initialTab);
  const [gate, setGate] = useState<AdminPolicy>(EMPTY);
  const [notice, setNotice] = useState<AdminPolicy>(EMPTY);
  const [isLoading, setIsLoading] = useState(false);
  const [savingId, setSavingId] = useState<PolicyId | null>(null);
  const [reaccept, setReaccept] = useState(false);
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data: AdminPolicies = await PolicyService.fetchForAdmin();
      setGate(data.uploadGate);
      setNotice(data.tagNotice);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to load policies');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) load();
  }, [active, load]);

  const save = async (id: PolicyId, draft: AdminPolicy) => {
    setSavingId(id);
    try {
      const saved = await PolicyService.save(id, {
        enabled: draft.enabled,
        title: draft.title,
        body: draft.body,
        tags: draft.tags,
        ...(id === 'upload_gate' ? { requireReaccept: reaccept } : {}),
      });

      if (id === 'upload_gate') {
        setGate(saved);
        // One-shot: leaving it ticked would silently re-prompt everyone on the next typo fix.
        setReaccept(false);
      } else {
        setNotice(saved);
      }

      toast.success('Saved');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to save');
    } finally {
      setSavingId(null);
    }
  };

  const resetEveryone = async () => {
    try {
      await PolicyService.resetUploadGate();
      await load();
      toast.success('Everyone will be asked to accept again');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to reset the terms');
    }
  };

  return (
    <div className="py-4 min-w-0">
      <Tabs value={tab} onValueChange={(value) => setTab(value as PoliciesSubTab)} className="w-full min-w-0">
        {/* The strip stays put through the load — only the panel below it is still arriving. */}
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="uploadGate">Upload Gate</TabsTrigger>
          <TabsTrigger value="tagNotice">Tag Notice</TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="pt-4">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
        <>
        <TabsContent value="uploadGate" className="space-y-4 pt-4">
          <PolicyEditor
            heading="Upload Gate"
            description="Shown the first time someone publishes anything. Declining blocks publishing until they accept."
            draft={gate}
            onChange={setGate}
            onSave={() => save('upload_gate', gate)}
            saving={savingId === 'upload_gate'}
            reaccept={reaccept}
            onReacceptChange={setReaccept}
          />

          {/* Only the gate is ever accepted, so its reset belongs with it rather than above both. */}
          <div className="flex items-center justify-between gap-4 border rounded-md p-4">
            <p className="text-helper text-muted-foreground">
              Ask every account to accept the gate again. Reset one person from the Users tab instead.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setConfirmResetAll(true)}
              disabled={!gate.updatedAt}
            >
              <RotateCcw className="mr-2 h-4 w-4" /> Reset Everyone
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="tagNotice" className="pt-4">
          <PolicyEditor
            heading="Tag Notice"
            description="Shown whenever a publish carries one of its tags. Advisory — it never blocks the upload."
            draft={notice}
            onChange={setNotice}
            onSave={() => save('tag_notice', notice)}
            saving={savingId === 'tag_notice'}
            showTags
          />
        </TabsContent>
        </>
        )}
      </Tabs>

      <ConfirmDialog
        open={confirmResetAll}
        onOpenChange={(open) => { if (!open) setConfirmResetAll(false); }}
        title="Ask everyone to accept again?"
        description="Every account will have to accept the upload gate before publishing anything, including updates to work they already published."
        onConfirm={() => { resetEveryone(); setConfirmResetAll(false); }}
        onCancel={() => setConfirmResetAll(false)}
      />
    </div>
  );
}
