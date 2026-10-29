// A set of toggle chips. onChange receives the whole new selection, including ids from other groups.
import styled from "styled-components";
import { View, Row, Text } from "../../ui/primitives/index.js";
import { Chip } from "../atoms/index.js";

const GroupTitle = styled(Text)`
  display: block;
  font-weight: 700;
  margin-top: 8px;
`;

const ChipRow = styled(Row)`
  flex-wrap: wrap;
  gap: 6px;
  margin: 4px 0 12px;
`;

function toggleId(selectedIds, id, isOn) {
  if (isOn) {
    return [...selectedIds, id];
  }
  return selectedIds.filter((selectedId) => selectedId !== id);
}

export function ChipGroup({ title, items, selectedIds, onChange }) {
  return (
    <View>
      {title && <GroupTitle>{title}</GroupTitle>}
      <ChipRow role="group" aria-label={title}>
        {items.map((item) => (
          <Chip
            key={item.id}
            label={item.label}
            description={item.description}
            isOn={selectedIds.includes(item.id)}
            onToggle={(isOn) => onChange(toggleId(selectedIds, item.id, isOn))}
          />
        ))}
      </ChipRow>
    </View>
  );
}
