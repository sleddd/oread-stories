// One item a character carries: its name, a note (what state it's in, where it came from), and a
// remove button.
import styled from "styled-components";
import { Row } from "../../ui/primitives/index.js";
import { Button, TextField } from "../atoms/index.js";

const Layout = styled(Row)`
  gap: 8px;
  flex-wrap: wrap;
  padding: 6px 0;
  border-top: 1px solid ${({ theme }) => theme.colors.line};
`;

const NameField = styled(TextField)`
  flex: 1 1 140px;
`;

const NoteField = styled(TextField)`
  flex: 2 1 200px;
`;

export function ItemRow({ item, onChange, onRemove }) {
  const itemName = item.name || "item";
  return (
    <Layout>
      <NameField
        accessibilityLabel="Item name"
        value={item.name}
        placeholder="Item"
        onChangeText={(name) => onChange({ ...item, name })}
      />
      <NoteField
        accessibilityLabel={`Note for ${itemName}`}
        value={item.note}
        placeholder="Note"
        onChangeText={(note) => onChange({ ...item, note })}
      />
      <Button
        label="Remove"
        size="small"
        variant="ghost"
        accessibilityLabel={`Remove ${itemName}`}
        onPress={onRemove}
      />
    </Layout>
  );
}
