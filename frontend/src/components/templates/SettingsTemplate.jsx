// A single centred column with a title and introduction above the settings sections.
import styled from "styled-components";
import { View } from "../../ui/primitives/index.js";
import { Heading1, Lede } from "../atoms/index.js";

const Column = styled(View)`
  max-width: 980px;
  width: 100%;
  margin: 0 auto;
  padding: 36px 28px 72px;
  @media (max-width: 760px) {
    padding: 20px 16px 48px;
  }
`;

export const ProviderGrid = styled(View)`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 430px), 1fr));
  gap: 16px;
  margin: 24px 0 18px;
`;

export const FieldGrid = styled(View)`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  gap: 4px 18px;
`;

export function SettingsTemplate({ title, introduction, children }) {
  return (
    <Column>
      <Heading1>{title}</Heading1>
      <Lede>{introduction}</Lede>
      {children}
    </Column>
  );
}
