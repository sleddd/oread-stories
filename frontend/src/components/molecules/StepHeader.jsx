// The top of a step-by-step flow: a back arrow (when there's a step to go back to) and a dot per
// step, the current one drawn longer.
import styled from "styled-components";
import { Row, View } from "../../ui/primitives/index.js";
import { IconButton } from "../atoms/index.js";

const BACK_BUTTON_SIZE = 36;

const Header = styled(Row)`
  justify-content: space-between;
  min-height: ${BACK_BUTTON_SIZE}px;
`;

const Dots = styled(Row)`
  gap: 6px;
`;

const Dot = styled(View)`
  height: 8px;
  width: ${({ $isCurrent }) => ($isCurrent ? "26px" : "8px")};
  border-radius: 4px;
  background: ${({ $isCurrent, $isDone, theme }) => {
    if ($isCurrent) {
      return theme.colors.accent;
    }
    if ($isDone) {
      return theme.colors.muted;
    }
    return theme.colors.line;
  }};
  transition: width 160ms ease;
`;

// Keeps the dots centred when there's no back arrow.
const Spacer = styled(View)`
  width: ${BACK_BUTTON_SIZE}px;
`;

export function StepHeader({ stepCount, stepIndex, onBack }) {
  const steps = [...Array(stepCount).keys()];
  return (
    <Header>
      {stepIndex > 0 ? (
        <IconButton icon="chevronLeft" label="Back" onPress={onBack} />
      ) : (
        <Spacer />
      )}
      <Dots aria-label={`Step ${stepIndex + 1} of ${stepCount}`}>
        {steps.map((step) => (
          <Dot key={step} $isCurrent={step === stepIndex} $isDone={step < stepIndex} />
        ))}
      </Dots>
      <Spacer />
    </Header>
  );
}
