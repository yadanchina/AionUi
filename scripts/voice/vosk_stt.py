#!/usr/bin/env python3
import argparse
import json
import queue
import signal
import sys
from queue import Empty

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def emit(payload: dict):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def resolve_input_device(sd):
    devices = sd.query_devices()
    input_devices = []
    for index, device in enumerate(devices):
        if device.get("max_input_channels", 0) > 0:
            input_devices.append(
                {
                    "index": index,
                    "name": device.get("name", f"device-{index}"),
                    "max_input_channels": device.get("max_input_channels", 0),
                    "default_samplerate": device.get("default_samplerate"),
                }
            )

    default_input_index = None
    try:
        default_device = sd.default.device
        if isinstance(default_device, (list, tuple)) and len(default_device) > 0:
            default_input_index = default_device[0]
        elif isinstance(default_device, int):
            default_input_index = default_device
    except Exception:
        default_input_index = None

    chosen = None
    if isinstance(default_input_index, int) and default_input_index >= 0:
        chosen = next((device for device in input_devices if device["index"] == default_input_index), None)

    if chosen is None and input_devices:
        chosen = input_devices[0]

    return chosen, input_devices


def main():
    parser = argparse.ArgumentParser(description="Vosk local speech-to-text")
    parser.add_argument("--model", required=True, help="Vosk model directory")
    args = parser.parse_args()

    try:
        import sounddevice as sd
        from vosk import Model, KaldiRecognizer
    except Exception as exc:
        emit({"type": "error", "error": f"python deps missing: {exc}"})
        return 1

    q: "queue.Queue[bytes]" = queue.Queue()
    stopped = {"value": False}
    last_partial = {"text": ""}

    def int_handler(_sig, _frame):
        stopped["value"] = True

    signal.signal(signal.SIGINT, int_handler)
    signal.signal(signal.SIGTERM, int_handler)

    try:
        model = Model(args.model)
        rec = KaldiRecognizer(model, 16000)
    except Exception as exc:
        emit({"type": "error", "error": f"failed to load model: {exc}"})
        return 2

    chosen_device, input_devices = resolve_input_device(sd)
    if not chosen_device:
        emit({"type": "error", "error": "no input audio device available"})
        return 3

    emit(
        {
            "type": "info",
            "device": chosen_device,
            "available_input_devices": input_devices,
        }
    )

    def callback(indata, _frames, _time, status):
        if status:
            emit({"type": "error", "error": f"audio status: {status}"})
            return
        q.put(bytes(indata))

    # Build candidate device list: chosen first, then system default, then others
    candidates = [chosen_device["index"]]
    candidates.append(None)  # None = let PortAudio pick the default
    for dev in input_devices:
        if dev["index"] not in candidates:
            candidates.append(dev["index"])

    stream_kwargs = dict(samplerate=16000, blocksize=8000, dtype="int16", channels=1, callback=callback)

    stream = None
    open_errors = []
    for dev_id in candidates:
        try:
            stream = sd.RawInputStream(device=dev_id, **stream_kwargs)
            stream.start()
            if dev_id != chosen_device["index"]:
                emit({"type": "info", "fallback_device": dev_id})
            break
        except Exception as exc:
            open_errors.append(f"device {dev_id}: {exc}")
            stream = None

    if stream is None:
        emit({"type": "error", "error": f"all audio devices failed: {'; '.join(open_errors)}"})
        return 3

    try:
        with stream:
            while not stopped["value"]:
                try:
                    data = q.get(timeout=0.2)
                except Empty:
                    continue
                if rec.AcceptWaveform(data):
                    result = json.loads(rec.Result())
                    text = (result.get("text") or "").strip()
                    if text:
                        emit({"type": "final", "text": text})
                    last_partial["text"] = ""
                else:
                    partial = json.loads(rec.PartialResult())
                    text = (partial.get("partial") or "").strip()
                    if text and text != last_partial["text"]:
                        emit({"type": "partial", "text": text})
                        last_partial["text"] = text
    except Exception as exc:
        emit({"type": "error", "error": f"audio stream failed: {exc}"})
        return 3

    try:
        final = json.loads(rec.FinalResult())
        text = (final.get("text") or "").strip()
        if text:
            emit({"type": "final", "text": text})
    except Exception:
        pass

    return 0


if __name__ == "__main__":
    sys.exit(main())
