
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
  const [introVisible, setIntroVisible] = useState(true);

  const hideIntroTimeout = useRef(null);
  const touchStartY = useRef(0);

  function handleTouchStart(e) {
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e) {
    const touchEndY = e.changedTouches[0].clientY;
    const difference = touchStartY.current - touchEndY;

    // Dedo se deslocou para cima
    if (difference > 50) {
      showIntro();
    }
  }


  function showIntro() {
    setIntroVisible(true);

    clearTimeout(hideIntroTimeout.current);

    if (isPlaying && !isModalOpen) {
      hideIntroTimeout.current = setTimeout(() => {
        setIntroVisible(false);
      }, 4000);
    }
  }


  const audioCtx = useRef(null);
  const analyser = useRef(null);
  const source = useRef(null);
  const audioRef = useRef(null);

  function initializeAudio() {
    if (!audioCtx.current) {
      audioCtx.current = new AudioContext();

      analyser.current = audioCtx.current.createAnalyser();
      if (visualizerMode === "oscilloscope" || visualizerMode === "frequency-bars") {
        analyser.current.fftSize = 512;
      } else {
        analyser.current.fftSize = 4096;
      }
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


  const paletteBaseColor = {
    "KANYE WEST": "#853082",
    "FRANK OCEAN": "#49986b",
    "DANIEL CAESAR": "#164cf4"
  };

  const baseColor = paletteBaseColor[artist.toUpperCase()] ?? "#888888";

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
    clearTimeout(hideIntroTimeout.current);

    if (!isPlaying || isModalOpen) {
      setIntroVisible(true);
      return;
    }

    showIntro();

    return () => {
      clearTimeout(hideIntroTimeout.current);
    };
  }, [isPlaying, isModalOpen]);

  useEffect(() => {
    return () => {
      clearTimeout(hideIntroTimeout.current);
    };
  }, []);


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
      <main
        className={styles.main}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (!introVisible) {
            showIntro();
          }
        }}
      >
        <div
          className={`${styles.intro} ${introVisible ? "" : styles.introHidden
            }`}
        >
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
              </>
            ) : ""}
          </div>
        </div>
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
        <div style={{ textAlign: "center" }}>
          <h1>{title}</h1>
          <h4>{artist}</h4>
        </div>
        <div className={styles.lyricsContainer}>
          {loading ? (
            <p>Buscando letra...</p>
          ) : (
            <div className={styles.lyrics}>
              {lyricLines.length > 0 && (
                <>
                  <p className={styles.activeLyric}>
                    {lyricLines[activeLineIndex]?.text}
                  </p>

                  {activeLineIndex >= 0 && (
                    <p className={styles.nextLyric}>
                      {lyricLines[activeLineIndex + 1]?.text}
                    </p>
                  )}
                </>
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
              randomBaseColor={baseColor}
              hueRange={55}
            />
          )}
        </div>
      </main>
    </div>
  );
}
