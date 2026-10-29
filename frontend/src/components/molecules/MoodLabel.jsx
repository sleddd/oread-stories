// "Feeling relaxed, strongly" — the mood name in the accent colour.
import styled from "styled-components";
import { Text } from "../../ui/primitives/index.js";

const Label = styled(Text)`
  display: block;
  font-family: ${({ $isLarge, theme }) => ($isLarge ? theme.fonts.serif : "inherit")};
  font-size: ${({ $isLarge }) => ($isLarge ? "26px" : "14.5px")};
  line-height: 1.3;
  color: ${({ $isLarge, theme }) => ($isLarge ? theme.colors.ink : theme.colors.muted)};
  margin: ${({ $isLarge }) => ($isLarge ? "2px 0 6px" : "0")};
`;

const MoodName = styled(Text)`
  color: ${({ theme }) => theme.colors.accent};
  font-family: ${({ theme }) => theme.fonts.serif};
  font-style: italic;
  font-size: 1.08em;
`;

export function MoodLabel({ mood, prefix = "Feeling", isLarge = false }) {
  return (
    <Label $isLarge={isLarge}>
      {prefix} <MoodName>{mood?.label}</MoodName>
      {mood?.intensity}
    </Label>
  );
}
