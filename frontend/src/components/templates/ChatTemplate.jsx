// Three columns: chats on the left, the conversation in the middle, steering on the right.
// On a wide window either side column can be collapsed, and the conversation widens into the
// space. On narrow windows the side columns slide in over the conversation instead.
import styled, { css } from "styled-components";
import { View } from "../../ui/primitives/index.js";
import {
  CHATS_PANEL_SLIDES_IN_WIDTH,
  STEERING_PANEL_SLIDES_IN_WIDTH,
} from "../../theme/breakpoints.js";

const CHATS_COLUMN_WIDTH = "280px";
const NARROWER_CHATS_COLUMN_WIDTH = "240px";
const STEERING_COLUMN_WIDTH = "360px";
const COLLAPSED_WIDTH = "0px";

const NARROW = `${CHATS_PANEL_SLIDES_IN_WIDTH}px`;
const MEDIUM = `${STEERING_PANEL_SLIDES_IN_WIDTH}px`;

function columnWidth(isCollapsed, openWidth) {
  return isCollapsed ? COLLAPSED_WIDTH : openWidth;
}

const Layout = styled(View)`
  display: grid;
  grid-template-columns:
    ${({ $isChatsCollapsed }) => columnWidth($isChatsCollapsed, CHATS_COLUMN_WIDTH)}
    minmax(0, 1fr)
    ${({ $isSteeringCollapsed }) => columnWidth($isSteeringCollapsed, STEERING_COLUMN_WIDTH)};
  transition: grid-template-columns 0.2s ease;
  height: 100%;
  min-height: 0;
  @media (max-width: ${MEDIUM}) {
    grid-template-columns:
      ${({ $isChatsCollapsed }) => columnWidth($isChatsCollapsed, NARROWER_CHATS_COLUMN_WIDTH)}
      minmax(0, 1fr);
  }
  @media (max-width: ${NARROW}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const slideInPanel = css`
  position: fixed;
  top: 0;
  bottom: 0;
  z-index: 20;
  transition: transform 0.2s;
`;

// A collapsed column keeps its place in the grid at zero width, with its contents hidden.
const collapsedColumn = css`
  visibility: hidden;
  overflow: hidden;
  padding-left: 0;
  padding-right: 0;
  border-width: 0;
`;

const LeftColumn = styled(View)`
  background: ${({ theme }) => theme.colors.panel};
  border-right: 1px solid ${({ theme }) => theme.colors.line};
  padding: 20px 18px;
  overflow: auto;
  min-height: 0;
  min-width: 0;
  @media (min-width: ${CHATS_PANEL_SLIDES_IN_WIDTH + 1}px) {
    ${({ $isCollapsed }) => $isCollapsed && collapsedColumn}
  }
  @media (max-width: ${NARROW}) {
    ${slideInPanel}
    left: 0;
    width: min(300px, 88vw);
    box-shadow: 8px 0 30px ${({ theme }) => theme.colors.shadow};
    transform: ${({ $isSlidIn }) => ($isSlidIn ? "none" : "translateX(-105%)")};
  }
`;

const RightColumn = styled(View)`
  background: ${({ theme }) => theme.colors.panel};
  border-left: 1px solid ${({ theme }) => theme.colors.line};
  overflow: auto;
  min-height: 0;
  min-width: 0;
  @media (min-width: ${STEERING_PANEL_SLIDES_IN_WIDTH + 1}px) {
    ${({ $isCollapsed }) => $isCollapsed && collapsedColumn}
  }
  @media (max-width: ${MEDIUM}) {
    ${slideInPanel}
    right: 0;
    width: min(380px, 92vw);
    box-shadow: -8px 0 30px ${({ theme }) => theme.colors.shadow};
    transform: ${({ $isSlidIn }) => ($isSlidIn ? "none" : "translateX(105%)")};
  }
`;

const Conversation = styled(View)`
  min-height: 0;
  background: ${({ theme }) => theme.colors.background};
`;

const MessagesArea = styled(View)`
  flex: 1;
  min-height: 0;
`;

export function ChatTemplate({
  sidebar,
  header,
  messages,
  composer,
  inspector,
  isChatsPanelCollapsed,
  isSteeringPanelCollapsed,
  isChatsPanelSlidIn,
  isSteeringPanelSlidIn,
  onClosePanels,
}) {
  return (
    <Layout
      $isChatsCollapsed={isChatsPanelCollapsed}
      $isSteeringCollapsed={isSteeringPanelCollapsed}
    >
      <LeftColumn
        as="aside"
        aria-label="Character and chats"
        $isCollapsed={isChatsPanelCollapsed}
        $isSlidIn={isChatsPanelSlidIn}
      >
        {sidebar}
      </LeftColumn>
      <Conversation as="section" onClick={onClosePanels}>
        {header}
        <MessagesArea>{messages}</MessagesArea>
        {composer}
      </Conversation>
      <RightColumn
        as="aside"
        aria-label="Steering and context"
        $isCollapsed={isSteeringPanelCollapsed}
        $isSlidIn={isSteeringPanelSlidIn}
      >
        {inspector}
      </RightColumn>
    </Layout>
  );
}
