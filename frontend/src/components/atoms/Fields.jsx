// Form controls styled with the theme: single-line text, multi-line text and a dropdown.
import styled, { css } from "styled-components";
import { TextInput, Select } from "../../ui/primitives/index.js";

const fieldStyles = css`
  font: inherit;
  color: ${({ theme }) => theme.colors.ink};
  background: ${({ theme }) => theme.colors.field};
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: ${({ theme }) => theme.radii.small};
  padding: 7px 10px;
  min-width: 0;
`;

export const TextField = styled(TextInput)`
  ${fieldStyles}
`;

export const TextArea = styled(TextInput).attrs({ multiline: true })`
  ${fieldStyles}
  resize: vertical;
`;

export const SelectField = styled(Select)`
  ${fieldStyles}
`;
