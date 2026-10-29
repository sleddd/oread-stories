// Form controls styled with the theme: single-line text, multi-line text and a dropdown.
import styled, { css } from "styled-components";
import { TextInput, Select } from "../../ui/primitives/index.js";

const fieldStyles = css`
  font: inherit;
  font-size: 16px;
  color: ${({ theme }) => theme.colors.ink};
  background: ${({ theme }) => theme.colors.field};
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: ${({ theme }) => theme.radii.small};
  padding: 8px 12px;
  min-width: 0;
  transition: border-color 0.15s;
  &::placeholder {
    color: ${({ theme }) => theme.colors.muted};
  }
  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.lineStrong};
  }
`;

// A chevron drawn with two gradients, so it takes the theme's muted colour without an image.
const chevron = css`
  appearance: none;
  -webkit-appearance: none;
  padding-right: 34px;
  background-image:
    linear-gradient(45deg, transparent 50%, ${({ theme }) => theme.colors.muted} 50%),
    linear-gradient(135deg, ${({ theme }) => theme.colors.muted} 50%, transparent 50%);
  background-position:
    calc(100% - 18px) 55%,
    calc(100% - 13px) 55%;
  background-size:
    5px 5px,
    5px 5px;
  background-repeat: no-repeat;
  cursor: pointer;
`;

export const TextField = styled(TextInput)`
  ${fieldStyles}
`;

export const TextArea = styled(TextInput).attrs({ multiline: true })`
  ${fieldStyles}
  line-height: 1.5;
  resize: vertical;
`;

export const SelectField = styled(Select)`
  ${fieldStyles}
  ${chevron}
`;
