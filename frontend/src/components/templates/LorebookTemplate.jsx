// Title, introduction and toolbar on top; controls on the left and output on the right (stacked when narrow).
import styled from "styled-components";
import { View, Row, Text } from "../../ui/primitives/index.js";
import { Heading1, Lede } from "../atoms/index.js";

const Header = styled(View)`
  max-width: 1240px;
  width: 100%;
  margin: 0 auto;
  padding: 24px 20px 8px;
`;

const Toolbar = styled(Row)`
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
`;

const Columns = styled(View)`
  max-width: 1240px;
  width: 100%;
  margin: 0 auto;
  padding: 12px 20px 30px;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const OutputColumn = styled(View)`
  position: sticky;
  top: 12px;
  @media (max-width: 900px) {
    position: static;
  }
`;

const Footer = styled(Text)`
  display: block;
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 20px 30px;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 14.5px;
`;

export function LorebookTemplate({ title, introduction, toolbar, controls, output, footer }) {
  return (
    <View>
      <Header>
        <Heading1>{title}</Heading1>
        <Lede>{introduction}</Lede>
        <Toolbar>{toolbar}</Toolbar>
      </Header>
      <Columns>
        <View>{controls}</View>
        <OutputColumn>{output}</OutputColumn>
      </Columns>
      <Footer>{footer}</Footer>
    </View>
  );
}
