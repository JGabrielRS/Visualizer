
"use client";

import { useEffect, useRef } from "react";
import styles from "./Visualizer.module.css";
import { hexToHsl, clamp } from "../utils/hexToHsl"

export default function Visualizer({
    analyserRef,
    active,
    mode = "mesh-frequency",
    randomBaseColor = "#fefefe",
    hueRange = 55
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

        // Cor principal da paleta
        const baseHsl = hexToHsl(randomBaseColor);

        // Controle da transição de cores
        let currentHueShift = 0;
        let targetHueShift = 0;

        let colorProgress = 0;
        let previousFrame = performance.now();

        // Intensidade suavizada dos graves
        let smoothedBass = 0;

        const columns = 80;
        const rows = 16;

        function resizeCanvas() {
            const rect = canvas.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
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

            const now = performance.now();
            const delta = Math.min(now - previousFrame, 50);

            previousFrame = now;

            // Captura as frequências
            analyser.getByteFrequencyData(frequencyData);

            if (isWaveform) {
                analyser.getByteTimeDomainData(waveformData);
            }

            // Calcula a intensidade dos graves
            let bassRaw = 0;

            const bassSamples = Math.min(20, frequencyData.length);

            for (let i = 0; i < bassSamples; i++) {
                bassRaw += frequencyData[i];
            }

            bassRaw /= bassSamples * 255;

            // Aumenta a resposta dos graves
            bassRaw = Math.min(bassRaw * 1.7, 1);

            // Suaviza a intensidade
            smoothedBass += (
                bassRaw - smoothedBass
            ) * (1 - Math.exp(-delta / 180));

            const bass = smoothedBass;

            // Controle das cores aleatórias
            colorProgress += delta * (1 + bass * 4);

            if (colorProgress >= 5000) {
                colorProgress %= 5000;

                targetHueShift = (
                    Math.random() * 2 - 1
                ) * hueRange * (0.65 + bass * 0.35);
            }

            // Transição das cores
            const transitionDuration = 1600 - bass * 1100;

            const transition = 1 - Math.exp(
                -delta / transitionDuration
            );

            currentHueShift += (
                targetHueShift - currentHueShift
            ) * transition;

            ctx.clearRect(0, 0, width, height);

            // Cria o gradiente
            const gradient = ctx.createLinearGradient(
                0, 0, width, 0
            );

            const centerHue = (
                baseHsl.h + currentHueShift + 360
            ) % 360;

            // Variações próximas da cor principal
            const stops = [
                { position: 0, hue: -12, sat: 4, light: 0 },
                { position: 0.25, hue: -6, sat: 10, light: 10 },
                { position: 0.5, hue: 0, sat: 4, light: -4 },
                { position: 0.75, hue: 7, sat: 12, light: 7 },
                { position: 1, hue: 14, sat: 5, light: 2 }
            ];

            stops.forEach((stop) => {
                const hue = (
                    centerHue + stop.hue + 360
                ) % 360;

                const saturation = clamp(
                    baseHsl.s + stop.sat,
                    35,
                    95
                );

                const lightness = clamp(
                    baseHsl.l + stop.light,
                    25,
                    80
                );

                gradient.addColorStop(
                    stop.position,
                    `hsl(${hue}, ${saturation}%, ${lightness}%)`
                );
            });

            // O brilho também responde aos graves
            ctx.shadowColor = `hsl(${centerHue}, ${baseHsl.s}%, ${baseHsl.l}%)`;
            ctx.shadowBlur = 5 + bass * 15;

            // Oscilloscope
            if (mode === "oscilloscope") {
                ctx.beginPath();
                ctx.shadowBlur = 0;

                ctx.lineWidth = 2;
                ctx.strokeStyle = gradient;

                const samples = Math.min(waveformData.length, Math.floor(width * 1.5));
                const step = waveformData.length / samples;

                const sliceWidth = width / (samples - 1);

                for (let i = 0; i < samples; i++) {
                    const index = Math.floor(i * step);

                    const x = i * sliceWidth;
                    const v = waveformData[index] / 128;
                    const y = (v - 1) * (height / 2.5) + height / 2;

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
                ctx.shadowBlur = 0;
                const barWidth = 5;
                const barGap = 3;

                ctx.fillStyle = gradient;

                for (let i = 0; i < frequencyData.length; i++) {
                    const barHeight =
                        (frequencyData[i] / 255) * height;

                    const x = i * (barWidth + barGap);
                    const y = height - barHeight;

                    ctx.fillRect(
                        x,
                        y,
                        barWidth,
                        barHeight
                    );
                }

                return;
            }

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

    }, [
        analyserRef,
        active,
        mode,
        randomBaseColor,
        hueRange
    ]);

    return (
        <canvas
            ref={canvasRef}
            className={styles.visualizer}
        />
    );
}
