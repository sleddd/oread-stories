// A form row: label, the control(s), and an optional hint underneath.
import styled from "styled-components";
import { View } from "../../ui/primitives/index.js";
import { FieldLabel, Hint } from "../atoms/index.js";

const Container = styled(View)`
  gap: 3px;
  margin: 8px 0;
`;

export function FormField({ label, hint, children }) {
  return (
    <Container>
      <FieldLabel>{label}</FieldLabel>
      {children}
      {hint && <Hint>{hint}</Hint>}
    </Container>
  );
}
