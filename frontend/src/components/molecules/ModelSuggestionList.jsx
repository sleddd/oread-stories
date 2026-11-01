// The models matching what's typed in a model field, as a short list to pick from. Only the
// first few are shown; a line underneath says how many more there are, so the reader knows to
// keep typing rather than scroll through tens of thousands.
import styled from "styled-components";
import { Pressable, ScrollView, Text } from "../../ui/primitives/index.js";

const MAX_SHOWN_MODELS = 30;

const List = styled(ScrollView)`
  max-height: 260px;
  margin-top: 6px;
  padding: 4px;
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: ${({ theme }) => theme.radii.medium};
  background: ${({ theme }) => theme.colors.raised};
`;

const Item = styled(Pressable)`
  width: 100%;
  padding: 7px 10px;
  border: 0;
  border-radius: ${({ theme }) => theme.radii.small};
  background: ${({ $isCurrent, theme }) => ($isCurrent ? theme.colors.segment : "transparent")};
  color: ${({ theme }) => theme.colors.ink};
  font: inherit;
  text-align: left;
  cursor: pointer;
  overflow-wrap: anywhere;
  &:hover {
    background: ${({ theme }) => theme.colors.segment};
  }
`;

const Status = styled(Text)`
  display: block;
  padding: 7px 10px;
  color: ${({ theme }) => theme.colors.muted};
  font-size: ${({ theme }) => theme.fontSizes.small};
`;

function statusLine({ isSearching, matchCount, shownCount }) {
  if (isSearching) {
    return "Searching…";
  }
  if (matchCount === 0) {
    return "No models match. Press Enter to use what you typed.";
  }
  if (matchCount > shownCount) {
    return `Showing ${shownCount} of ${matchCount}. Keep typing to narrow it down.`;
  }
  return "";
}

// models: [{ id, label }]. currentModelId is highlighted and marked as pressed.
export function ModelSuggestionList({ models, currentModelId, isSearching, onChoose }) {
  const shownModels = models.slice(0, MAX_SHOWN_MODELS);
  const status = statusLine({
    isSearching,
    matchCount: models.length,
    shownCount: shownModels.length,
  });
  return (
    <List>
      {shownModels.map((model) => (
        <Item
          key={model.id}
          isPressed={model.id === currentModelId}
          $isCurrent={model.id === currentModelId}
          onPress={() => onChoose(model.id)}
        >
          {model.label}
        </Item>
      ))}
      {status && <Status>{status}</Status>}
    </List>
  );
}
