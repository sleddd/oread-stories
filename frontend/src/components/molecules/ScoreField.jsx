// One number on a fixed scale with step buttons: an ability score (1–20) or a skill level (0–10).
import styled from "styled-components";
import { Row, Text } from "../../ui/primitives/index.js";
import { Button } from "../atoms/index.js";

const Layout = styled(Row)`
  gap: 6px;
  align-items: center;
`;

const Value = styled(Text)`
  min-width: 2.2em;
  text-align: center;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
`;

const Extra = styled(Text)`
  color: ${({ theme }) => theme.colors.muted};
  font-size: ${({ theme }) => theme.fontSizes.small};
  min-width: 2.4em;
`;

export function ScoreField({ label, score, minimum, maximum, extra, onChange }) {
  return (
    <Layout role="group" aria-label={label}>
      <Button
        label="−"
        size="small"
        accessibilityLabel={`Lower ${label}`}
        disabled={score <= minimum}
        onPress={() => onChange(score - 1)}
      />
      <Value aria-label={`${label} score`}>{String(score)}</Value>
      <Button
        label="+"
        size="small"
        accessibilityLabel={`Raise ${label}`}
        disabled={score >= maximum}
        onPress={() => onChange(score + 1)}
      />
      {extra && <Extra>{extra}</Extra>}
    </Layout>
  );
}
