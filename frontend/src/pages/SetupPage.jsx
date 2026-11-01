// The first-run setup: connect a model provider in three steps before the app opens (see
// store/setupSlice.js). Choose a provider from the cards, add its key and model, then check
// the connection and start.
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import styled from "styled-components";
import { useAppStore } from "../store/index.js";
import { SETUP_STEPS } from "../store/setupSlice.js";
import { AuthTemplate } from "../components/templates/index.js";
import {
  ConnectionTest,
  ProviderChooser,
  ProviderFields,
} from "../components/organisms/index.js";
import { AuthSwitch, StepHeader, Toast } from "../components/molecules/index.js";
import { Button, Heading2, Lede, Note } from "../components/atoms/index.js";
import { View } from "../ui/primitives/index.js";
import { PROVIDERS, providerReadiness } from "../content/providers.js";

const Actions = styled(View)`
  gap: 12px;
  margin-top: 6px;
`;

const CHOOSE_INTRODUCTION =
  "Oread writes your characters with a model from a provider you connect. Choose one to start; " +
  "you can change it any time in Settings.";
const NOT_READY_NOTE = "Add the key and choose a model to carry on.";

function useSetupState() {
  return useAppStore(
    useShallow((state) => ({
      settings: state.settings,
      setupStep: state.setupStep,
      setupProviderId: state.setupProviderId,
      chooseSetupProvider: state.chooseSetupProvider,
      goToSetupStep: state.goToSetupStep,
      goBackInSetup: state.goBackInSetup,
      skipSetup: state.skipSetup,
      finishSetup: state.finishSetup,
      patchSettings: state.patchSettings,
      listModels: state.listModels,
      reportFetchedModels: state.reportFetchedModels,
      testProvider: state.testProvider,
      toast: state.toast,
    })),
  );
}

function ChooseStep({ setup }) {
  return (
    <>
      <Heading2>Choose a model provider</Heading2>
      <Lede>{CHOOSE_INTRODUCTION}</Lede>
      <ProviderChooser
        providers={PROVIDERS}
        selectedId={setup.setupProviderId}
        activeId={null}
        onSelect={setup.chooseSetupProvider}
      />
      <AuthSwitch actionLabel="Skip for now" onPress={setup.skipSetup} />
    </>
  );
}

function ConnectStep({ setup, provider }) {
  const isReady = providerReadiness(setup.settings, provider.id).isReady;
  return (
    <>
      <Heading2>Connect {provider.name}</Heading2>
      <Lede>{provider.description}</Lede>
      <ProviderFields
        provider={provider}
        settings={setup.settings}
        onSaveField={(providerId, fieldKey, value) => {
          setup.patchSettings({ [providerId]: { [fieldKey]: value } }, { announce: false });
        }}
        onFetchModels={setup.listModels}
        onFetched={setup.reportFetchedModels}
      />
      {!isReady && <Note>{NOT_READY_NOTE}</Note>}
      <Actions>
        <Button
          label="Continue"
          variant="primary"
          isWide
          disabled={!isReady}
          onPress={() => setup.goToSetupStep("test")}
        />
      </Actions>
    </>
  );
}

function TestStep({ setup, provider }) {
  const [hasPassed, setHasPassed] = useState(false);
  return (
    <>
      <Heading2>Check the connection</Heading2>
      <Lede>Oread asks {provider.name} for a short reply, to make sure everything works.</Lede>
      <ConnectionTest
        providerId={provider.id}
        onTest={setup.testProvider}
        onPassed={() => setHasPassed(true)}
      />
      <Actions>
        <Button
          label="Start writing"
          variant={hasPassed ? "primary" : "default"}
          isWide
          onPress={setup.finishSetup}
        />
      </Actions>
    </>
  );
}

export function SetupPage() {
  const setup = useSetupState();
  const provider =
    PROVIDERS.find((candidate) => candidate.id === setup.setupProviderId) ?? PROVIDERS[0];
  const stepIndex = SETUP_STEPS.indexOf(setup.setupStep);
  let step = <ChooseStep setup={setup} />;
  if (setup.setupStep === "connect") {
    step = <ConnectStep setup={setup} provider={provider} />;
  } else if (setup.setupStep === "test") {
    step = <TestStep setup={setup} provider={provider} />;
  }
  return (
    <AuthTemplate>
      <StepHeader
        stepCount={SETUP_STEPS.length}
        stepIndex={stepIndex}
        onBack={setup.goBackInSetup}
      />
      {step}
      <Toast toast={setup.toast} />
    </AuthTemplate>
  );
}
