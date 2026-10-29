// A single centred column with a title and introduction above the settings sections.
import styled from "styled-components";
import { View } from "../../ui/primitives/index.js";
import { Heading1, Lede } from "../atoms/index.js";

const Column = styled(View)`
  max-width: 980px;
  width: 100%;
  margin: 0 auto;
  padding: 24px 20px 60px;
`;

export const ProviderGrid = styled(View)`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 430px), 1fr));
  gap: 16px;
  margin: 12px 0 18px;
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
