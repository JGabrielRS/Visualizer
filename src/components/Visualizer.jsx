
"use client";

import { useEffect, useRef } from "react";
import styles from "./Visualizer.module.css";

export default function Visualizer({
    analyserRef,
    active,
    mode = "mesh-frequency"
}) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const analyser = analyserRef.current;

        if (!analyser || !active) return;

        const frequencyData = new Uint8Array(
            analyser.frequencyBinCount
        );

        const waveformData = new Uint8Array(
            analyser.fftSize
        );

        const isFrequency =
            mode === "mesh-frequency" ||
            mode === "frequency-bars";

        const isWaveform =
            mode === "mesh-waveform" ||
            mode === "oscilloscope";

        if (!isFrequency && !isWaveform) {
            console.error("Modo desconhecido:", mode);
            return;
        }

        let animationId;
        let time = 0;

        const columns = 80;
        const rows = 16;

        function resizeCanvas() {
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;

            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        resizeCanvas();

        const points = [];

        function render() {
            animationId = requestAnimationFrame(render);

            const width = canvas.clientWidth;
            const height = canvas.clientHeight;

            // Captura os dados do áudio
            if (isFrequency) {
                analyser.getByteFrequencyData(frequencyData);
            } else {
                analyser.getByteTimeDomainData(waveformData);
            }

            ctx.clearRect(0, 0, width, height);

            // Gradiente
            const gradient = ctx.createLinearGradient(
                0, 0, width, 0
            );

            gradient.addColorStop(0, "#F52B91");
            gradient.addColorStop(0.25, "#C026D3");
            gradient.addColorStop(0.5, "#7628D7");
            gradient.addColorStop(0.75, "#315CEB");
            gradient.addColorStop(1, "#77C9F2");

            // Oscilloscope
            if (mode === "oscilloscope") {
                ctx.beginPath();

                ctx.lineWidth = 2;
                ctx.strokeStyle = gradient;
                ctx.shadowColor = "#C026D3";
                ctx.shadowBlur = 12;

                const sliceWidth = width / waveformData.length;

                for (let i = 0; i < waveformData.length; i++) {
                    const x = i * sliceWidth;

                    const v = waveformData[i] / 128;
                    const y = v * (height / 2);

                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }

                ctx.stroke();
                return;
            }

            // Frequency Bars
            if (mode === "frequency-bars") {
                const barWidth = width / frequencyData.length;

                ctx.fillStyle = gradient;
                ctx.shadowColor = "#168bff";
                ctx.shadowBlur = 8;

                for (let i = 0; i < frequencyData.length; i++) {
                    const barHeight =
                        (frequencyData[i] / 255) * height;

                    const x = i * barWidth;
                    const y = height - barHeight;

                    ctx.fillRect(
                        x,
                        y,
                        Math.max(1, barWidth - 1),
                        barHeight
                    );
                }

                return;
            }

            // Intensidade dos graves
            let bass = 0;

            for (let i = 0; i < 20; i++) {
                bass += frequencyData[i];
            }

            bass /= 20 * 255;

            // Aumenta a resposta dos graves
            bass = Math.min(bass * 1.2, 1);

            // Calcula os pontos da malha
            for (let row = 0; row <= rows; row++) {
                points[row] = [];

                for (let col = 0; col <= columns; col++) {
                    const x = (col / columns) * width;

                    const meshHeight = height * 0.45;
                    const meshTop = (height - meshHeight) / 2;

                    const baseY = meshTop + (row / rows) * meshHeight;

                    const position = col / columns;

                    let audioValue = 0;

                    if (mode === "mesh-frequency") {
                        const index = Math.floor(
                            position * (frequencyData.length - 1)
                        );

                        audioValue = frequencyData[index] / 255;

                    } else {
                        const index = Math.floor(
                            position * (waveformData.length - 1)
                        );

                        audioValue =
                            (waveformData[index] - 128) / 128;
                    }

                    // Movimento orgânico
                    const wave1 = Math.sin(
                        col * 0.12 - time + row * 0.35
                    );

                    const wave2 = Math.sin(
                        col * 0.055 + time * 0.7 + row * 0.5
                    );

                    let y;

                    if (mode === "mesh-frequency") {
                        const amplitude =
                            4 +
                            bass * 18 +
                            audioValue * 22;

                        const displacement =
                            wave1 * amplitude +
                            wave2 * amplitude * 0.4;

                        // Limita o movimento dentro do canvas
                        const margin = 12;

                        y = Math.max(
                            margin,
                            Math.min(height - margin, baseY + displacement)
                        );
                    } else {
                        const amplitude = height * 0.12;

                        y =
                            baseY +
                            wave1 * 8 +
                            wave2 * 4 +
                            audioValue * amplitude;
                    }

                    points[row][col] = { x, y };
                }
            }

            // Estilo da malha
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 1;
            ctx.shadowColor = "#168bff";
            ctx.shadowBlur = 8;

            // Linhas horizontais
            for (let row = 0; row <= rows; row++) {
                ctx.beginPath();

                for (let col = 0; col <= columns; col++) {
                    const point = points[row][col];

                    if (col === 0) {
                        ctx.moveTo(point.x, point.y);
                    } else {
                        ctx.lineTo(point.x, point.y);
                    }
                }

                ctx.stroke();
            }

            // Linhas verticais
            for (let col = 0; col <= columns; col++) {
                ctx.beginPath();

                for (let row = 0; row <= rows; row++) {
                    const point = points[row][col];

                    if (row === 0) {
                        ctx.moveTo(point.x, point.y);
                    } else {
                        ctx.lineTo(point.x, point.y);
                    }
                }

                ctx.stroke();
            }

            time += 0.025 + bass * 0.015;
        }

        render();

        window.addEventListener("resize", resizeCanvas);

        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener("resize", resizeCanvas);
        };

    }, [analyserRef, active, mode]);

    return (
        <canvas
            ref={canvasRef}
            className={styles.visualizer}
        />
    );
}
