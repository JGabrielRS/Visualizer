
"use client";

import styles from "./page.module.css";
import { useState, useRef, useEffect } from "react";

export default function Home() {
  const [file, setFile] = useState(null);

  const audioCtx = useRef(null);
  const analyser = useRef(null);
  const source = useRef(null);

  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const animationRef = useRef(null);

  function initializeAudio() {
    if (!audioCtx.current) {
      audioCtx.current = new AudioContext();

      analyser.current = audioCtx.current.createAnalyser();
      analyser.current.fftSize = 512;

      source.current = audioCtx.current.createMediaElementSource(
        audioRef.current
      );

      source.current.connect(analyser.current);
      analyser.current.connect(audioCtx.current.destination);
    }
  }

  function draw() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    const analyserNode = analyser.current;

    const bufferLength = analyserNode.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    function render() {
      animationRef.current = requestAnimationFrame(render);

      analyserNode.getByteTimeDomainData(dataArray);

      ctx.fillStyle = "rgb(0, 0, 0)";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgb(255, 255, 255)";
      ctx.beginPath();

      const sliceWidth = WIDTH / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * (HEIGHT / 2);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(WIDTH, HEIGHT / 2);
      ctx.stroke();
    }

    render();
  }

  async function handlePlay() {
    initializeAudio();

    if (audioCtx.current.state === "suspended") {
      await audioCtx.current.resume();
    }

    if (!animationRef.current) {
      draw();
    }
  }

  useEffect(() => {
    if (!file || !audioRef.current) return;

    const url = URL.createObjectURL(file);

    audioRef.current.src = url;

    return () => {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();

      URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.intro}>
          <input
            type="file"
            accept=".mp3,.wav,.m4a,.aac,.flac,.ogg,.oga,.aif,.aiff"
            onChange={(e) => setFile(e.target.files[0])}
          />
        </div>

        {file ? (<audio ref={audioRef} controls onPlay={handlePlay} />) : ""}
        <h3>{file ? file.name.split("(")[0] : ""}</h3>
        {file && (
          <canvas
            width="1024px"
            height="auto"
            ref={canvasRef}
          />
        )}
      </main>
    </div>
  );
}
