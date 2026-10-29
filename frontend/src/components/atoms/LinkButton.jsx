// A button that reads as an inline link.
import styled from "styled-components";
import { Pressable } from "../../ui/primitives/index.js";

const StyledLink = styled(Pressable)`
  font: inherit;
  font-size: 14.5px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.accent};
  background: none;
  border: 0;
  padding: 0;
  text-decoration: underline;
  cursor: pointer;
  align-self: flex-start;
`;

export function LinkButton({ label, onPress }) {
  return <StyledLink onPress={onPress}>{label}</StyledLink>;
}
