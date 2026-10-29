// Text styles: headings, notes, hints, labels, status lines and monospace blocks.
import styled from "styled-components";
import { Text } from "../../ui/primitives/index.js";

export const Heading1 = styled(Text).attrs({ role: "heading", "aria-level": 1 })`
  display: block;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 600;
  font-size: ${({ theme }) => theme.fontSizes.heading1};
  letter-spacing: -0.01em;
`;

export const Heading2 = styled(Text).attrs({ role: "heading", "aria-level": 2 })`
  display: block;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 600;
  font-size: ${({ theme }) => theme.fontSizes.heading2};
  letter-spacing: -0.005em;
  margin-bottom: 4px;
`;

export const Heading3 = styled(Text).attrs({ role: "heading", "aria-level": 3 })`
  display: block;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 600;
  font-size: ${({ theme }) => theme.fontSizes.heading3};
  margin: 14px 0 4px;
`;

export const Note = styled(Text)`
  display: block;
  color: ${({ theme }) => theme.colors.muted};
  font-size: ${({ theme }) => theme.fontSizes.label};
  margin-bottom: 10px;
`;

export const Lede = styled(Text)`
  display: block;
  color: ${({ theme }) => theme.colors.muted};
  max-width: 64ch;
  margin-top: 8px;
  line-height: 1.5;
`;

export const Hint = styled(Text)`
  display: block;
  color: ${({ theme }) => theme.colors.muted};
  font-size: ${({ theme }) => theme.fontSizes.small};
`;

// Small capitals above a control: STORY, START FROM, TITLE.
export const FieldLabel = styled(Text)`
  display: block;
  font-weight: 700;
  font-size: ${({ theme }) => theme.fontSizes.eyebrow};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${({ theme }) => theme.colors.muted};
`;

export const Eyebrow = FieldLabel;

export const StatusText = styled(Text).attrs({ role: "status" })`
  color: ${({ $isError, theme }) => ($isError ? theme.colors.danger : theme.colors.positive)};
  font-size: ${({ theme }) => theme.fontSizes.label};
`;

export const MonospaceBlock = styled(Text)`
  display: block;
  font-family: ${({ theme }) => theme.fonts.monospace};
  font-size: 12.5px;
  line-height: 1.5;
  white-space: pre-wrap;
  background: ${({ theme }) => theme.colors.field};
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: 8px;
  padding: 10px;
  max-height: 52vh;
  overflow: auto;
`;

export const EmptyState = styled(Text)`
  display: block;
  color: ${({ theme }) => theme.colors.muted};
  font-size: ${({ theme }) => theme.fontSizes.label};
  padding: 6px 2px;
`;
