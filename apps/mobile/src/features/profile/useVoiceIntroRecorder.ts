import { useEffect, useRef, useState } from "react";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";

export const VOICE_INTRO_MAX_SECONDS = 10;

/** Records a short voice intro clip, hard-capped at VOICE_INTRO_MAX_SECONDS — stops
 * itself automatically rather than trusting the UI to call stop() in time. */
export function useVoiceIntroRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 100);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const autoStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (autoStopTimer.current) clearTimeout(autoStopTimer.current);
    };
  }, []);

  async function startRecording() {
    setError(null);
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      setError("Microphone access is needed to record a voice intro.");
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    setRecordedUri(null);
    await recorder.prepareToRecordAsync();
    recorder.record();
    autoStopTimer.current = setTimeout(() => {
      void stopRecording();
    }, VOICE_INTRO_MAX_SECONDS * 1000);
  }

  async function stopRecording() {
    if (autoStopTimer.current) {
      clearTimeout(autoStopTimer.current);
      autoStopTimer.current = null;
    }
    if (!recorder.isRecording) return;
    const durationSeconds = recorder.currentTime;
    await recorder.stop();
    setRecordedDuration(Math.max(1, Math.min(VOICE_INTRO_MAX_SECONDS, Math.round(durationSeconds))));
    setRecordedUri(recorder.uri);
  }

  function reset() {
    setRecordedUri(null);
    setRecordedDuration(0);
    setError(null);
  }

  return {
    isRecording: state.isRecording,
    currentSeconds: Math.min(VOICE_INTRO_MAX_SECONDS, state.durationMillis / 1000),
    recordedUri,
    recordedDuration,
    error,
    startRecording,
    stopRecording,
    reset,
  };
}
