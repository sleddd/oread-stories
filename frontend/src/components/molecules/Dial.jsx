// A labelled −2…+2 dial: name and value, the slider, its two pole labels, and an optional description.
import styled from "styled-components";
import { View, Row, Text } from "../../ui/primitives/index.js";
import { DialSlider } from "../atoms/index.js";
import { formatDialValue } from "../../lib/format.js";

const Container = styled(View)`
  padding: ${({ $isCompact }) => ($isCompact ? "6px 0" : "14px 0 14px")};
  border-top: ${({ $isCompact, theme }) => ($isCompact ? "0" : `1px solid ${theme.colors.line}`)};
  &:first-of-type {
    border-top: 0;
  }
`;

const Header = styled(Row)`
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
`;

const Name = styled(Text)`
  font-weight: 700;
  font-size: ${({ $isCompact }) => ($isCompact ? "15px" : "17px")};
`;

const Value = styled(Text)`
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.accent};
  font-weight: 600;
`;

const Poles = styled(Row)`
  justify-content: space-between;
  font-size: ${({ $isCompact }) => ($isCompact ? "12.5px" : "13.5px")};
  color: ${({ theme }) => theme.colors.muted};
  margin-top: 4px;
`;

const Description = styled(Text)`
  display: block;
  font-size: 14px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.muted};
  margin-top: 8px;
  min-height: 1.4em;
`;

export function Dial({
  nativeID,
  name,
  lowLabel,
  highLabel,
  value,
  description,
  isCompact = false,
  onChange,
}) {
  return (
    <Container $isCompact={isCompact}>
      <Header>
        <Name $isCompact={isCompact}>{name}</Name>
        <Value>{formatDialValue(value)}</Value>
      </Header>
      <DialSlider
        nativeID={nativeID}
        value={value}
        isCompact={isCompact}
        accessibilityLabel={name}
        onValueChange={onChange}
      />
      <Poles $isCompact={isCompact}>
        <Text>{lowLabel}</Text>
        <Text>{highLabel}</Text>
      </Poles>
      {description !== undefined && <Description>{description}</Description>}
    </Container>
  );
}
