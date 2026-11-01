// What a character carries. Edits stay local until saved, so typing a name doesn't send a
// request per keystroke; the story's own changes (picking things up, giving them away) arrive
// when the list isn't being edited.
import { useEffect, useState } from "react";
import styled from "styled-components";
import { View, Row } from "../../ui/primitives/index.js";
import { Button, EmptyState } from "../atoms/index.js";
import { ItemRow } from "../molecules/index.js";

const Toolbar = styled(Row)`
  gap: 6px;
  margin-top: 8px;
`;

let nextDraftNumber = 0;

function newDraftItem() {
  nextDraftNumber += 1;
  return { draftKey: `draft-item-${nextDraftNumber}`, name: "", note: "" };
}

function keyOf(item) {
  return item.id ?? item.draftKey;
}

function withoutDraftKeys(items) {
  const namedItems = items.filter((item) => item.name.trim());
  return namedItems.map(({ draftKey, ...item }) => ({ ...item, name: item.name.trim() }));
}

export function InventoryList({ inventory, onSave }) {
  const [draftItems, setDraftItems] = useState(inventory);
  const [hasChanges, setHasChanges] = useState(false);
  useEffect(() => {
    if (!hasChanges) {
      setDraftItems(inventory);
    }
  }, [inventory, hasChanges]);

  function changeItems(nextItems) {
    setDraftItems(nextItems);
    setHasChanges(true);
  }

  function replaceItem(changedItem) {
    const nextItems = draftItems.map((item) => {
      if (keyOf(item) === keyOf(changedItem)) {
        return changedItem;
      }
      return item;
    });
    changeItems(nextItems);
  }

  function removeItem(removedItem) {
    changeItems(draftItems.filter((item) => keyOf(item) !== keyOf(removedItem)));
  }

  return (
    <View>
      {draftItems.length === 0 && <EmptyState>Carrying nothing yet.</EmptyState>}
      {draftItems.map((item) => (
        <ItemRow
          key={keyOf(item)}
          item={item}
          onChange={replaceItem}
          onRemove={() => removeItem(item)}
        />
      ))}
      <Toolbar>
        <Button label="Add item" onPress={() => changeItems([...draftItems, newDraftItem()])} />
        {hasChanges && (
          <>
            <Button
              label="Save inventory"
              variant="primary"
              onPress={() => {
                setHasChanges(false);
                onSave(withoutDraftKeys(draftItems));
              }}
            />
            <Button
              label="Discard"
              onPress={() => {
                setHasChanges(false);
                setDraftItems(inventory);
              }}
            />
          </>
        )}
      </Toolbar>
    </View>
  );
}
