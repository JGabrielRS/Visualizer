
"use client";

import styles from "./page.module.css";
import { useState, useRef, useEffect } from "react";
import { fetchLyrics } from "../service/lrclib";
import { parseLrc } from "../utils/parseLyrics";
import Visualizer from "../components/Visualizer";


export default function Home() {
  const API_URL = "https://lrclib.net/api";

  const [file, setFile] = useState(null);
  const [lyrics, setLyrics] = useState("");
  const [lyricLines, setLyricLines] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [visualizerMode, setVisualizerMode] = useState("mesh-frequency");

  const audioCtx = useRef(null);
  const analyser = useRef(null);
  const source = useRef(null);
  const audioRef = useRef(null);

  function initializeAudio() {
    if (!audioCtx.current) {
      audioCtx.current = new AudioContext();

      analyser.current = audioCtx.current.createAnalyser();
      analyser.current.fftSize = 4096;
      analyser.current.smoothingTimeConstant = 0.65;
      analyser.current.minDecibels = -90;
      analyser.current.maxDecibels = -20;

      source.current = audioCtx.current.createMediaElementSource(
        audioRef.current
      );

      source.current.connect(analyser.current);
      analyser.current.connect(audioCtx.current.destination);
    }
  }

  async function handlePlay() {
    try {
      initializeAudio();

      if (audioCtx.current.state === "suspended") {
        await audioCtx.current.resume();
      }

      setIsPlaying(true);

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
              <>
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  controls
                  preload="metadata"
                  onPlay={handlePlay}
                  onPause={() => setIsPlaying(false)}
                  onTimeUpdate={() => {
                    setCurrentTime(audioRef.current.currentTime);
                  }}
                />
                <label className={styles.fileInput}>
                  <button
                    className={styles.visualizerButton}
                    onClick={() => setIsModalOpen(true)}
                  >
                    Visualizers
                  </button>
                </label>
                {isModalOpen && (
                  <div
                    className={styles.modalOverlay}
                    onClick={() => setIsModalOpen(false)}
                  >
                    <div
                      className={styles.modal}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className={styles.modalHeader}>
                        <h2>Visualizers</h2>

                        <button
                          className={styles.closeButton}
                          onClick={() => setIsModalOpen(false)}
                        >
                          ×
                        </button>
                      </div>

                      <div className={styles.visualizerOptions}>
                        {[
                          { id: "mesh-waveform", name: "Mesh Waveform" },
                          { id: "mesh-frequency", name: "Mesh Frequency" },
                          { id: "oscilloscope", name: "Oscilloscope" },
                          { id: "frequency-bars", name: "Frequency Bars" }
                        ].map((visualizer) => (
                          <button
                            key={visualizer.id}
                            className={
                              visualizerMode === visualizer.id
                                ? styles.selectedVisualizer
                                : styles.visualizerOption
                            }
                            onClick={() => {
                              setVisualizerMode(visualizer.id);
                              setIsModalOpen(false);
                            }}
                          >
                            {visualizer.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
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
            <Visualizer
              analyserRef={analyser}
              active={isPlaying}
              mode={visualizerMode}
            />
          )}
        </div>
      </main>
    </div>
  );
}
