// Stories page layout: the story list and cast in a side column, the open story beside it.
// Stacks into one column on narrow screens.
import styled from "styled-components";
import { View } from "../../ui/primitives/index.js";
import { Heading1, Lede } from "../atoms/index.js";

const Page = styled(View)`
  max-width: ${({ theme }) => theme.layout.pageWidth};
  width: 100%;
  margin: 0 auto;
  padding: 36px 28px 72px;
  @media (max-width: 760px) {
    padding: 20px 16px 48px;
  }
`;

const Columns = styled(View)`
  display: grid;
  grid-template-columns: 290px minmax(0, 1fr);
  gap: 28px;
  align-items: start;
  margin-top: 32px;
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const SideColumn = styled(View)`
  position: sticky;
  top: 12px;
  @media (max-width: 900px) {
    position: static;
  }
`;

export function StoriesTemplate({ title, introduction, side, main }) {
  return (
    <Page>
      <Heading1>{title}</Heading1>
      <Lede>{introduction}</Lede>
      <Columns>
        <SideColumn as="aside" aria-label="Stories and cast">
          {side}
        </SideColumn>
        <View as="section" aria-label="Story">
          {main}
        </View>
      </Columns>
    </Page>
  );
}
