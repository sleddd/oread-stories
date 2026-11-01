// A character's memory: the identity and "in the middle of" entries first, then everything else
// grouped by kind, oldest first within each group. Each section opens and closes, so a long
// memory stays easy to scan: the two one-line sections start open, the groups closed. Entries
// can be edited, forgotten or added, and found by meaning.
import { useState } from "react";
import styled from "styled-components";
import { View, Row } from "../../ui/primitives/index.js";
import {
  Button,
  Heading3,
  Note,
  EmptyState,
  TextArea,
  TextField,
  SelectField,
} from "../atoms/index.js";
import {
  Disclosure,
  MemoryEntry,
  KeywordInput,
  ScoreField,
  FormField,
} from "../molecules/index.js";
import {
  MEMORY_KINDS,
  SINGLE_MEMORY_KINDS,
  MEMORY_NOTE,
  IMPORTANCE_LIMITS,
  DEFAULT_IMPORTANCE,
} from "../../content/story.js";

const SEARCH_UNAVAILABLE_NOTE =
  "Search by meaning isn't ready yet. The search model may still be downloading; try again soon.";

const EntryList = styled(View)`
  gap: 6px;
`;

// Room between a section's opened edge (or its note) and the first entry, and between entries.
const SectionEntries = styled(View)`
  gap: 14px;
  padding-top: 12px;
`;

const SearchRow = styled(Row)`
  gap: 6px;
  margin-bottom: 8px;
`;

const SearchField = styled(TextField)`
  flex: 1;
`;

const Toolbar = styled(Row)`
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 6px;
`;

function entriesOfKind(entries, kindId) {
  return entries.filter((entry) => entry.kind === kindId);
}

// Oldest first, so a new memory joins the bottom of its group, like the story it came from.
function oldestFirst(entries) {
  return [...entries].sort((first, second) => (first.created ?? 0) - (second.created ?? 0));
}

function SingleEntry({ kind, entry, sourceLabelFor, handlers }) {
  return (
    <Disclosure title={kind.label} note={kind.description} isInitiallyOpen>
      <SectionEntries>
        {entry && (
          <MemoryEntry
            entry={entry}
            sourceLabel={sourceLabelFor(entry.source)}
            onSave={(changes) => handlers.onSave(entry.id, changes)}
            onDelete={() => handlers.onDelete(entry)}
          />
        )}
        {!entry && <EmptyState>Nothing written yet.</EmptyState>}
      </SectionEntries>
    </Disclosure>
  );
}

function KindGroup({ kind, entries, sourceLabelFor, handlers }) {
  return (
    <Disclosure title={kind.label} count={entries.length}>
      <SectionEntries>
        {oldestFirst(entries).map((entry) => (
          <MemoryEntry
            key={entry.id}
            entry={entry}
            sourceLabel={sourceLabelFor(entry.source)}
            onSave={(changes) => handlers.onSave(entry.id, changes)}
            onDelete={() => handlers.onDelete(entry)}
          />
        ))}
      </SectionEntries>
    </Disclosure>
  );
}

function AddMemoryForm({ onAdd, onCancel }) {
  const [kind, setKind] = useState("event");
  const [text, setText] = useState("");
  const [about, setAbout] = useState([]);
  const [importance, setImportance] = useState(DEFAULT_IMPORTANCE);
  const kindItems = MEMORY_KINDS.map((option) => ({ value: option.id, label: option.label }));
  return (
    <View aria-label="New memory">
      <Heading3>New memory</Heading3>
      <FormField label="Kind">
        <SelectField
          accessibilityLabel="Memory kind"
          selectedValue={kind}
          items={kindItems}
          onValueChange={setKind}
        />
      </FormField>
      <FormField label="What they remember" hint="Write it in the character's own words.">
        <TextArea accessibilityLabel="New memory text" value={text} onChangeText={setText} />
      </FormField>
      <KeywordInput label="About" keywords={about} onChange={setAbout} />
      <ScoreField
        label="Importance"
        score={importance}
        minimum={IMPORTANCE_LIMITS.minimum}
        maximum={IMPORTANCE_LIMITS.maximum}
        onChange={setImportance}
      />
      <Toolbar>
        <Button
          label="Add memory"
          variant="primary"
          disabled={!text.trim()}
          onPress={() => onAdd({ kind, text, about, importance })}
        />
        <Button label="Cancel" onPress={onCancel} />
      </Toolbar>
    </View>
  );
}

function SearchResults({ search, sourceLabelFor, handlers }) {
  if (search.status === "unavailable") {
    return <Note>{SEARCH_UNAVAILABLE_NOTE}</Note>;
  }
  if (search.status === "searching") {
    return <EmptyState>Searching…</EmptyState>;
  }
  if (search.status !== "done") {
    return null;
  }
  return (
    <View aria-label="Search results">
      <Heading3>{`Closest to “${search.query}”`}</Heading3>
      {search.results.length === 0 && <EmptyState>Nothing comes to mind.</EmptyState>}
      <EntryList>
        {search.results.map((result) => (
          <MemoryEntry
            key={result.entry.id}
            entry={result.entry}
            sourceLabel={sourceLabelFor(result.entry.source)}
            onSave={(changes) => handlers.onSave(result.entry.id, changes)}
            onDelete={() => handlers.onDelete(result.entry)}
          />
        ))}
      </EntryList>
      <Toolbar>
        <Button label="Clear search" size="small" onPress={handlers.onClearSearch} />
      </Toolbar>
    </View>
  );
}

function MemorySearch({ search, sourceLabelFor, handlers }) {
  const [query, setQuery] = useState("");
  return (
    <View>
      <SearchRow>
        <SearchField
          accessibilityLabel="Search memories by meaning"
          placeholder="Search by meaning, e.g. the night of the fire"
          value={query}
          onChangeText={setQuery}
          onKeyPress={(keyEvent) => {
            if (keyEvent.key === "Enter") {
              handlers.onSearch(query);
            }
          }}
        />
        <Button label="Search" disabled={!query.trim()} onPress={() => handlers.onSearch(query)} />
      </SearchRow>
      <SearchResults search={search} sourceLabelFor={sourceLabelFor} handlers={handlers} />
    </View>
  );
}

// handlers: { onAdd, onSave(entryId, changes), onDelete(entry), onSearch(query), onClearSearch }
export function MemoryEditor({ characterName, entries, search, sourceLabelFor, handlers }) {
  const [isAdding, setIsAdding] = useState(false);
  const singleKinds = MEMORY_KINDS.filter((kind) => SINGLE_MEMORY_KINDS.includes(kind.id));
  const groupedKinds = MEMORY_KINDS.filter((kind) => !SINGLE_MEMORY_KINDS.includes(kind.id));
  const nonEmptyGroups = groupedKinds.filter((kind) => entriesOfKind(entries, kind.id).length > 0);
  return (
    <View>
      <Note>{MEMORY_NOTE}</Note>
      <MemorySearch search={search} sourceLabelFor={sourceLabelFor} handlers={handlers} />
      {singleKinds.map((kind) => (
        <SingleEntry
          key={kind.id}
          kind={kind}
          entry={entriesOfKind(entries, kind.id)[0]}
          sourceLabelFor={sourceLabelFor}
          handlers={handlers}
        />
      ))}
      {nonEmptyGroups.map((kind) => (
        <KindGroup
          key={kind.id}
          kind={kind}
          entries={entriesOfKind(entries, kind.id)}
          sourceLabelFor={sourceLabelFor}
          handlers={handlers}
        />
      ))}
      {nonEmptyGroups.length === 0 && (
        <EmptyState>{`${characterName} doesn't remember anything else yet.`}</EmptyState>
      )}
      {isAdding && (
        <AddMemoryForm
          onCancel={() => setIsAdding(false)}
          onAdd={(entry) => {
            setIsAdding(false);
            handlers.onAdd(entry);
          }}
        />
      )}
      {!isAdding && (
        <Toolbar>
          <Button label="Add a memory" onPress={() => setIsAdding(true)} />
        </Toolbar>
      )}
    </View>
  );
}
