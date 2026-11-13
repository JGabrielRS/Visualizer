
"use client";

import styles from "./page.module.css";
import { useState, useRef, useEffect } from "react";
import { fetchLyrics } from "../service/lrclib";
import { parseLrc } from "../utils/parseLyrics";


export default function Home() {
  const API_URL = "https://lrclib.net/api";

  const [file, setFile] = useState(null);
  const [lyrics, setLyrics] = useState("");
  const [lyricLines, setLyricLines] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(false);

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
    try {
      initializeAudio();

      if (audioCtx.current.state === "suspended") {
        await audioCtx.current.resume();
      }

      if (!animationRef.current && canvasRef.current) {
        draw();
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Erro ao reproduzir áudio:", error);
      }
    }
  }


  const [artist, title] = file?.name
    .replace(/\.[^/.]+$/, "")
    .replace(/\s*\([^)]*\)/g, "")
    .split("-")
    .map(part => part.trim()) ?? ["", ""];

  const activeLineIndex = lyricLines.findLastIndex(
    (line) => line.time <= currentTime
  );

  useEffect(() => {
    if (!file) {
      setLyrics("");
      return;
    }

    async function loadLyrics() {
      try {
        setLoading(true);

        const results = await fetchLyrics(artist, title, API_URL);

        if (!results || results.length === 0) {
          setLyrics("Nenhuma letra encontrada.");
          return;
        }

        const music = results[0];

        if (music.syncedLyrics) {
          setLyricLines(parseLrc(music.syncedLyrics));
        } else {
          setLyricLines([]);
          setLyrics(music.plainLyrics || "Letra indisponível.");
        }

      } catch (error) {
        setLyrics("Erro ao buscar letra.");
      } finally {
        setLoading(false);
      }
    }

    loadLyrics();
  }, [file, artist, title]);

  const [audioUrl, setAudioUrl] = useState(null);

  useEffect(() => {
    if (!file) {
      setAudioUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setAudioUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.intro}>
          <div className={styles.buttonContainer}>
            <label className={styles.fileInput}>
              Selecionar música
              <input
                type="file"
                accept=".mp3,.wav,.m4a,.aac,.flac,.ogg,.oga,.aif,.aiff"
                onChange={(e) => setFile(e.target.files[0])}
              />
            </label>
            {file ? (
              <audio
                ref={audioRef}
                src={audioUrl}
                controls
                preload="metadata"
                onPlay={handlePlay}
                onTimeUpdate={() => {
                  setCurrentTime(audioRef.current.currentTime);
                }}
              />
            ) : ""}
          </div>
          <div style={{ textAlign: "center" }}>
            <h1>{title}</h1>
            <h3>{artist}</h3>
          </div>
        </div>
        <div className={styles.lyricsContainer}>
          {loading ? (
            <p>Buscando letra...</p>
          ) : (
            <div className={styles.lyrics}>
              {lyricLines.length > 0 ? (
                lyricLines.map((line, index) => (
                  <p
                    key={index}
                    className={
                      index === activeLineIndex
                        ? styles.activeLyric
                        : styles.lyric
                    }
                  >
                    {line.text}
                  </p>
                ))
              ) : (
                <p>{lyrics}</p>
              )}
            </div>
          )}
        </div>
        <div className={styles.visualizerContainer}>
          {file && (
            <canvas
              width={1024}
              height={200}
              ref={canvasRef}
              className={styles.visualizer}
            />
          )}
        </div>
      </main>
    </div>
  );
}
