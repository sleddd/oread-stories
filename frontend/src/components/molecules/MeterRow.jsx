// A labelled meter: the name and the number on one line, the bar below.
import styled from "styled-components";
import { View, Row, Text } from "../../ui/primitives/index.js";
import { Meter } from "../atoms/index.js";

const Container = styled(View)`
  gap: 3px;
  margin: 6px 0;
`;

const Header = styled(Row)`
  justify-content: space-between;
  font-size: ${({ theme }) => theme.fontSizes.label};
`;

const Value = styled(Text)`
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.accent};
  font-weight: 600;
`;

export function MeterRow({ label, value, displayValue, maximum, isSigned, tone }) {
  return (
    <Container>
      <Header>
        <Text>{label}</Text>
        <Value>{displayValue ?? String(value)}</Value>
      </Header>
      <Meter
        value={value}
        maximum={maximum}
        isSigned={isSigned}
        tone={tone}
        accessibilityLabel={label}
      />
    </Container>
  );
}
