// Three columns: chats on the left, the conversation in the middle, the inspector on the right.
// On narrow screens the side columns slide in over the conversation.
import styled, { css } from "styled-components";
import { View } from "../../ui/primitives/index.js";

const NARROW = "760px";
const MEDIUM = "1180px";

const Layout = styled(View)`
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr) 360px;
  height: 100%;
  min-height: 0;
  @media (max-width: ${MEDIUM}) {
    grid-template-columns: 240px minmax(0, 1fr);
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

const LeftColumn = styled(View)`
  background: ${({ theme }) => theme.colors.panel};
  border-right: 1px solid ${({ theme }) => theme.colors.line};
  padding: 14px;
  overflow: auto;
  min-height: 0;
  @media (max-width: ${NARROW}) {
    ${slideInPanel}
    left: 0;
    width: min(300px, 88vw);
    box-shadow: 8px 0 30px rgba(0, 0, 0, 0.25);
    transform: ${({ $isOpen }) => ($isOpen ? "none" : "translateX(-105%)")};
  }
`;

const RightColumn = styled(View)`
  background: ${({ theme }) => theme.colors.panel};
  border-left: 1px solid ${({ theme }) => theme.colors.line};
  overflow: auto;
  min-height: 0;
  @media (max-width: ${MEDIUM}) {
    ${slideInPanel}
    right: 0;
    width: min(380px, 92vw);
    box-shadow: -8px 0 30px rgba(0, 0, 0, 0.25);
    transform: ${({ $isOpen }) => ($isOpen ? "none" : "translateX(105%)")};
  }
`;

const Conversation = styled(View)`
  min-height: 0;
`;

const MessagesArea = styled(View)`
  flex: 1;
  min-height: 0;
`;

export function ChatTemplate({ sidebar, header, messages, composer, inspector, isChatsOpen, isInspectorOpen, onClosePanels }) {
  return (
    <Layout>
      <LeftColumn as="aside" aria-label="Character and chats" $isOpen={isChatsOpen}>
        {sidebar}
      </LeftColumn>
      <Conversation as="section" onClick={onClosePanels}>
        {header}
        <MessagesArea>{messages}</MessagesArea>
        {composer}
      </Conversation>
      <RightColumn as="aside" aria-label="Steering and context" $isOpen={isInspectorOpen}>
        {inspector}
      </RightColumn>
    </Layout>
  );
}
