import { React, useRef, useState } from 'react'

function RecorderComponent() {
    const audioChunk = useRef([]);
    const mediaRecorderRef = useRef(null);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediarecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediarecorder;

            mediarecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunk.current.push(event.data);
                }
            };

            mediarecorder.onstop = () => {
                // Create a Blob from the recorded audio chunks
                const audioBlob = new Blob(audioChunk.current, { type: "audio/wav" });
                // Generate a URL for the Blob and play the audio
                const audioURL = URL.createObjectURL(audioBlob);
                const audioElement = new Audio(audioURL);
                audioElement.play();
                console.log("Playing recorded audio...");
            };

            mediarecorder.start();
            console.log("Recording started...");
        } catch (error) {
            console.error("Error accessing microphone:", error);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            console.log("Recording stopped...");
        }
    };

    return (
        <div>
            <button onClick={startRecording}>Start Recording</button>
            <button onClick={stopRecording}>Stop Recording</button>
        </div>
    );
}

export default RecorderComponent;