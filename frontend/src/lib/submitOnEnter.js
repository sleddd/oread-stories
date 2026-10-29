// A key handler for single-line fields: pressing Enter submits the form.
export function submitOnEnter(submit) {
  return (keyEvent) => {
    if (keyEvent.key === "Enter") {
      submit();
    }
  };
}
