// A status pill with a dot: green when ready, red when something is missing.
import styled from "styled-components";
import { Pressable, View } from "../../ui/primitives/index.js";

const Pill = styled(Pressable)`
  font: inherit;
  font-weight: 500;
  font-size: ${({ theme }) => theme.fontSizes.label};
  color: ${({ theme }) => theme.colors.ink};
  background: ${({ theme }) => theme.colors.panel};
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: 6px 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 44vw;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
`;

const Dot = styled(View)`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
  background: ${({ $isReady, theme }) => ($isReady ? theme.colors.positive : theme.colors.danger)};
`;

export function Badge({ label, isReady, title, onPress }) {
  return (
    <Pill title={title} onPress={onPress}>
      <Dot $isReady={isReady} />
      {label}
    </Pill>
  );
}
