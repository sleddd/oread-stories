// Panels and small display pieces: a titled section, labelled stats and a warning note.
import styled from "styled-components";
import { View, Text } from "../../ui/primitives/index.js";
import { Heading2, Note } from "../atoms/index.js";

const SectionBox = styled(View)`
  background: ${({ theme }) => theme.colors.panel};
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: ${({ theme }) => theme.radii.medium};
  padding: 20px 22px 14px;
  margin-bottom: 16px;
  /* A card inside a card sits on a slightly tinted surface. */
  & & {
    background: ${({ theme }) => theme.colors.field};
  }
`;

export function Section({ title, note, children }) {
  return (
    <SectionBox as="section">
      {title && <Heading2>{title}</Heading2>}
      {note && <Note>{note}</Note>}
      {children}
    </SectionBox>
  );
}

const StatsGrid = styled(View)`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 10px;
  font-size: ${({ theme }) => theme.fontSizes.label};
  margin-bottom: 8px;
`;

const StatLabel = styled(Text)`
  display: block;
  font-size: ${({ theme }) => theme.fontSizes.eyebrow};
  color: ${({ theme }) => theme.colors.muted};
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

// stats: [{ label, value }]
export function StatGrid({ stats }) {
  return (
    <StatsGrid>
      {stats.map((stat) => (
        <View key={stat.label}>
          <StatLabel>{stat.label}</StatLabel>
          <Text>{String(stat.value)}</Text>
        </View>
      ))}
    </StatsGrid>
  );
}

export const WarningNote = styled(Text).attrs({ role: "note" })`
  display: block;
  border-left: 3px solid ${({ theme }) => theme.colors.danger};
  padding: 6px 10px;
  margin: 8px 0;
  background: ${({ theme }) => theme.colors.field};
  font-size: ${({ theme }) => theme.fontSizes.label};
`;
