/** A browser service is used only after Start. Late results are ignored. */
export function createDictation({ window, onText, onStatus, onActive }) {
  const Recognition =
    window.SpeechRecognition ?? window.webkitSpeechRecognition;
  let recognition = null;
  let closed = false;
  let generation = 0;
  const stop = () => {
    generation += 1;
    const current = recognition;
    recognition = null;
    current?.abort();
    onActive(false);
  };
  return {
    supported: Boolean(Recognition),
    start() {
      if (!Recognition || closed) {
        return;
      }
      stop();
      const token = generation;
      try {
        const current = new Recognition();
        recognition = current;
        current.lang = window.document.documentElement.lang || 'en';
        current.continuous = true;
        current.interimResults = false;
        current.onresult = (event) => {
          if (closed || generation !== token) {
            return;
          }
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            if (event.results[i].isFinal) {
              onText(event.results[i][0].transcript);
            }
          }
        };
        current.onerror = (event) => {
          if (generation === token && !closed) {
            stop();
            onStatus(`Voice input: ${event.error}`);
          }
        };
        current.onend = () => {
          if (generation === token && !closed) {
            recognition = null;
            onActive(false);
          }
        };
        current.start();
        onActive(true);
      } catch (error) {
        stop();
        onStatus(`Voice input: ${error.message}`);
      }
    },
    stop,
    destroy() {
      closed = true;
      stop();
    },
  };
}
